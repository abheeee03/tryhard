import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type EnsureUserBody = {
  wallet?: string;
};

type EnsureUserResponse =
  | { status: "SUCCESS"; data: { user: unknown } }
  | { status: "FAILED"; error: string };

const createUsername = (wallet: string) => {
  const suffix = wallet.slice(0, 6).toLowerCase();
  return `player-${suffix}`;
};

export async function POST(req: NextRequest) {
  let body: EnsureUserBody;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { status: "FAILED", error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const wallet = typeof body.wallet === "string" ? body.wallet.trim() : "";

  if (!wallet) {
    return NextResponse.json(
      { status: "FAILED", error: "Missing wallet" },
      { status: 400 }
    );
  }

  try {
    const existingUser = await prisma.user.findUnique({
      where: { wallet },
    });

    let user = existingUser;

    if (!existingUser) {
      user = await prisma.user.create({
        data: {
          wallet,
          username: createUsername(wallet),
        },
      });
    } else if (!existingUser.username) {
      user = await prisma.user.update({
        where: { id: existingUser.id },
        data: { username: createUsername(wallet) },
      });
    }

    const response: EnsureUserResponse = {
      status: "SUCCESS",
      data: { user },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("[users] Error ensuring user:", error);
    return NextResponse.json(
      { status: "FAILED", error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { userId, username } = await req.json();

    if (!userId || !username) {
      return NextResponse.json(
        { status: "FAILED", error: "Missing userId or username" },
        { status: 400 }
      );
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { username: username.trim() },
    });

    return NextResponse.json({
      status: "SUCCESS",
      data: { user: updatedUser },
    });
  } catch (error) {
    console.error("[users] Error updating username:", error);
    return NextResponse.json(
      { status: "FAILED", error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export const ensureUser = POST;
