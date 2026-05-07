"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

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
  | { status: "SUCCESS"; data: { match: { id: string; inviteCode: string } } }
  | { status: "FAILED"; error: string };

const DEFAULT_FORM = {
  category: "General",
  difficulty: "easy",
  totalQuestions: "10",
  timePerQ: "20",
  stakeAmount: "0",
  totalPlayers: "2",
};

function Home() {
  const router = useRouter();
  const { publicKey, connected } = useWallet();
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
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState("");

  useEffect(() => {
    setMounted(true);
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
  }, [walletAddress]);

  const handleFormChange = useCallback(
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { name, value } = event.target;
      setFormState((prev) => ({ ...prev, [name]: value }));
    },
    []
  );

  const handleCreateRoom = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      setCreateStatus("loading");
      setCreateError("");
      setCreatedInviteCode(null);

      if (!walletAddress) {
        setCreateStatus("error");
        setCreateError("Connect a wallet to create a room.");
        return;
      }

      const totalQuestions = Number(formState.totalQuestions);
      const timePerQ = Number(formState.timePerQ);
      const stakeAmount = Number(formState.stakeAmount);
      const totalPlayers = Number(formState.totalPlayers);

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

      if (!Number.isFinite(stakeAmount) || stakeAmount < 0) {
        setCreateStatus("error");
        setCreateError("Stake amount must be zero or more.");
        return;
      }

      if (!Number.isFinite(totalPlayers) || totalPlayers <= 0) {
        setCreateStatus("error");
        setCreateError("Total players must be a positive number.");
        return;
      }

      const payload = {
        time_per_que: timePerQ,
        total_questions: totalQuestions,
        stake_amount: stakeAmount,
        category: formState.category.trim() || undefined,
        difficulty: formState.difficulty.trim() || undefined,
        player1_wallet: walletAddress,
        total_players: totalPlayers,
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

        setCreatedInviteCode(data.data.match.inviteCode);
        setCreateStatus("success");
      } catch (error) {
        setCreateStatus("error");
        setCreateError(
          error instanceof Error ? error.message : "Failed to create match"
        );
      }
    },
    [formState, user?.id, walletAddress]
  );

  const handleJoinRoom = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setJoinError("");

      const trimmed = joinCode.trim().toUpperCase();
      if (!trimmed) {
        setJoinError("Enter an invite code.");
        return;
      }

      router.push(`/room/${trimmed}`);
    },
    [joinCode, router]
  );

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 text-zinc-900">
      <main className="flex w-full max-w-5xl flex-col gap-10 px-6 py-12">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
              Tryhard Arena
            </p>
            <h1 className="text-3xl font-semibold">Create a new room</h1>
            <p className="max-w-xl text-sm text-zinc-600">
              Connect your wallet to reserve a username, then set up a new quiz
              room for your friends.
            </p>
          </div>
          {mounted && <WalletMultiButton />}
        </header>

        <section className="grid gap-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:grid-cols-2">
          <div className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Wallet status
            </h2>
            <p className="text-base font-medium">
              {connected ? "Connected" : "Not connected"}
            </p>
            <p className="text-xs text-zinc-500">
              {walletAddress || "Connect a wallet to continue."}
            </p>
          </div>
          <div className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              User profile
            </h2>
            {ensureStatus === "loading" && (
              <p className="text-sm text-zinc-500">Syncing username...</p>
            )}
            {ensureStatus === "error" && (
              <p className="text-sm text-red-500">{ensureError}</p>
            )}
            {ensureStatus === "ready" && user && (
              <div className="space-y-1">
                <p className="text-base font-medium">{user.username}</p>
                <p className="text-xs text-zinc-500">User id: {user.id}</p>
              </div>
            )}
            {ensureStatus === "idle" && (
              <p className="text-sm text-zinc-500">Awaiting wallet connection.</p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Join a room</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Enter an invite code to jump into an existing game.
          </p>
          <form className="mt-6 flex flex-col gap-3 sm:flex-row" onSubmit={handleJoinRoom}>
            <input
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value)}
              className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              placeholder="INVITE CODE"
            />
            <button
              type="submit"
              className="inline-flex h-11 items-center justify-center rounded-lg bg-zinc-900 px-6 text-sm font-semibold text-white"
            >
              Join room
            </button>
          </form>
          {joinError && <p className="mt-2 text-sm text-red-500">{joinError}</p>}
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Room details</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Customize the quiz rules and generate an invite code.
          </p>

          <form className="mt-6 grid gap-4" onSubmit={handleCreateRoom}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-medium">
                Category
                <input
                  name="category"
                  value={formState.category}
                  onChange={handleFormChange}
                  className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                  placeholder="General"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">
                Difficulty
                <select
                  name="difficulty"
                  value={formState.difficulty}
                  onChange={handleFormChange}
                  className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">
                Total questions
                <input
                  name="totalQuestions"
                  type="number"
                  min={1}
                  value={formState.totalQuestions}
                  onChange={handleFormChange}
                  className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">
                Time per question (sec)
                <input
                  name="timePerQ"
                  type="number"
                  min={5}
                  value={formState.timePerQ}
                  onChange={handleFormChange}
                  className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">
                Stake amount
                <input
                  name="stakeAmount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={formState.stakeAmount}
                  onChange={handleFormChange}
                  className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">
                Total players
                <input
                  name="totalPlayers"
                  type="number"
                  min={2}
                  value={formState.totalPlayers}
                  onChange={handleFormChange}
                  className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                />
              </label>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="submit"
                disabled={!connected || ensureStatus !== "ready"}
                className="inline-flex h-11 items-center justify-center rounded-lg bg-zinc-900 px-6 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-zinc-300"
              >
                {createStatus === "loading" ? "Creating..." : "Create room"}
              </button>
              {createStatus === "error" && (
                <p className="text-sm text-red-500">{createError}</p>
              )}
              {createStatus === "success" && createdInviteCode && (
                <div className="flex flex-col gap-2 text-sm text-emerald-600">
                  <p>Invite code: {createdInviteCode}</p>
                  <Link
                    href={`/room/${createdInviteCode}`}
                    className="inline-flex w-fit items-center rounded-full border border-emerald-200 px-4 py-1 text-xs font-semibold text-emerald-700"
                  >
                    Open room
                  </Link>
                </div>
              )}
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}

export default Home;
