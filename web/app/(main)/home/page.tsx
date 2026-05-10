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
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Settings2, Trophy, Clock, Users, ArrowRight, Plus, Globe } from "lucide-react";
import {
  createJoinEscrowInstruction,
  solToLamports,
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
  const [history, setHistory] = useState<MatchEntry[]>([]);
  const [allMatches, setAllMatches] = useState<MatchEntry[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isLoadingAllMatches, setIsLoadingAllMatches] = useState(false);

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

  const fetchAllMatches = useCallback(async () => {
    setIsLoadingAllMatches(true);
    try {
      const res = await fetch(`/api/matches`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setAllMatches(data);
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
        setEnsureStatus("idle");
        setEnsureError("");
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

  return (
    <div className="flex flex-1 justify-center bg-zinc-50 text-zinc-900 min-h-screen">
      <nav className="fixed w-full flex items-center justify-between px-10 py-4 bg-white/80 backdrop-blur-md z-50 border-b border-zinc-200">
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
        <section className="grid gap-6 sm:grid-cols-3">
          <Card className="col-span-1 border-zinc-200 shadow-sm bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                User Profile
              </CardTitle>
            </CardHeader>
            <CardContent>
              {ensureStatus === "ready" && user ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-base font-bold">{user.username || "Anonymous"}</p>
                    <p className="text-[10px] text-zinc-400 font-mono truncate bg-zinc-50 p-1.5 rounded border border-zinc-100 mt-1">{user.wallet}</p>
                  </div>
                  <Dialog>
                    <Button variant="outline" size="sm" className="w-full text-xs font-bold" asChild>
                        <Link href="#">
                            <Settings2 className="mr-2 h-3.5 w-3.5" />
                            Edit Username
                        </Link>
                    </Button>
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
                  <p className="text-sm text-zinc-500 font-medium">
                    {connected ? "Syncing profile..." : "Connect wallet to view profile."}
                  </p>
                  {ensureStatus === "error" && (
                    <p className="text-xs text-red-500">{ensureError}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="col-span-1 border-zinc-200 shadow-sm sm:col-span-2 bg-white">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                Join a Room
              </CardTitle>
              <Link href="/new">
                <Button size="sm" className="bg-zinc-900 text-white font-bold rounded-lg px-4">
                  <Plus className="mr-2 h-4 w-4" /> Create Room
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <form className="flex gap-3" onSubmit={handleJoinRoom}>
                <Input
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value)}
                  className="flex-1 h-12 text-lg font-bold"
                  placeholder="INVITE CODE (e.g. ABC123)"
                />
                <Button type="submit" className="bg-zinc-900 text-white h-12 px-8 font-bold text-lg">
                  {joinDepositStatus === "loading" ? "..." : "Join"}
                </Button>
              </form>
              {joinError && <p className="mt-2 text-xs text-red-500 font-bold">{joinError}</p>}
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
            </CardContent>
          </Card>
        </section>

        <div className="grid gap-10 lg:grid-cols-5">
          <section className="lg:col-span-3 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black flex items-center gap-2">
                <Globe className="h-6 w-6 text-zinc-400" /> Public Matches
              </h2>
              <Button variant="ghost" size="sm" onClick={fetchAllMatches} disabled={isLoadingAllMatches}>
                Refresh
              </Button>
            </div>
            
            <div className="grid gap-4 sm:grid-cols-2">
              {isLoadingAllMatches ? (
                [1, 2, 3, 4].map((i) => (
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

          <section className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Clock className="h-5 w-5 text-zinc-400" /> Your History
              </h2>
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
                    <Card key={match.id} className="border-zinc-200 overflow-hidden hover:border-zinc-300 transition-colors bg-white shadow-sm">
                      <div className="flex">
                        <div className={`w-1.5 ${match.status === 'FINISHED' ? (isWinner ? 'bg-emerald-500' : 'bg-red-500') : 'bg-amber-500'}`} />
                        <div className="flex-1 p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-black text-zinc-400 uppercase tracking-widest">{match.inviteCode}</span>
                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-tighter ${
                              match.status === 'FINISHED' 
                                ? (isWinner ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700')
                                : 'bg-amber-100 text-amber-700'
                            }`}>
                              {match.status === 'FINISHED' ? (isWinner ? 'Victory' : 'Defeat') : match.status}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-y-2">
                            <div className="flex items-center text-xs text-zinc-600 font-medium">
                              <Trophy className="mr-1.5 h-3 w-3" />
                              <span>{myScore} pts</span>
                            </div>
                            <div className="flex items-center text-xs text-zinc-600 font-medium">
                              <Users className="mr-1.5 h-3 w-3" />
                              <span>{match.players.length} Players</span>
                            </div>
                            <div className="flex items-center text-xs text-zinc-600 font-medium">
                              <span className="mr-1.5 text-[10px]">💰</span>
                              <span>{match.stakeAmount} SOL</span>
                            </div>
                            <div className="flex items-center text-xs text-zinc-400">
                              <Clock className="mr-1.5 h-3 w-3" />
                              <span>{new Date(match.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <Link 
                            href={`/room/${match.inviteCode}`}
                            className="mt-3 flex items-center text-[10px] font-black text-zinc-900 hover:underline uppercase tracking-widest"
                          >
                            View Details <ArrowRight className="ml-1 h-3 w-3" />
                          </Link>
                        </div>
                      </div>
                    </Card>
                  );
                })
              ) : (
                <div className="rounded-xl border border-dashed border-zinc-200 p-8 text-center bg-white">
                  <p className="text-xs text-zinc-500 font-medium">No games played yet.</p>
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
