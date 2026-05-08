"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Transaction } from "@solana/web3.js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Settings2, Trophy, Clock, Users, ArrowRight } from "lucide-react";
import {
  createInitializeEscrowInstruction,
  createJoinEscrowInstruction,
  getBackendAuthorityPublicKey,
  solToLamports,
} from "@/lib/escrow";

type UserRecord = {
  id: string;
  wallet: string;
  username: string | null;
  createdAt: string;
};

type MatchHistoryEntry = {
  id: string;
  inviteCode: string;
  status: string;
  stakeAmount: number;
  totalPlayers: number;
  questionCount: number;
  createdAt: string;
  winnerId: string | null;
  creator: { username: string | null; wallet: string };
  players: { userId: string; score: number }[];
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

type RoomDetails = {
  id: string;
  inviteCode: string;
  status: string;
  stakeAmount: number;
  totalPlayers: number;
  questionCount: number;
  timePerQ: number;
};

type RoomDetailsResponse =
  | {
      status: "SUCCESS";
      data: {
        match: RoomDetails;
        userDeposit: { deposited: boolean; signature?: string; amount?: number };
      };
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

function Home() {
  const router = useRouter();
  const { connection } = useConnection();
  const { publicKey, connected, sendTransaction } = useWallet();
  const walletAddress = useMemo(
    () => publicKey?.toBase58() ?? "",
    [publicKey]
  );

  const [user, setUser] = useState<UserRecord | null>(null);
  const [mounted, setMounted] = useState(false);
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
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [joinRoom, setJoinRoom] = useState<RoomDetails | null>(null);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [joinDepositStatus, setJoinDepositStatus] = useState<
    "idle" | "loading" | "signing" | "confirming" | "confirmed" | "error"
  >("idle");
  const [joinDepositError, setJoinDepositError] = useState("");

  const [newUsername, setNewUsername] = useState("");
  const [isUpdatingUsername, setIsUpdatingUsername] = useState(false);
  const [history, setHistory] = useState<MatchHistoryEntry[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const fetchHistory = useCallback(async (userId: string) => {
    setIsLoadingHistory(true);
    try {
      const res = await fetch(`/api/matches?userId=${userId}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setHistory(data);
      } else if (data.status === "SUCCESS" && data.data.matches) {
        setHistory(data.data.matches);
      }
    } catch (e) {
      console.error("Failed to fetch history", e);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  useEffect(() => {
    if (!walletAddress) {
      queueMicrotask(() => {
        setUser(null);
        setEnsureStatus("idle");
        setEnsureError("");
        setCreateStatus("idle");
        setCreateError("");
        setCreatedInviteCode(null);
        setCreatedRoomStake(null);
        setCreateDepositStatus("idle");
        setCreateDepositError("");
        setJoinRoom(null);
        setJoinDialogOpen(false);
        setJoinDepositStatus("idle");
        setJoinDepositError("");
        setHistory([]);
      });
      return;
    }

    let cancelled = false;

    const ensureUser = async () => {
      setEnsureStatus("loading");
      setEnsureError("");

      try {
        const response = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet: walletAddress }),
        });
        const data = (await response.json()) as EnsureUserResponse;

        if (!response.ok || data.status !== "SUCCESS") {
          const errorMessage =
            data.status === "FAILED"
              ? data.error
              : "Failed to ensure user";
          throw new Error(errorMessage);
        }

        if (!cancelled) {
          setUser(data.data.user);
          setEnsureStatus("ready");
          fetchHistory(data.data.user.id);
        }
      } catch (error) {
        if (!cancelled) {
          setEnsureStatus("error");
          setEnsureError(
            error instanceof Error ? error.message : "Failed to ensure user"
          );
        }
      }
    };

    ensureUser();

    return () => {
      cancelled = true;
    };
  }, [fetchHistory, walletAddress]);

  const handleUpdateUsername = async () => {
    if (!user || !newUsername.trim()) return;
    setIsUpdatingUsername(true);
    try {
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, username: newUsername }),
      });
      const data = await res.json();
      if (data.status === "SUCCESS") {
        setUser(data.data.user);
        setNewUsername("");
      }
    } catch (e) {
      console.error("Update username failed", e);
    } finally {
      setIsUpdatingUsername(false);
    }
  };

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
      role,
      setStatus,
    }: {
      inviteCode: string;
      stakeAmount: number;
      role: "creator" | "joiner";
      setStatus: (
        status: "idle" | "loading" | "signing" | "confirming" | "confirmed" | "error"
      ) => void;
    }) => {
      if (!publicKey || !walletAddress) {
        throw new Error("Connect a wallet before depositing.");
      }

      const stakeLamports = solToLamports(stakeAmount);
      const instruction =
        role === "creator"
          ? createInitializeEscrowInstruction({
              inviteCode,
              player: publicKey,
              stakeLamports,
              backendAuthority: getBackendAuthorityPublicKey(),
            })
          : createJoinEscrowInstruction({
              inviteCode,
              player: publicKey,
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
          role: "creator",
          setStatus: setCreateDepositStatus,
        });
        setCreateStatus("success");
        if (user) fetchHistory(user.id);
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
    [depositToEscrow, fetchHistory, formState, user, walletAddress]
  );

  const handleJoinRoom = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setJoinError("");
      setJoinDepositError("");

      const trimmed = joinCode.trim().toUpperCase();
      if (!trimmed) {
        setJoinError("Enter an invite code.");
        return;
      }

      if (!walletAddress || !user?.id) {
        setJoinError("Connect a wallet before joining.");
        return;
      }

      setJoinDepositStatus("loading");

      try {
        const response = await fetch(
          `/api/matches/${trimmed}?userId=${user.id}&wallet=${walletAddress}`
        );
        const data = (await response.json()) as RoomDetailsResponse;

        if (!response.ok || data.status !== "SUCCESS") {
          throw new Error(
            data.status === "FAILED" ? data.error : "Failed to load room"
          );
        }

        if (data.data.match.status !== "WAITING") {
          throw new Error("Room is not accepting players.");
        }

        if (data.data.userDeposit.deposited) {
          router.push(`/room/${trimmed}`);
          return;
        }

        setJoinRoom(data.data.match);
        setJoinDialogOpen(true);
        setJoinDepositStatus("idle");
      } catch (error) {
        setJoinDepositStatus("error");
        setJoinError(error instanceof Error ? error.message : "Failed to join");
      }
    },
    [joinCode, router, user, walletAddress]
  );

  const handleJoinDeposit = useCallback(async () => {
    if (!joinRoom) {
      return;
    }

    setJoinDepositError("");

    try {
      await depositToEscrow({
        inviteCode: joinRoom.inviteCode,
        stakeAmount: joinRoom.stakeAmount,
        role: "joiner",
        setStatus: setJoinDepositStatus,
      });
      router.push(`/room/${joinRoom.inviteCode}`);
    } catch (error) {
      setJoinDepositStatus("error");
      setJoinDepositError(
        error instanceof Error ? error.message : "Failed to deposit stake"
      );
    }
  }, [depositToEscrow, joinRoom, router]);

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
        role: "creator",
        setStatus: setCreateDepositStatus,
      });
      setCreateStatus("success");
      if (user) fetchHistory(user.id);
    } catch (error) {
      setCreateStatus("error");
      setCreateDepositStatus("error");
      setCreateDepositError(
        error instanceof Error ? error.message : "Failed to deposit stake"
      );
    }
  }, [createdInviteCode, createdRoomStake, depositToEscrow, fetchHistory, user]);

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 text-zinc-900">
      <main className="flex w-full max-w-5xl flex-col gap-10 px-6 py-12">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
              Tryhard Arena
            </p>
            <h1 className="text-3xl font-semibold">Dashboard</h1>
            <p className="max-w-xl text-sm text-zinc-600">
              Manage your profile, create new quiz rooms, and view your match history.
            </p>
          </div>
          {mounted && <WalletMultiButton />}
        </header>

        <section className="grid gap-6 sm:grid-cols-3">
          <Card className="col-span-1 border-zinc-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                User Profile
              </CardTitle>
            </CardHeader>
            <CardContent>
              {ensureStatus === "ready" && user ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-base font-medium">{user.username}</p>
                    <p className="text-xs text-zinc-500 truncate">{user.wallet}</p>
                  </div>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full text-xs">
                        <Settings2 className="mr-2 h-3.5 w-3.5" />
                        Edit Username
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-white">
                      <DialogHeader>
                        <DialogTitle>Update Username</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">New Username</label>
                          <Input
                            placeholder="Enter new username"
                            value={newUsername}
                            onChange={(e) => setNewUsername(e.target.value)}
                          />
                        </div>
                        <Button 
                          className="w-full bg-zinc-900 text-white" 
                          onClick={handleUpdateUsername}
                          disabled={isUpdatingUsername || !newUsername.trim()}
                        >
                          {isUpdatingUsername ? "Updating..." : "Save Changes"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-zinc-500">
                    {connected ? "Syncing profile..." : "Awaiting wallet connection."}
                  </p>
                  {ensureStatus === "error" && (
                    <p className="text-xs text-red-500">{ensureError}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="col-span-1 border-zinc-200 shadow-sm sm:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                Join a Room
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form className="flex gap-3" onSubmit={handleJoinRoom}>
                <Input
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value)}
                  className="flex-1"
                  placeholder="INVITE CODE (e.g. ABC123)"
                />
                <Button type="submit" className="bg-zinc-900 text-white">
                  {joinDepositStatus === "loading" ? "Checking..." : "Join"}
                </Button>
              </form>
              {joinError && <p className="mt-2 text-xs text-red-500">{joinError}</p>}
              <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
                <DialogContent className="bg-white">
                  <DialogHeader>
                    <DialogTitle>Deposit stake to join</DialogTitle>
                  </DialogHeader>
                  {joinRoom && (
                    <div className="space-y-4">
                      <div className="rounded-lg border border-zinc-200 p-4 text-sm">
                        <div className="flex justify-between">
                          <span className="text-zinc-500">Room</span>
                          <span className="font-semibold">{joinRoom.inviteCode}</span>
                        </div>
                        <div className="mt-2 flex justify-between">
                          <span className="text-zinc-500">Stake required</span>
                          <span className="font-semibold">{joinRoom.stakeAmount} SOL</span>
                        </div>
                        <div className="mt-2 flex justify-between">
                          <span className="text-zinc-500">Questions</span>
                          <span className="font-semibold">{joinRoom.questionCount}</span>
                        </div>
                      </div>
                      <Button
                        type="button"
                        onClick={handleJoinDeposit}
                        disabled={
                          joinDepositStatus === "signing" ||
                          joinDepositStatus === "confirming"
                        }
                        className="w-full bg-zinc-900 text-white"
                      >
                        {joinDepositStatus === "signing"
                          ? "Sign deposit..."
                          : joinDepositStatus === "confirming"
                            ? "Confirming..."
                            : `Deposit ${joinRoom.stakeAmount} SOL`}
                      </Button>
                      {joinDepositError && (
                        <p className="text-xs text-red-500">{joinDepositError}</p>
                      )}
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </section>

        <div className="grid gap-10 lg:grid-cols-5">
          <section className="lg:col-span-3 space-y-6">
            <h2 className="text-xl font-semibold">Create New Game</h2>
            <Card className="border-zinc-200 shadow-sm">
              <CardContent className="pt-6">
                <form className="grid gap-6" onSubmit={handleCreateRoom}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="flex flex-col gap-2 text-sm font-medium">
                      Category
                      <Input
                        name="category"
                        value={formState.category}
                        onChange={handleFormChange}
                        placeholder="General"
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-medium">
                      Difficulty
                      <select
                        name="difficulty"
                        value={formState.difficulty}
                        onChange={handleFormChange}
                        className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm ring-offset-white focus:outline-none focus:ring-2 focus:ring-zinc-950"
                      >
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                      </select>
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-medium">
                      Questions
                      <Input
                        name="totalQuestions"
                        type="number"
                        min={1}
                        value={formState.totalQuestions}
                        onChange={handleFormChange}
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-medium">
                      Time (sec/Q)
                      <Input
                        name="timePerQ"
                        type="number"
                        min={5}
                        value={formState.timePerQ}
                        onChange={handleFormChange}
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-medium">
                      Stake (SOL)
                      <Input
                        name="stakeAmount"
                        type="number"
                        min={0.01}
                        step="any"
                        value={formState.stakeAmount}
                        onChange={handleFormChange}
                      />
                    </label>
                  </div>

                  <div className="flex flex-col gap-3">
                    <Button
                      type="submit"
                      disabled={!connected || ensureStatus !== "ready" || createStatus === "loading"}
                      className="bg-zinc-900 text-white w-full sm:w-fit"
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
                      <p className="text-xs text-red-500">{createError}</p>
                    )}
                    {createDepositStatus === "error" && createDepositError && (
                      <p className="text-xs text-red-500">{createDepositError}</p>
                    )}
                    {createdInviteCode && createDepositStatus === "error" && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleRetryCreateDeposit}
                        className="w-full sm:w-fit"
                      >
                        Retry stake deposit
                      </Button>
                    )}
                    {createStatus === "success" && createdInviteCode && (
                      <div className="flex items-center gap-3 rounded-lg bg-emerald-50 p-3 border border-emerald-100">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-emerald-800">Room created and stake deposited!</p>
                          <p className="text-xs text-emerald-600">Code: <span className="font-bold">{createdInviteCode}</span></p>
                        </div>
                        <Link
                          href={`/room/${createdInviteCode}`}
                          className="inline-flex h-8 items-center rounded-md bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700"
                        >
                          Join Now
                        </Link>
                      </div>
                    )}
                  </div>
                </form>
              </CardContent>
            </Card>
          </section>

          <section className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Match History</h2>
              <Clock className="h-4 w-4 text-zinc-400" />
            </div>
            
            <div className="space-y-3">
              {isLoadingHistory ? (
                <div className="flex flex-col gap-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-24 w-full animate-pulse rounded-xl bg-zinc-100" />
                  ))}
                </div>
              ) : history.length > 0 ? (
                history.map((match) => {
                  const isWinner = match.winnerId === user?.id;
                  const myScore = match.players.find(p => p.userId === user?.id)?.score ?? 0;

                  return (
                    <Card key={match.id} className="border-zinc-200 overflow-hidden hover:border-zinc-300 transition-colors">
                      <div className="flex">
                        <div className={`w-1.5 ${match.status === 'FINISHED' ? (isWinner ? 'bg-emerald-500' : 'bg-red-500') : 'bg-amber-500'}`} />
                        <div className="flex-1 p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{match.inviteCode}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                              match.status === 'FINISHED' 
                                ? (isWinner ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700')
                                : 'bg-amber-100 text-amber-700'
                            }`}>
                              {match.status === 'FINISHED' ? (isWinner ? 'Victory' : 'Defeat') : match.status}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-y-2">
                            <div className="flex items-center text-xs text-zinc-600">
                              <Trophy className="mr-1.5 h-3 w-3" />
                              <span className="font-medium">{myScore} pts</span>
                            </div>
                            <div className="flex items-center text-xs text-zinc-600">
                              <Users className="mr-1.5 h-3 w-3" />
                              <span>{match.totalPlayers} Players</span>
                            </div>
                            <div className="flex items-center text-xs text-zinc-600">
                              <span className="mr-1.5">💰</span>
                              <span>{match.stakeAmount} SOL</span>
                            </div>
                            <div className="flex items-center text-xs text-zinc-400">
                              <Clock className="mr-1.5 h-3 w-3" />
                              <span>{new Date(match.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <Link 
                            href={`/room/${match.inviteCode}`}
                            className="mt-3 flex items-center text-xs font-semibold text-zinc-900 hover:underline"
                          >
                            View Details <ArrowRight className="ml-1 h-3 w-3" />
                          </Link>
                        </div>
                      </div>
                    </Card>
                  );
                })
              ) : (
                <div className="rounded-xl border border-dashed border-zinc-200 p-8 text-center">
                  <p className="text-sm text-zinc-500">No games played yet.</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

export default Home;
