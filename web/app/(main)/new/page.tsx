"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Transaction } from "@solana/web3.js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  createInitializeEscrowInstruction,
  getBackendAuthorityPublicKey,
  solToLamports,
} from "@/lib/escrow";
import Logo from "@/components/logo";
import UserDialog from "@/components/ui/user-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import ConnectWallet from "@/components/ui/connect-wallet";

type UserRecord = {
  id: string;
  wallet: string;
  username: string | null;
  createdAt: string;
};

type EnsureUserResponse =
  | { status: "SUCCESS"; data: { user: UserRecord } }
  | { status: "FAILED"; error: string };

type CreateMatchResponse =
  | {
      status: "SUCCESS";
      data: { match: { id: string; inviteCode: string; stakeAmount: number } };
    }
  | { status: "FAILED"; error: string };

type DepositResponse =
  | { status: "SUCCESS"; data: unknown }
  | { status: "FAILED"; error: string };

const DEFAULT_FORM = {
  category: "General",
  difficulty: "easy",
  totalQuestions: "10",
  timePerQ: "20",
  stakeAmount: "0.1",
};

export default function NewMatch() {
  const router = useRouter();
  const { connection } = useConnection();
  const { publicKey, connected, sendTransaction } = useWallet();
  const walletAddress = useMemo(
    () => publicKey?.toBase58() ?? "",
    [publicKey]
  );

  const [user, setUser] = useState<UserRecord | null>(null);
  const [ensureStatus, setEnsureStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [ensureError, setEnsureError] = useState("");

  const [formState, setFormState] = useState(DEFAULT_FORM);
  const [createStatus, setCreateStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [createError, setCreateError] = useState("");
  const [createdInviteCode, setCreatedInviteCode] = useState<string | null>(
    null
  );
  const [createdRoomStake, setCreatedRoomStake] = useState<number | null>(null);
  const [createDepositStatus, setCreateDepositStatus] = useState<
    "idle" | "loading" | "signing" | "confirming" | "confirmed" | "error"
  >("idle");
  const [createDepositError, setCreateDepositError] = useState("");

  useEffect(() => {
    if (!walletAddress) {
      setUser(null);
      setEnsureStatus("idle");
      return;
    }

    const ensureUser = async () => {
      setEnsureStatus("loading");
      try {
        const response = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet: walletAddress }),
        });
        const data = (await response.json()) as EnsureUserResponse;
        if (response.ok && data.status === "SUCCESS") {
          setUser(data.data.user);
          setEnsureStatus("ready");
        } else {
          setEnsureStatus("error");
          setEnsureError(data.status === "FAILED" ? data.error : "Failed to ensure user");
        }
      } catch (error) {
        setEnsureStatus("error");
        setEnsureError("Failed to ensure user");
      }
    };

    ensureUser();
  }, [walletAddress]);

  const handleFormChange = useCallback(
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { name, value } = event.target;
      setFormState((prev) => ({ ...prev, [name]: value }));
    },
    []
  );

  const recordDeposit = useCallback(
    async (inviteCode: string, signature: string) => {
      const response = await fetch("/api/deposits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inviteCode,
          wallet: walletAddress,
          userId: user?.id,
          signature,
        }),
      });
      const data = (await response.json()) as DepositResponse;

      if (!response.ok || data.status !== "SUCCESS") {
        throw new Error(
          data.status === "FAILED" ? data.error : "Failed to record deposit"
        );
      }
    },
    [user?.id, walletAddress]
  );

  const depositToEscrow = useCallback(
    async ({
      inviteCode,
      stakeAmount,
      setStatus,
    }: {
      inviteCode: string;
      stakeAmount: number;
      setStatus: (
        status: "idle" | "loading" | "signing" | "confirming" | "confirmed" | "error"
      ) => void;
    }) => {
      if (!publicKey || !walletAddress) {
        throw new Error("Connect a wallet before depositing.");
      }

      const stakeLamports = solToLamports(stakeAmount);
      const instruction = createInitializeEscrowInstruction({
        inviteCode,
        player: publicKey,
        stakeLamports,
        backendAuthority: getBackendAuthorityPublicKey(),
      });

      setStatus("signing");
      const transaction = new Transaction().add(instruction);
      const signature = await sendTransaction(transaction, connection);

      setStatus("confirming");
      await connection.confirmTransaction(signature, "confirmed");
      await recordDeposit(inviteCode, signature);

      setStatus("confirmed");
      return signature;
    },
    [connection, publicKey, recordDeposit, sendTransaction, walletAddress]
  );

  const handleCreateRoom = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      setCreateStatus("loading");
      setCreateError("");
      setCreatedInviteCode(null);
      setCreatedRoomStake(null);
      setCreateDepositStatus("idle");
      setCreateDepositError("");

      if (!walletAddress) {
        setCreateStatus("error");
        setCreateError("Connect a wallet to create a room.");
        return;
      }

      const totalQuestions = Number(formState.totalQuestions);
      const timePerQ = Number(formState.timePerQ);
      const stakeAmount = Number(formState.stakeAmount);

      if (!Number.isFinite(totalQuestions) || totalQuestions <= 0) {
        setCreateStatus("error");
        setCreateError("Total questions must be a positive number.");
        return;
      }

      if (!Number.isFinite(timePerQ) || timePerQ <= 0) {
        setCreateStatus("error");
        setCreateError("Time per question must be a positive number.");
        return;
      }

      if (!Number.isFinite(stakeAmount) || stakeAmount < 0.01) {
        setCreateStatus("error");
        setCreateError("Stake amount must be at least 0.01 SOL.");
        return;
      }

      const payload = {
        time_per_que: timePerQ,
        total_questions: totalQuestions,
        stake_amount: stakeAmount,
        category: formState.category.trim() || undefined,
        difficulty: formState.difficulty.trim() || undefined,
        player1_wallet: walletAddress,
        userId: user?.id,
      };

      try {
        const response = await fetch("/api/create-match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await response.json()) as CreateMatchResponse;

        if (!response.ok || data.status !== "SUCCESS") {
          const errorMessage =
            data.status === "FAILED"
              ? data.error
              : "Failed to create match";
          throw new Error(errorMessage);
        }

        const createdMatch = data.data.match;
        setCreatedInviteCode(createdMatch.inviteCode);
        setCreatedRoomStake(createdMatch.stakeAmount);
        await depositToEscrow({
          inviteCode: createdMatch.inviteCode,
          stakeAmount: createdMatch.stakeAmount,
          setStatus: setCreateDepositStatus,
        });
        setCreateStatus("success");
      } catch (error) {
        setCreateStatus("error");
        setCreateDepositStatus("error");
        setCreateError(
          error instanceof Error ? error.message : "Failed to create match"
        );
        setCreateDepositError(
          error instanceof Error ? error.message : "Failed to deposit stake"
        );
      }
    },
    [depositToEscrow, formState, user, walletAddress]
  );

  const handleRetryCreateDeposit = useCallback(async () => {
    if (!createdInviteCode || !createdRoomStake) {
      return;
    }

    setCreateError("");
    setCreateDepositError("");

    try {
      await depositToEscrow({
        inviteCode: createdInviteCode,
        stakeAmount: createdRoomStake,
        setStatus: setCreateDepositStatus,
      });
      setCreateStatus("success");
    } catch (error) {
      setCreateStatus("error");
      setCreateDepositStatus("error");
      setCreateDepositError(
        error instanceof Error ? error.message : "Failed to deposit stake"
      );
    }
  }, [createdInviteCode, createdRoomStake, depositToEscrow]);

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 text-zinc-900">
      <nav className="fixed w-full flex items-center justify-between px-10 py-4 bg-white/80 backdrop-blur-md z-50 border-b border-zinc-200">
        <Link href="/home" className="flex gap-2 items-center justify-center text-lg font-bold">
          <Logo /> tryhard
        </Link>
        <div>
          {walletAddress ? (
            <UserDialog />
          ) : (
            <ConnectWallet />
          )}
        </div>
      </nav>

      <main className="flex-1 mt-20 flex items-center justify-center p-6">
        <div className="w-full max-w-2xl">
          <div className="mb-8 flex items-center justify-between">
            <h1 className="text-3xl font-bold tracking-tight">Create New Game</h1>
            <Link href="/home">
              <Button variant="ghost">Cancel</Button>
            </Link>
          </div>

          <Card className="border-zinc-200 shadow-lg bg-white">
            <CardContent className="pt-8 px-8 pb-8">
              <form className="grid gap-8" onSubmit={handleCreateRoom}>
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold text-zinc-600">Category</label>
                    <Input
                      name="category"
                      value={formState.category}
                      onChange={handleFormChange}
                      placeholder="General"
                      className="h-12"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold text-zinc-600">Difficulty</label>
                    <select
                      name="difficulty"
                      value={formState.difficulty}
                      onChange={handleFormChange}
                      className="flex h-12 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm ring-offset-white focus:outline-none focus:ring-2 focus:ring-zinc-950"
                    >
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold text-zinc-600">Questions</label>
                    <Input
                      name="totalQuestions"
                      type="number"
                      min={1}
                      value={formState.totalQuestions}
                      onChange={handleFormChange}
                      className="h-12"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold text-zinc-600">Time (sec/Q)</label>
                    <Input
                      name="timePerQ"
                      type="number"
                      min={5}
                      value={formState.timePerQ}
                      onChange={handleFormChange}
                      className="h-12"
                    />
                  </div>
                  <div className="col-span-full flex flex-col gap-2">
                    <label className="text-sm font-semibold text-zinc-600">Stake (SOL)</label>
                    <Input
                      name="stakeAmount"
                      type="number"
                      min={0.01}
                      step="any"
                      value={formState.stakeAmount}
                      onChange={handleFormChange}
                      className="h-12 text-lg font-bold"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <Button
                    type="submit"
                    disabled={!connected || ensureStatus !== "ready" || createStatus === "loading"}
                    className="h-14 bg-zinc-900 text-white text-lg font-bold hover:bg-zinc-800 transition-colors w-full"
                  >
                    {createStatus === "loading"
                      ? createDepositStatus === "signing"
                        ? "Sign stake..."
                        : createDepositStatus === "confirming"
                          ? "Confirming stake..."
                          : "Creating..."
                      : "Create Room"}
                  </Button>
                  
                  {createStatus === "error" && (
                    <p className="text-sm text-red-500 bg-red-50 p-3 rounded-lg border border-red-100">{createError}</p>
                  )}
                  {createDepositStatus === "error" && createDepositError && (
                    <p className="text-sm text-red-500 bg-red-50 p-3 rounded-lg border border-red-100">{createDepositError}</p>
                  )}
                  
                  {createdInviteCode && createDepositStatus === "error" && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleRetryCreateDeposit}
                      className="w-full h-12"
                    >
                      Retry stake deposit
                    </Button>
                  )}
                  
                  {createStatus === "success" && createdInviteCode && (
                    <div className="flex items-center gap-4 rounded-xl bg-emerald-50 p-4 border border-emerald-100">
                      <div className="flex-1">
                        <p className="text-base font-bold text-emerald-800">Room created and stake deposited!</p>
                        <p className="text-sm text-emerald-600">Invite Code: <span className="font-black select-all">{createdInviteCode}</span></p>
                      </div>
                      <Link
                        href={`/room/${createdInviteCode}`}
                        className="inline-flex h-12 items-center rounded-lg bg-emerald-600 px-6 text-sm font-bold text-white hover:bg-emerald-700 shadow-sm"
                      >
                        Join Now
                      </Link>
                    </div>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
