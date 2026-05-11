"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Transaction } from "@solana/web3.js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Globe, Plus } from "lucide-react";
import {
  createJoinEscrowInstruction,
} from "@/lib/escrow";
import MatchCard from "@/components/ui/match-card";

type UserRecord = {
  id: string;
  wallet: string;
  username: string | null;
  createdAt: string;
};

type MatchEntry = {
  id: string;
  inviteCode: string;
  name: string | null;
  summary: string | null;
  status: string;
  stakeAmount: number;
  totalPlayers: number;
  questionCount: number;
  createdAt: string;
  winnerId: string | null;
  creator: { username: string | null; wallet: string };
  players: { userId: string; score: number; user: { username: string | null } }[];
};

type EnsureUserResponse =
  | { status: "SUCCESS"; data: { user: UserRecord } }
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

function Home() {
  const router = useRouter();
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const walletAddress = useMemo(
    () => publicKey?.toBase58() ?? "",
    [publicKey]
  );
  const [user, setUser] = useState<UserRecord | null>(null);
  const [mounted, setMounted] = useState(false);

  const [joinCodeDialogOpen, setJoinCodeDialogOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [joinRoom, setJoinRoom] = useState<RoomDetails | null>(null);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [joinDepositStatus, setJoinDepositStatus] = useState<
    "idle" | "loading" | "signing" | "confirming" | "confirmed" | "error"
  >("idle");
  const [joinDepositError, setJoinDepositError] = useState("");

  const [allMatches, setAllMatches] = useState<MatchEntry[]>([]);
  const [isLoadingAllMatches, setIsLoadingAllMatches] = useState(false);

  const fetchAllMatches = useCallback(async () => {
    setIsLoadingAllMatches(true);
    try {
      const res = await fetch(`/api/matches`);
      const data = await res.json();
      if (Array.isArray(data)) {
        // Filter out finished matches
        setAllMatches(data.filter(m => m.status !== 'FINISHED'));
      }
    } catch (e) {
      console.error("Failed to fetch all matches", e);
    } finally {
      setIsLoadingAllMatches(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
    fetchAllMatches();
  }, [fetchAllMatches]);

  useEffect(() => {
    if (!walletAddress) {
      queueMicrotask(() => {
        setUser(null);
        setJoinRoom(null);
        setJoinDialogOpen(false);
        setJoinCodeDialogOpen(false);
        setJoinDepositStatus("idle");
        setJoinDepositError("");
      });
      return;
    }

    let cancelled = false;

    const ensureUser = async () => {
      try {
        const response = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet: walletAddress }),
        });
        const data = (await response.json()) as EnsureUserResponse;

        if (!response.ok || data.status !== "SUCCESS") {
          throw new Error("Failed to ensure user");
        }

        if (!cancelled) {
          setUser(data.data.user);
        }
      } catch (error) {
        console.error(error);
      }
    };

    ensureUser();

    return () => {
      cancelled = true;
    };
  }, [walletAddress]);

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

  const handleJoinRoom = useCallback(
    async (event: FormEvent<HTMLFormElement> | string) => {
      if (typeof event !== 'string') {
        event.preventDefault();
      }
      setJoinError("");
      setJoinDepositError("");

      const codeToJoin = typeof event === 'string' ? event : joinCode;
      const trimmed = codeToJoin.trim().toUpperCase();
      
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
        setJoinCodeDialogOpen(false);
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
    if (!joinRoom || !publicKey) {
      return;
    }

    setJoinDepositError("");

    try {
      const instruction = createJoinEscrowInstruction({
        inviteCode: joinRoom.inviteCode,
        player: publicKey,
      });

      setJoinDepositStatus("signing");
      const transaction = new Transaction().add(instruction);
      const signature = await sendTransaction(transaction, connection);

      setJoinDepositStatus("confirming");
      await connection.confirmTransaction(signature, "confirmed");
      await recordDeposit(joinRoom.inviteCode, signature);

      setJoinDepositStatus("confirmed");
      router.push(`/room/${joinRoom.inviteCode}`);
    } catch (error) {
      setJoinDepositStatus("error");
      setJoinDepositError(
        error instanceof Error ? error.message : "Failed to deposit stake"
      );
    }
  }, [connection, joinRoom, publicKey, recordDeposit, router, sendTransaction]);

  if (!mounted) return null;

  return (
    <div className="flex flex-1 justify-center text-foreground min-h-screen">
      <main className="flex w-full max-w-6xl flex-col gap-10 px-6 py-24">
        <section className="flex gap-4">
          <Button 
            onClick={() => {
              setJoinCode("");
              setJoinError("");
              setJoinCodeDialogOpen(true);
            }} 
            className="h-12 px-8 font-bold text-lg"
          >
            Enter Invite Code
          </Button>
          <Link href="/new">
            <Button variant="outline" className="border-2 h-12 px-8 font-bold text-lg flex items-center gap-2">
              <Plus className="w-5 h-5" /> Create Room
            </Button>
          </Link>
        </section>

        <Dialog open={joinCodeDialogOpen} onOpenChange={setJoinCodeDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Enter Invite Code</DialogTitle>
            </DialogHeader>
            <form className="flex flex-col gap-4 mt-4" onSubmit={handleJoinRoom}>
              <Input
                value={joinCode}
                onChange={(event) => setJoinCode(event.target.value)}
                className="h-12 text-lg font-bold"
                placeholder="INVITE CODE (e.g. ABC123)"
                autoFocus
              />
              {joinError && <p className="text-xs text-destructive font-bold">{joinError}</p>}
              <Button type="submit" className="h-12 px-8 font-bold text-lg w-full" disabled={joinDepositStatus === "loading"}>
                {joinDepositStatus === "loading" ? "Loading..." : "Proceed"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Deposit stake to join</DialogTitle>
            </DialogHeader>
            {joinRoom && (
              <div className="space-y-4">
                <div className="rounded-lg border border-border p-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Room</span>
                    <span className="font-semibold">{joinRoom.inviteCode}</span>
                  </div>
                  <div className="mt-2 flex justify-between">
                    <span className="text-muted-foreground">Stake required</span>
                    <span className="font-semibold">{joinRoom.stakeAmount} SOL</span>
                  </div>
                  <div className="mt-2 flex justify-between">
                    <span className="text-muted-foreground">Questions</span>
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
                  className="w-full h-12 font-bold"
                >
                  {joinDepositStatus === "signing"
                    ? "Sign deposit..."
                    : joinDepositStatus === "confirming"
                      ? "Confirming..."
                      : `Deposit ${joinRoom.stakeAmount} SOL`}
                </Button>
                {joinDepositError && (
                  <p className="text-xs text-destructive">{joinDepositError}</p>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black flex items-center gap-2">
              <Globe className="h-6 w-6 text-muted-foreground" /> Public Matches
            </h2>
            <Button variant="ghost" size="sm" onClick={fetchAllMatches} disabled={isLoadingAllMatches}>
              Refresh
            </Button>
          </div>
          
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {isLoadingAllMatches ? (
              [1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-40 w-full animate-pulse rounded-2xl bg-muted" />
              ))
            ) : allMatches.length > 0 ? (
              allMatches.map((match) => (
                <MatchCard 
                  key={match.id} 
                  match={match} 
                  onJoin={handleJoinRoom} 
                />
              ))
            ) : (
              <div className="col-span-full rounded-2xl border border-dashed border-border p-12 text-center bg-card">
                <p className="text-sm text-muted-foreground font-medium">No public matches available.</p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default Home;