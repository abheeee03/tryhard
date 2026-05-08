import { NextRequest, NextResponse } from "next/server";
import { TxType } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ inviteCode: string }>;
};

export async function GET(req: NextRequest, context: RouteContext) {
  const { inviteCode: rawInviteCode } = await context.params;
  const inviteCode = rawInviteCode.trim().toUpperCase();
  const userId = req.nextUrl.searchParams.get("userId")?.trim();
  const wallet = req.nextUrl.searchParams.get("wallet")?.trim();

  if (!inviteCode) {
    return NextResponse.json(
      { status: "FAILED", error: "Missing invite code" },
      { status: 400 }
    );
  }

  const match = await prisma.match.findUnique({
    where: { inviteCode },
    include: {
      creator: {
        select: { id: true, wallet: true, username: true },
      },
      players: {
        include: {
          user: {
            select: { id: true, wallet: true, username: true },
          },
        },
        orderBy: { joinedAt: "asc" },
      },
    },
  });

  if (!match) {
    return NextResponse.json(
      { status: "FAILED", error: "Room not found" },
      { status: 404 }
    );
  }

  const currentUser =
    userId || wallet
      ? await prisma.user.findFirst({
          where: {
            OR: [
              ...(userId ? [{ id: userId }] : []),
              ...(wallet ? [{ wallet }] : []),
            ],
          },
          select: { id: true, wallet: true, username: true },
        })
      : null;

  const stakeTransactions = await prisma.transaction.findMany({
    where: {
      matchId: match.id,
      type: TxType.STAKE,
    },
    select: {
      id: true,
      userId: true,
      amount: true,
      signature: true,
      createdAt: true,
      user: {
        select: { id: true, wallet: true, username: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const currentUserStake = currentUser
    ? stakeTransactions.find((tx) => tx.userId === currentUser.id)
    : null;

  return NextResponse.json({
    status: "SUCCESS",
    data: {
      match: {
        id: match.id,
        inviteCode: match.inviteCode,
        status: match.status,
        stakeAmount: match.stakeAmount,
        totalPlayers: match.totalPlayers,
        currentPlayers: match.players.length,
        questionCount: match.questionCount,
        timePerQ: match.timePerQ,
        creatorId: match.creatorId,
        creator: match.creator,
        players: match.players,
        depositedPlayers: stakeTransactions.map((tx) => ({
          userId: tx.userId,
          wallet: tx.user.wallet,
          username: tx.user.username,
          amount: tx.amount,
          signature: tx.signature,
          createdAt: tx.createdAt,
        })),
      },
      userDeposit: currentUserStake
        ? {
            deposited: true,
            signature: currentUserStake.signature,
            amount: currentUserStake.amount,
          }
        : { deposited: false },
    },
  });
}
