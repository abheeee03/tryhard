import { NextRequest, NextResponse } from "next/server";
import {
  clusterApiUrl,
  Connection,
  Keypair,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import { MatchStatus, TxType } from "@/app/generated/prisma/client";
import {
  createDrawEscrowInstruction,
  createResolveEscrowInstruction,
} from "@/lib/escrow";
import { prisma } from "@/lib/prisma";

type EndGameBody = {
  matchId?: string;
  inviteCode?: string;
  winnerId?: string | null;
};

const getConnection = () =>
  new Connection(
    process.env.SOLANA_RPC_URL ??
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL ??
      clusterApiUrl("devnet"),
    "confirmed"
  );

const parseBackendAuthority = () => {
  const rawSecret = process.env.BACKEND_AUTH_SECRET_KEY;
  if (!rawSecret) {
    throw new Error("Missing BACKEND_AUTH_SECRET_KEY");
  }

  const secret = JSON.parse(rawSecret) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(secret));
};

const assertAuthorized = (req: NextRequest) => {
  const expected = process.env.END_GAME_SECRET;
  if (!expected) {
    return true;
  }

  const actual = req.headers.get("authorization");
  return actual === `Bearer ${expected}`;
};

export async function POST(req: NextRequest) {
  if (!assertAuthorized(req)) {
    return NextResponse.json(
      { status: "FAILED", error: "Unauthorized" },
      { status: 401 }
    );
  }

  let body: EndGameBody;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { status: "FAILED", error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (!body.matchId && !body.inviteCode) {
    return NextResponse.json(
      { status: "FAILED", error: "Missing matchId or inviteCode" },
      { status: 400 }
    );
  }

  try {
    const match = await prisma.match.findFirst({
      where: body.matchId
        ? { id: body.matchId }
        : { inviteCode: body.inviteCode?.trim().toUpperCase() },
      include: {
        players: {
          include: { user: true },
          orderBy: { joinedAt: "asc" },
        },
      },
    });

    if (!match) {
      return NextResponse.json(
        { status: "FAILED", error: "Match not found" },
        { status: 404 }
      );
    }

    const existingPayout = await prisma.transaction.findFirst({
      where: {
        matchId: match.id,
        type: body.winnerId ? TxType.REWARD : TxType.DRAW,
      },
      select: { signature: true },
    });

    if (existingPayout?.signature) {
      return NextResponse.json({
        status: "SUCCESS",
        data: { signature: existingPayout.signature, alreadyResolved: true },
      });
    }

    const backendAuthority = parseBackendAuthority();
    const connection = getConnection();
    const transaction = new Transaction();
    const inviteCode = match.inviteCode.trim().toUpperCase();

    if (body.winnerId) {
      const winner = match.players.find(
        (player) => player.userId === body.winnerId
      );

      if (!winner) {
        return NextResponse.json(
          { status: "FAILED", error: "Winner is not a match player" },
          { status: 400 }
        );
      }

      transaction.add(
        createResolveEscrowInstruction({
          inviteCode,
          backendAuthority: backendAuthority.publicKey,
          winner: new PublicKey(winner.user.wallet),
        })
      );
    } else {
      if (match.players.length !== 2) {
        return NextResponse.json(
          { status: "FAILED", error: "Draw payout requires two players" },
          { status: 400 }
        );
      }

      transaction.add(
        createDrawEscrowInstruction({
          inviteCode,
          backendAuthority: backendAuthority.publicKey,
          player1: new PublicKey(match.players[0].user.wallet),
          player2: new PublicKey(match.players[1].user.wallet),
        })
      );
    }

    const signature = await connection.sendTransaction(transaction, [
      backendAuthority,
    ]);
    const latestBlockhash = await connection.getLatestBlockhash();
    await connection.confirmTransaction(
      { signature, ...latestBlockhash },
      "confirmed"
    );

    await prisma.$transaction(async (tx) => {
      await tx.match.update({
        where: { id: match.id },
        data: {
          status: MatchStatus.FINISHED,
          endedAt: match.endedAt ?? new Date(),
          winnerId: body.winnerId ?? null,
        },
      });

      if (body.winnerId) {
        await tx.transaction.create({
          data: {
            userId: body.winnerId,
            matchId: match.id,
            amount: match.stakeAmount * match.players.length,
            type: TxType.REWARD,
            signature,
          },
        });
      } else {
        await Promise.all(
          match.players.map((player) =>
            tx.transaction.create({
              data: {
                userId: player.userId,
                matchId: match.id,
                amount: match.stakeAmount,
                type: TxType.DRAW,
                signature,
              },
            })
          )
        );
      }
    });

    return NextResponse.json({
      status: "SUCCESS",
      data: { signature },
    });
  } catch (error) {
    console.error("[end-game] Failed to release escrow:", error);
    return NextResponse.json(
      { status: "FAILED", error: "Failed to release escrow" },
      { status: 500 }
    );
  }
}
