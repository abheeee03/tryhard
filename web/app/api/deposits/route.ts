import { NextRequest, NextResponse } from "next/server";
import { clusterApiUrl, Connection } from "@solana/web3.js";
import { MatchStatus, TxType } from "@/app/generated/prisma/client";
import { ESCROW_PROGRAM_ID, getEscrowPda } from "@/lib/escrow";
import { prisma } from "@/lib/prisma";

type DepositBody = {
  inviteCode?: string;
  userId?: string;
  wallet?: string;
  signature?: string;
};

const createUsername = (wallet: string) =>
  `player-${wallet.slice(0, 6).toLowerCase()}`;

const getConnection = () =>
  new Connection(
    process.env.SOLANA_RPC_URL ??
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL ??
      clusterApiUrl("devnet"),
    "confirmed"
  );

export async function POST(req: NextRequest) {
  let body: DepositBody;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { status: "FAILED", error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const inviteCode = body.inviteCode?.trim().toUpperCase();
  const wallet = body.wallet?.trim();
  const signature = body.signature?.trim();

  if (!inviteCode || !wallet || !signature) {
    return NextResponse.json(
      { status: "FAILED", error: "Missing inviteCode, wallet, or signature" },
      { status: 400 }
    );
  }

  const match = await prisma.match.findUnique({
    where: { inviteCode },
    select: {
      id: true,
      creatorId: true,
      stakeAmount: true,
      status: true,
      totalPlayers: true,
    },
  });

  if (!match) {
    return NextResponse.json(
      { status: "FAILED", error: "Room not found" },
      { status: 404 }
    );
  }

  if (match.status !== MatchStatus.WAITING) {
    return NextResponse.json(
      { status: "FAILED", error: "Room is not accepting deposits" },
      { status: 409 }
    );
  }

  try {
    const connection = getConnection();
    const status = await connection.getSignatureStatus(signature, {
      searchTransactionHistory: true,
    });

    if (status.value?.err) {
      return NextResponse.json(
        { status: "FAILED", error: "Deposit transaction failed on-chain" },
        { status: 400 }
      );
    }

    if (!status.value) {
      return NextResponse.json(
        { status: "FAILED", error: "Deposit transaction not found yet" },
        { status: 400 }
      );
    }

    const parsedTransaction = await connection.getParsedTransaction(signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
    const accountKeys =
      parsedTransaction?.transaction.message.accountKeys.map((account) =>
        account.pubkey.toBase58()
      ) ?? [];
    const escrowPda = getEscrowPda(inviteCode).toBase58();

    if (
      !accountKeys.includes(wallet) ||
      !accountKeys.includes(escrowPda) ||
      !accountKeys.includes(ESCROW_PROGRAM_ID.toBase58())
    ) {
      return NextResponse.json(
        { status: "FAILED", error: "Deposit transaction does not match this room" },
        { status: 400 }
      );
    }

    const user = await prisma.user.upsert({
      where: { wallet },
      update: {},
      create: {
        wallet,
        username: createUsername(wallet),
      },
      select: { id: true, wallet: true, username: true },
    });

    const existingStake = await prisma.transaction.findFirst({
      where: {
        matchId: match.id,
        userId: user.id,
        type: TxType.STAKE,
      },
    });

    if (existingStake) {
      return NextResponse.json({
        status: "SUCCESS",
        data: { transaction: existingStake, user },
      });
    }

    const stakeCount = await prisma.transaction.count({
      where: { matchId: match.id, type: TxType.STAKE },
    });

    const isCreator = user.id === match.creatorId;
    if (!isCreator && stakeCount >= match.totalPlayers) {
      return NextResponse.json(
        { status: "FAILED", error: "Room already has all deposits" },
        { status: 409 }
      );
    }

    const transaction = await prisma.transaction.create({
      data: {
        userId: user.id,
        matchId: match.id,
        amount: match.stakeAmount,
        type: TxType.STAKE,
        signature,
      },
    });

    return NextResponse.json({
      status: "SUCCESS",
      data: { transaction, user },
    });
  } catch (error) {
    console.error("[deposits] Error recording deposit:", error);
    return NextResponse.json(
      { status: "FAILED", error: "Failed to record deposit" },
      { status: 500 }
    );
  }
}
