"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trophy, Clock, Users, ArrowRight, User, Settings2 } from "lucide-react";
import Logo from "@/components/logo";
import { ConnectWallet } from "@/components/ui/connect-wallet";
import UserDialog from "@/components/ui/user-dialog";

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

function UserProfile() {
  const { publicKey } = useWallet();
  const walletAddress = useMemo(() => publicKey?.toBase58() ?? "", [publicKey]);
  
  const [user, setUser] = useState<UserRecord | null>(null);
  const [history, setHistory] = useState<MatchEntry[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const [newUsername, setNewUsername] = useState("");
  const [isUpdatingUsername, setIsUpdatingUsername] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

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
        setIsEditMode(false);
      }
    } catch (e) {
      console.error("Update username failed", e);
    } finally {
      setIsUpdatingUsername(false);
    }
  };

  useEffect(() => {
    if (!walletAddress) {
      setUser(null);
      setHistory([]);
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
          fetchHistory(data.data.user.id);
        }
      } catch (error) {
        console.error(error);
      }
    };

    ensureUser();

    return () => {
      cancelled = true;
    };
  }, [fetchHistory, walletAddress]);

  return (
    <div className="flex flex-1 justify-center text-zinc-900 min-h-screen bg-zinc-50/50">
      <nav className="fixed w-full flex items-center justify-between px-10 py-4 backdrop-blur-md z-50 bg-white/80 border-b border-zinc-100">
          <div className="flex gap-2 items-center justify-center text-lg font-bold">
          <Link href="/home" className="flex gap-2 items-center"><Logo/> tryhard</Link>
          </div>
        <div className="">
          {
            walletAddress ? <UserDialog/> : <ConnectWallet />
          }
        </div>
      </nav>
      
      <main className="flex w-full max-w-4xl flex-col gap-10 px-6 py-24">
        {user && (
          <section>
             <Card className="border-zinc-200 shadow-sm bg-white overflow-hidden">
              <div className="h-32 bg-gradient-to-r from-zinc-900 to-zinc-700" />
              <CardContent className="relative pt-16 pb-8">
                <div className="absolute -top-12 left-8">
                  <div className="w-24 h-24 rounded-3xl bg-white p-1 shadow-xl">
                    <div className="w-full h-full rounded-2xl bg-zinc-900 flex items-center justify-center text-white text-3xl font-black">
                      {user.username ? user.username.slice(0, 2).toUpperCase() : walletAddress.slice(0, 2).toUpperCase()}
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-2">
                  <div className="space-y-1">
                    {isEditMode ? (
                      <div className="flex gap-2 items-center">
                        <Input 
                          value={newUsername}
                          onChange={(e) => setNewUsername(e.target.value)}
                          placeholder="New username"
                          className="h-10 font-bold text-xl w-48"
                        />
                        <Button onClick={handleUpdateUsername} disabled={isUpdatingUsername} size="sm">
                          {isUpdatingUsername ? "..." : "Save"}
                        </Button>
                        <Button variant="ghost" onClick={() => setIsEditMode(false)} size="sm">Cancel</Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-black tracking-tight">{user.username ?? "Anonymous Player"}</h1>
                        <Button variant="ghost" size="icon" onClick={() => {
                          setNewUsername(user.username ?? "");
                          setIsEditMode(true);
                        }} className="h-8 w-8 text-zinc-400 hover:text-zinc-900">
                          <Settings2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    <p className="text-sm font-mono text-zinc-400 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      {walletAddress}
                    </p>
                  </div>
                  
                  <div className="flex gap-8 border-l border-zinc-100 pl-8">
                    <div className="text-center">
                      <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest mb-1">Total Games</p>
                      <p className="text-2xl font-black">{history.length}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest mb-1">Victories</p>
                      <p className="text-2xl font-black text-emerald-600">
                        {history.filter(m => m.winnerId === user.id).length}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        <section className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-2xl font-black flex items-center gap-2">
              <Clock className="h-6 w-6 text-zinc-400" /> Your History
            </h2>
          </div>
          
          <div className="space-y-4">
            {isLoadingHistory ? (
              <div className="flex flex-col gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-28 w-full animate-pulse rounded-xl bg-zinc-100" />
                ))}
              </div>
            ) : history.length > 0 ? (
              history.map((match) => {
                const isWinner = match.winnerId === user?.id;
                const myScore = match.players.find(p => p.userId === user?.id)?.score ?? 0;

                return (
                  <Card key={match.id} className="border-zinc-200 overflow-hidden hover:border-zinc-300 transition-colors bg-white shadow-sm">
                    <div className="flex">
                      <div className="flex-1 p-5">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-black text-zinc-400 uppercase tracking-widest">{match.inviteCode}</span>
                          <span className={`text-xs px-3 py-1 rounded-full font-black uppercase tracking-tighter ${
                            match.status === 'FINISHED' 
                              ? (isWinner ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700')
                              : 'bg-amber-100 text-amber-700'
                          }`}>
                            {match.status === 'FINISHED' ? (isWinner ? 'Victory' : 'Defeat') : match.status}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-y-4">
                          <div className="flex items-center text-sm text-zinc-600 font-medium">
                            <Trophy className="mr-2 h-4 w-4 text-zinc-400" />
                            <span>{myScore} pts</span>
                          </div>
                          <div className="flex items-center text-sm text-zinc-600 font-medium">
                            <Users className="mr-2 h-4 w-4 text-zinc-400" />
                            <span>{match.players.length} Players</span>
                          </div>
                          <div className="flex items-center text-sm text-zinc-600 font-medium">
                            <span className="mr-2 text-zinc-400">💰</span>
                            <span>{match.stakeAmount} SOL</span>
                          </div>
                          <div className="flex items-center text-sm text-zinc-400">
                            <Clock className="mr-2 h-4 w-4" />
                            <span>{new Date(match.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <Link 
                          href={`/room/${match.inviteCode}`}
                          className="mt-4 inline-flex items-center text-xs font-black text-zinc-900 hover:underline uppercase tracking-widest"
                        >
                          View Details <ArrowRight className="ml-1.5 h-4 w-4" />
                        </Link>
                      </div>
                    </div>
                  </Card>
                );
              })
            ) : (
              <div className="rounded-xl border border-dashed border-zinc-200 p-12 text-center bg-white">
                <p className="text-sm text-zinc-500 font-medium">No games played yet.</p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default UserProfile;