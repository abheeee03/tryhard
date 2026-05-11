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
import { Card } from "@/components/ui/card";
import { Globe, Plus } from "lucide-react";
import {
  createJoinEscrowInstruction,
} from "@/lib/escrow";
import UserDialog from "@/components/ui/user-dialog";
import Logo from "@/components/logo";
import { ConnectWallet } from "@/components/ui/connect-wallet";

type UserRecord = {
  id: string;
  wallet: string;
  username: string | null;
  createdAt: string;
};

type MatchEntry = {
  id: string;
  inviteCode: string;
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
    <div className="flex flex-1 justify-center text-zinc-900 min-h-screen">
      <nav className="fixed w-full flex items-center justify-between px-10 py-4 backdrop-blur-md z-50">
          <div className="flex gap-2 items-center justify-center text-lg font-bold">
          <Logo/> tryhard
          </div>
        <div className="">
          {
            walletAddress ? <UserDialog/> : <ConnectWallet />
          }
        </div>
      </nav>
      
      <main className="flex w-full max-w-6xl flex-col gap-10 px-6 py-24">
        <section className="flex gap-4">
          <Button 
            onClick={() => {
              setJoinCode("");
              setJoinError("");
              setJoinCodeDialogOpen(true);
            }} 
            className="bg-zinc-900 text-white h-12 px-8 font-bold text-lg"
          >
            Enter Invite Code
          </Button>
          <Link href="/new">
            <Button className="bg-zinc-100 text-zinc-900 border-2 border-zinc-900 hover:bg-zinc-200 h-12 px-8 font-bold text-lg flex items-center gap-2">
              <Plus className="w-5 h-5" /> Create Room
            </Button>
          </Link>
        </section>

        <Dialog open={joinCodeDialogOpen} onOpenChange={setJoinCodeDialogOpen}>
          <DialogContent className="bg-white">
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
              {joinError && <p className="text-xs text-red-500 font-bold">{joinError}</p>}
              <Button type="submit" className="bg-zinc-900 text-white h-12 px-8 font-bold text-lg w-full" disabled={joinDepositStatus === "loading"}>
                {joinDepositStatus === "loading" ? "Loading..." : "Proceed"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

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
                  className="w-full bg-zinc-900 text-white h-12 font-bold"
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

        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black flex items-center gap-2">
              <Globe className="h-6 w-6 text-zinc-400" /> Public Matches
            </h2>
            <Button variant="ghost" size="sm" onClick={fetchAllMatches} disabled={isLoadingAllMatches}>
              Refresh
            </Button>
          </div>
          
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {isLoadingAllMatches ? (
              [1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-40 w-full animate-pulse rounded-2xl bg-zinc-100" />
              ))
            ) : allMatches.length > 0 ? (
              allMatches.map((match) => (
                <Card key={match.id} className="border-zinc-200 overflow-hidden hover:border-zinc-400 transition-all group bg-white shadow-sm">
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex flex-col">
                          <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Invite Code</span>
                          <span className="text-lg font-black text-zinc-900">{match.inviteCode}</span>
                      </div>
                      <div className={`text-[10px] px-2.5 py-1 rounded-full font-black uppercase tracking-tighter ${
                        match.status === 'WAITING' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                        match.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                        'bg-zinc-100 text-zinc-600 border border-zinc-200'
                      }`}>
                        {match.status}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mb-5">
                      <div className="flex flex-col">
                          <span className="text-[9px] font-bold text-zinc-400 uppercase mb-1">Stake</span>
                          <span className="text-sm font-bold">{match.stakeAmount} SOL</span>
                      </div>
                      <div className="flex flex-col">
                          <span className="text-[9px] font-bold text-zinc-400 uppercase mb-1">Players</span>
                          <span className="text-sm font-bold">{match.players.length}/{match.totalPlayers}</span>
                      </div>
                    </div>

                    {match.status === 'WAITING' && (
                      <Button 
                          onClick={() => handleJoinRoom(match.inviteCode)}
                          className="w-full bg-zinc-900 text-white font-bold group-hover:bg-zinc-800 transition-colors"
                      >
                          Join Match
                      </Button>
                    )}
                    
                    {match.status !== 'WAITING' && (
                      <Link href={`/room/${match.inviteCode}`}>
                          <Button variant="outline" className="w-full font-bold">
                              View Details
                          </Button>
                      </Link>
                    )}
                  </div>
                </Card>
              ))
            ) : (
              <div className="col-span-full rounded-2xl border border-dashed border-zinc-200 p-12 text-center bg-white">
                <p className="text-sm text-zinc-500 font-medium">No public matches available.</p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default Home;