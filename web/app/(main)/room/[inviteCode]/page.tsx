"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Transaction } from "@solana/web3.js";
import type { Socket } from "socket.io-client";
import { io } from "socket.io-client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  createInitializeEscrowInstruction,
  createJoinEscrowInstruction,
  getBackendAuthorityPublicKey,
  solToLamports,
} from "@/lib/escrow";
import { Trophy, Crown, Medal } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type UserRecord = {
  id: string;
  wallet: string;
  username: string | null;
};

type RoomInfo = {
  inviteCode: string;
  status: string;
  totalPlayers: number;
  currentPlayers: number;
  questionCount: number;
  timePerQ: number;
  stakeAmount: number;
  creatorId: string;
  winnerId?: string | null;
  depositedPlayers?: {
    userId: string;
    wallet: string;
    username: string | null;
    amount: number;
    signature: string | null;
  }[];
};

type JoinRoomResponse =
  | { ok: true; data: { room: RoomInfo; user: UserRecord } }
  | { ok: false; error: string };

type QuestionPayload = {
  id: string;
  index: number;
  question: string;
  options: string[];
  endsAt: number;
  nextStartsAt: number | null;
  totalQuestions: number;
};

type IntermissionPayload = {
  nextIndex: number;
  startsAt: number | null;
};

type UserAnswerDetail = {
  questionId: string;
  selected: string;
  isCorrect: boolean;
};

type ScoreEntry = {
  userId: string;
  username: string | null;
  wallet: string;
  score: number;
  answers: UserAnswerDetail[];
};

type FinishedPayload = {
  endedAt: number;
  winners: ScoreEntry[];
  leaderboard: ScoreEntry[];
};

type AnswerResponse =
  | { ok: true; data?: { correct: boolean; score: number } }
  | { ok: false; error: string };

type EnsureUserResponse =
  | { status: "SUCCESS"; data: { user: UserRecord } }
  | { status: "FAILED"; error: string };

type RoomDetailsResponse =
  | {
      status: "SUCCESS";
      data: {
        match: RoomInfo;
        userDeposit: { deposited: boolean; signature?: string; amount?: number };
      };
    }
  | { status: "FAILED"; error: string };

type DepositResponse =
  | { status: "SUCCESS"; data: unknown }
  | { status: "FAILED"; error: string };

const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? "http://localhost:8080";

export default function RoomPage() {
  const { connection } = useConnection();
  const { publicKey, connected, sendTransaction } = useWallet();
  const socketRef = useRef<Socket | null>(null);
  const params = useParams();
  const walletAddress = useMemo(
    () => publicKey?.toBase58() ?? "",
    [publicKey]
  );
  const inviteCode = useMemo(() => {
    const rawParam = params.inviteCode;
    const value = Array.isArray(rawParam)
      ? rawParam[0]
      : rawParam ?? "";
    return value.trim().toUpperCase();
  }, [params.inviteCode]);

  const [user, setUser] = useState<UserRecord | null>(null);
  const [mounted, setMounted] = useState(false);
  const [ensureStatus, setEnsureStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [ensureError, setEnsureError] = useState("");

  const [joinStatus, setJoinStatus] = useState<
    "idle" | "joining" | "joined" | "error"
  >("idle");
  const [joinError, setJoinError] = useState("");
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [depositStatus, setDepositStatus] = useState<
    "idle" | "loading" | "required" | "signing" | "confirming" | "confirmed" | "error"
  >("idle");
  const [depositError, setDepositError] = useState("");
  const [depositSignature, setDepositSignature] = useState<string | null>(null);

  const [phase, setPhase] = useState<
    "waiting" | "starting" | "question" | "intermission" | "finished"
  >("waiting");
  const [startsAt, setStartsAt] = useState<number | null>(null);
  const [question, setQuestion] = useState<QuestionPayload | null>(null);
  const [intermission, setIntermission] = useState<IntermissionPayload | null>(
    null
  );
  const [timeLeftMs, setTimeLeftMs] = useState<number | null>(null);
  const [countdownMs, setCountdownMs] = useState<number | null>(null);

  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [answerFeedback, setAnswerFeedback] = useState<string | null>(null);
  const [startError, setStartError] = useState("");

  const [leaderboard, setLeaderboard] = useState<ScoreEntry[]>([]);
  const [winners, setWinners] = useState<ScoreEntry[]>([]);

  const isCreator = room?.creatorId && user?.id === room.creatorId;

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  useEffect(() => {
    if (!walletAddress) {
      queueMicrotask(() => {
        setUser(null);
        setEnsureStatus("idle");
        setEnsureError("");
        setDepositStatus("idle");
        setDepositError("");
        setDepositSignature(null);
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
            data.status === "FAILED" ? data.error : "Failed to ensure user";
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

  useEffect(() => {
    if (!connected || !user?.id || !walletAddress || !inviteCode) {
      return;
    }

    let cancelled = false;

    const fetchRoomDetails = async () => {
      setDepositStatus("loading");
      setDepositError("");

      try {
        const response = await fetch(
          `/api/matches/${inviteCode}?userId=${user.id}&wallet=${walletAddress}`
        );
        const data = (await response.json()) as RoomDetailsResponse;

        if (!response.ok || data.status !== "SUCCESS") {
          throw new Error(
            data.status === "FAILED" ? data.error : "Failed to load room"
          );
        }

        if (!cancelled) {
          setRoom(data.data.match);
          if (data.data.match.status === 'FINISHED') {
            setPhase('finished');
          }
          if (data.data.userDeposit.deposited) {
            setDepositStatus("confirmed");
            setDepositSignature(data.data.userDeposit.signature ?? null);
          } else {
            setDepositStatus("required");
          }
        }
      } catch (error) {
        if (!cancelled) {
          setDepositStatus("error");
          setDepositError(
            error instanceof Error ? error.message : "Failed to load deposit"
          );
        }
      }
    };

    fetchRoomDetails();

    return () => {
      cancelled = true;
    };
  }, [connected, inviteCode, user?.id, walletAddress]);

  useEffect(() => {
    if (
      !connected ||
      !user?.id ||
      !walletAddress ||
      !inviteCode ||
      depositStatus !== "confirmed" ||
      room?.status === 'FINISHED'
    ) {
      queueMicrotask(() => {
        setJoinStatus("idle");
        setJoinError("");
      });
      return;
    }

    queueMicrotask(() => {
      setJoinStatus("joining");
      setJoinError("");
    });

    const socket = io(wsUrl, { transports: ["websocket"] });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit(
        "room:join",
        { inviteCode, wallet: walletAddress, userId: user.id },
        (response: JoinRoomResponse) => {
          if (!response.ok) {
            setJoinStatus("error");
            setJoinError(response.error ?? "Failed to join room");
            return;
          }

          setJoinStatus("joined");
          setRoom(response.data.room);
          if (response.data.room.status === 'FINISHED') {
             setPhase('finished');
          } else {
            setPhase("waiting");
          }
        }
      );
    });

    socket.on("room:starting", (payload: { startsAt: number }) => {
      setPhase("starting");
      setStartsAt(payload.startsAt);
      setIntermission(null);
      setQuestion(null);
      setAnswerFeedback(null);
    });

    socket.on(
      "room:player-joined",
      (payload: { room?: RoomInfo; currentPlayers?: number }) => {
        if (payload.room) {
          setRoom(payload.room);
          return;
        }

        if (typeof payload.currentPlayers === "number") {
          setRoom((prev) =>
            prev ? { ...prev, currentPlayers: payload.currentPlayers ?? 0 } : prev
          );
        }
      }
    );

    socket.on("room:question", (payload: QuestionPayload) => {
      setPhase("question");
      setQuestion(payload);
      setSelectedAnswer(null);
      setAnswerFeedback(null);
      setStartsAt(null);
      setIntermission(null);
    });

    socket.on("room:intermission", (payload: IntermissionPayload) => {
      setPhase("intermission");
      setIntermission(payload);
      setStartsAt(payload.startsAt ?? null);
      setQuestion(null);
      setSelectedAnswer(null);
      setAnswerFeedback(null);
    });

    socket.on("room:finished", (payload: FinishedPayload) => {
      setPhase("finished");
      setLeaderboard(payload.leaderboard ?? []);
      setWinners(payload.winners ?? []);
      setQuestion(null);
      setStartsAt(null);
      setIntermission(null);
      setTimeLeftMs(null);
      setCountdownMs(null);
    });

    socket.on("disconnect", () => {
      setJoinStatus("error");
      setJoinError("Disconnected from the server.");
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [connected, user?.id, walletAddress, inviteCode, depositStatus, room?.status]);

  useEffect(() => {
    if (!question?.endsAt) {
      queueMicrotask(() => {
        setTimeLeftMs(null);
      });
      return;
    }

    const update = () => {
      const remaining = question.endsAt - Date.now();
      setTimeLeftMs(Math.max(0, remaining));
    };

    update();
    const timer = setInterval(update, 250);
    return () => clearInterval(timer);
  }, [question?.endsAt]);

  useEffect(() => {
    if (!startsAt) {
      queueMicrotask(() => {
        setCountdownMs(null);
      });
      return;
    }

    const update = () => {
      const remaining = startsAt - Date.now();
      setCountdownMs(Math.max(0, remaining));
    };

    update();
    const timer = setInterval(update, 250);
    return () => clearInterval(timer);
  }, [startsAt]);

  const handleDeposit = useCallback(async () => {
    if (!room || !publicKey || !walletAddress || !user?.id) {
      setDepositError("Connect a wallet before depositing.");
      return;
    }

    setDepositError("");

    try {
      const stakeLamports = solToLamports(room.stakeAmount);
      const instruction =
        user.id === room.creatorId
          ? createInitializeEscrowInstruction({
              inviteCode: room.inviteCode,
              player: publicKey,
              stakeLamports,
              backendAuthority: getBackendAuthorityPublicKey(),
            })
          : createJoinEscrowInstruction({
              inviteCode: room.inviteCode,
              player: publicKey,
            });

      setDepositStatus("signing");
      const transaction = new Transaction().add(instruction);
      const signature = await sendTransaction(transaction, connection);

      setDepositStatus("confirming");
      await connection.confirmTransaction(signature, "confirmed");

      const response = await fetch("/api/deposits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inviteCode: room.inviteCode,
          userId: user.id,
          wallet: walletAddress,
          signature,
        }),
      });
      const data = (await response.json()) as DepositResponse;

      if (!response.ok || data.status !== "SUCCESS") {
        throw new Error(
          data.status === "FAILED" ? data.error : "Failed to record deposit"
        );
      }

      setDepositSignature(signature);
      setDepositStatus("confirmed");
    } catch (error) {
      setDepositStatus("error");
      setDepositError(
        error instanceof Error ? error.message : "Failed to deposit stake"
      );
    }
  }, [connection, publicKey, room, sendTransaction, user, walletAddress]);

  const handleStart = useCallback(() => {
    setStartError("");

    const socket = socketRef.current;
    if (!socket) {
      setStartError("Socket not connected.");
      return;
    }

    socket.emit(
      "room:start",
      { inviteCode },
      (response: { ok: boolean; error?: string }) => {
        if (!response.ok) {
          setStartError(response.error ?? "Failed to start room");
        }
      }
    );
  }, [inviteCode]);

  const handleAnswer = useCallback(
    (option: string) => {
      if (!question || selectedAnswer) {
        return;
      }

      setSelectedAnswer(option);
      setAnswerFeedback(null);

      const socket = socketRef.current;
      if (!socket) {
        setAnswerFeedback("Socket not connected.");
        return;
      }

      socket.emit(
        "room:answer",
        { questionId: question.id, answer: option },
        (response: AnswerResponse) => {
          if (!response.ok) {
            setAnswerFeedback(response.error ?? "Answer rejected");
            return;
          }

          setAnswerFeedback("Answer submitted");
        }
      );
    },
    [question, selectedAnswer]
  );

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground pt-16">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-6 py-4 bg-card/50 backdrop-blur-sm">
        <div className="space-y-1">
          <Link href="/home" className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground hover:text-foreground transition-colors font-black">
            Tryhard Arena
          </Link>
          <h1 className="text-xl font-black">Room {inviteCode}</h1>
          <p className="text-xs font-bold text-muted-foreground">
            Stake: {room?.stakeAmount ?? 0} SOL
          </p>
        </div>
      </header>

      {connected && user && room && depositStatus !== "confirmed" && room.status !== 'FINISHED' && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 px-4 backdrop-blur-sm">
          <Card className="w-full max-w-md border-border bg-card p-6 text-foreground shadow-2xl">
            <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-black">
              Stake required
            </p>
            <h2 className="mt-2 text-xl font-black">
              Deposit {room.stakeAmount} SOL to enter
            </h2>
            <div className="mt-4 space-y-2 rounded-xl border border-border bg-muted/50 p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground font-medium">Room</span>
                <span className="font-bold">{room.inviteCode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground font-medium">Players</span>
                <span className="font-bold">{room.currentPlayers}/{room.totalPlayers}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground font-medium">Role</span>
                <span className="font-bold">{isCreator ? "Creator" : "Player 2"}</span>
              </div>
            </div>
            <Button
              type="button"
              onClick={handleDeposit}
              disabled={
                depositStatus === "loading" ||
                depositStatus === "signing" ||
                depositStatus === "confirming"
              }
              className="mt-6 w-full h-12 font-black uppercase tracking-widest"
            >
              {depositStatus === "loading"
                ? "Loading room..."
                : depositStatus === "signing"
                  ? "Sign deposit..."
                  : depositStatus === "confirming"
                    ? "Confirming..."
                    : "Deposit stake"}
            </Button>
            {depositError && (
              <p className="mt-3 text-xs text-destructive font-bold">{depositError}</p>
            )}
          </Card>
        </div>
      )}

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
        <section className="rounded-2xl border border-border bg-card/30 p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Wallet</p>
              <p className="text-base font-bold">
                {connected ? "Connected" : "Not connected"}
              </p>
              <p className="text-xs font-mono text-muted-foreground/60">
                {walletAddress || "Connect a wallet to join the room."}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">User</p>
              <p className="text-base font-bold">
                {user?.username ?? "-"}
              </p>
              {ensureStatus === "error" && (
                <p className="text-xs text-destructive">{ensureError}</p>
              )}
            </div>
            <div>
              <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Status</p>
              <p className="text-base font-bold capitalize">{joinStatus}</p>
              {joinError && <p className="text-xs text-destructive">{joinError}</p>}
            </div>
            <div>
              <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Deposit</p>
              <p className="text-base font-bold capitalize">{depositStatus}</p>
              {depositSignature && (
                <p className="max-w-36 truncate text-xs font-mono text-muted-foreground/60">
                  {depositSignature}
                </p>
              )}
            </div>
            <div>
              <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Players</p>
              <p className="text-base font-bold">
                {room ? `${room.currentPlayers}/${room.totalPlayers}` : "-"}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-card p-8 min-h-[450px] flex flex-col shadow-lg">
          {phase === "waiting" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-black">Waiting for players</h2>
                <p className="text-sm text-muted-foreground font-medium">
                  Room is ready. The creator can start the game once everyone is
                  in and both deposits are confirmed.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {Array.from({ length: room?.totalPlayers ?? 2 }, (_, index) => {
                  const deposit = room?.depositedPlayers?.[index];
                  return (
                    <div
                      key={deposit?.userId ?? index}
                      className="rounded-2xl border border-border bg-muted/30 p-5"
                    >
                      <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-black">
                        Player {index + 1}
                      </p>
                      <p className="mt-2 truncate text-base font-black">
                        {deposit?.username ?? deposit?.wallet ?? "Waiting"}
                      </p>
                      <p
                        className={`mt-2 text-xs font-bold ${
                          deposit ? "text-emerald-500" : "text-amber-500"
                        }`}
                      >
                        {deposit ? "● Deposit confirmed" : "○ Deposit pending"}
                      </p>
                    </div>
                  );
                })}
              </div>
              {isCreator && (
                <div className="flex flex-col gap-2 pt-4">
                  <Button
                    type="button"
                    onClick={handleStart}
                    className="h-12 w-fit px-10 font-black uppercase tracking-widest"
                  >
                    Start game
                  </Button>
                  {startError && (
                    <p className="text-xs text-destructive font-bold">{startError}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {phase === "starting" && (
            <div className="space-y-3 flex flex-col items-center justify-center flex-1">
              <div className="w-16 h-16 rounded-full border-4 border-muted border-t-primary animate-spin mb-6" />
              <h2 className="text-4xl font-black tracking-tighter">GET READY</h2>
              <p className="text-2xl text-muted-foreground font-mono font-black">
                {Math.ceil((countdownMs ?? 0) / 1000)}s
              </p>
            </div>
          )}

          {phase === "intermission" && (
            <div className="space-y-3 flex flex-col items-center justify-center flex-1 text-center">
              <h2 className="text-xl font-black text-muted-foreground uppercase tracking-[0.3em]">Next question in</h2>
              <p className="text-6xl font-black font-mono tracking-tighter mt-2">
                {Math.ceil((countdownMs ?? 0) / 1000)}s
              </p>
              {intermission?.nextIndex !== undefined && room && (
                <div className="mt-8 px-4 py-2 rounded-full bg-muted border border-border text-[10px] font-black uppercase tracking-widest">
                  Question {intermission.nextIndex + 1} of {room.questionCount}
                </div>
              )}
            </div>
          )}

          {phase === "question" && question && (
            <div className="space-y-8 flex-1 flex flex-col justify-center">
              <div className="flex items-center justify-between gap-6">
                <div className="flex-1">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-primary font-black">
                    Question {question.index + 1} of {question.totalQuestions}
                  </p>
                  <h2 className="mt-4 text-3xl font-black leading-tight tracking-tight">
                    {question.question}
                  </h2>
                </div>
                <div className="flex-shrink-0 w-24 h-24 rounded-full border-4 border-muted flex items-center justify-center text-3xl font-black font-mono shadow-inner bg-muted/20">
                  {Math.ceil((timeLeftMs ?? 0) / 1000)}
                </div>
              </div>

              <div className="grid gap-4 mt-8 sm:grid-cols-2">
                {question.options.map((option) => {
                  const isSelected = selectedAnswer === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => handleAnswer(option)}
                      disabled={Boolean(selectedAnswer)}
                      className={`rounded-2xl border-2 px-6 py-5 text-left text-lg font-black transition-all transform active:scale-[0.98] ${
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02]"
                          : "border-border bg-muted/30 text-foreground hover:border-primary/40 hover:bg-muted/50"
                      }`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>

              {answerFeedback && (
                <div className="mt-6 p-4 rounded-2xl bg-muted border border-border text-center animate-pulse">
                    <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                    {answerFeedback}
                    </p>
                </div>
              )}
            </div>
          )}

          {phase === "finished" && (
            <div className="space-y-8 flex-1 flex flex-col py-4">
              <div className="text-center space-y-4">
                <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-amber-500/10 border-2 border-amber-500/20 mb-2 rotate-3 shadow-xl">
                    <Trophy className="w-12 h-12 text-amber-500" />
                </div>
                <h2 className="text-5xl font-black tracking-tighter">MATCH FINISHED</h2>
                
                <div className="flex flex-col items-center gap-4 pt-4">
                    {winners.length > 0 ? (
                        <div className="flex flex-wrap justify-center gap-6">
                            {winners.map((winner, idx) => (
                                <div key={idx} className="flex items-center gap-4 bg-foreground text-background px-8 py-4 rounded-2xl shadow-2xl scale-110">
                                    <Crown className="w-8 h-8 text-amber-500" />
                                    <div className="text-left">
                                        <p className="text-[10px] font-black uppercase leading-none opacity-60">Winner</p>
                                        <p className="text-xl font-black leading-tight truncate max-w-[180px]">
                                            {winner.username ?? winner.wallet.slice(0, 8)}
                                        </p>
                                    </div>
                                    <div className="ml-2 pl-6 border-l border-background/20">
                                        <p className="text-[10px] font-black uppercase leading-none opacity-60">Score</p>
                                        <p className="text-xl font-black leading-tight">{winner.score}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : room?.winnerId ? (
                         <div className="flex items-center gap-4 bg-foreground text-background px-8 py-4 rounded-2xl shadow-xl">
                            <Crown className="w-8 h-8 text-amber-500" />
                            <div className="text-left">
                                <p className="text-[10px] font-black uppercase leading-none opacity-60">Winner Found</p>
                                <p className="text-xl font-black leading-tight">Match Closed</p>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-muted border border-border px-8 py-4 rounded-2xl">
                            <p className="text-sm font-bold text-muted-foreground italic text-center">Finalizing results...</p>
                        </div>
                    )}
                </div>
              </div>

              {leaderboard.length > 0 && (
                <div className="space-y-6 mt-12">
                  <p className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground font-black text-center">Final Standings</p>
                  <div className="grid gap-4 max-w-2xl mx-auto w-full">
                    {leaderboard.map((entry, idx) => (
                      <div
                        key={entry.userId}
                        className={`rounded-2xl border transition-all ${
                          entry.userId === user?.id 
                            ? "bg-muted/50 border-primary shadow-lg scale-[1.02]" 
                            : "bg-muted/20 border-border"
                        } p-6`}
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-5">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-black ${
                                idx === 0 ? "bg-amber-500 text-amber-950" : "bg-muted text-foreground"
                            }`}>
                                {idx + 1}
                            </div>
                            <div>
                                <p className="text-xl font-black flex items-center gap-3">
                                    {entry.username ?? entry.wallet.slice(0, 12)}
                                    {entry.userId === user?.id && <span className="text-[10px] bg-primary text-primary-foreground px-2 py-0.5 rounded-full uppercase tracking-widest font-black">You</span>}
                                </p>
                                <p className="text-xs font-mono text-muted-foreground">{entry.wallet.slice(0, 24)}...</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-4xl font-black tracking-tighter">{entry.score}</p>
                            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Points</p>
                          </div>
                        </div>
                        
                        <div className="flex flex-wrap gap-2 pt-6 border-t border-border/50">
                          {entry.answers?.map((ans, ansIdx) => (
                            <div
                              key={ansIdx}
                              className={`flex flex-col items-center justify-center min-w-[70px] rounded-xl px-3 py-2 text-[10px] uppercase tracking-tighter border transition-all ${
                                ans.isCorrect
                                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400"
                                  : "bg-destructive/10 text-destructive border-destructive/20"
                              }`}
                            >
                              <span className="opacity-50 font-black mb-1">Q{ansIdx + 1}</span>
                              {ans.isCorrect ? <Crown className="w-3.5 h-3.5 mb-1" /> : <Medal className="w-3.5 h-3.5 mb-1 opacity-20" />}
                              <span className="font-black">{ans.isCorrect ? "Correct" : "Miss"}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="mt-12 flex justify-center">
                  <Link href="/home">
                    <Button className="px-10 py-6 h-auto rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl">
                        Back to Lobby
                    </Button>
                  </Link>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
