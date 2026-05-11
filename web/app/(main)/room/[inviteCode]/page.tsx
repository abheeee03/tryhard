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
    <div className="flex min-h-screen flex-col bg-zinc-950 text-white">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-6 py-6">
        <div className="space-y-1">
          <Link href="/home" className="text-xs uppercase tracking-[0.4em] text-white/50 hover:text-white transition-colors">
            Tryhard Arena
          </Link>
          <h1 className="text-2xl font-semibold">Room {inviteCode}</h1>
          <p className="text-sm text-white/60">
            Stake: {room?.stakeAmount ?? 0} SOL
          </p>
        </div>
        {mounted && <WalletMultiButton />}
      </header>

      {connected && user && room && depositStatus !== "confirmed" && room.status !== 'FINISHED' && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-6 text-white shadow-2xl">
            <p className="text-xs uppercase tracking-[0.3em] text-white/50">
              Stake required
            </p>
            <h2 className="mt-2 text-xl font-semibold">
              Deposit {room.stakeAmount} SOL to enter
            </h2>
            <div className="mt-4 space-y-2 rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-white/50">Room</span>
                <span>{room.inviteCode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Players</span>
                <span>{room.currentPlayers}/{room.totalPlayers}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Role</span>
                <span>{isCreator ? "Creator" : "Player 2"}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDeposit}
              disabled={
                depositStatus === "loading" ||
                depositStatus === "signing" ||
                depositStatus === "confirming"
              }
              className="mt-5 h-11 w-full rounded-full bg-white px-6 text-sm font-semibold text-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {depositStatus === "loading"
                ? "Loading room..."
                : depositStatus === "signing"
                  ? "Sign deposit..."
                  : depositStatus === "confirming"
                    ? "Confirming..."
                    : "Deposit stake"}
            </button>
            {depositError && (
              <p className="mt-3 text-xs text-red-300">{depositError}</p>
            )}
          </div>
        </div>
      )}

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm text-white/60">Wallet</p>
              <p className="text-base font-semibold">
                {connected ? "Connected" : "Not connected"}
              </p>
              <p className="text-xs text-white/40">
                {walletAddress || "Connect a wallet to join the room."}
              </p>
            </div>
            <div>
              <p className="text-sm text-white/60">User</p>
              <p className="text-base font-semibold">
                {user?.username ?? "-"}
              </p>
              {ensureStatus === "error" && (
                <p className="text-xs text-red-400">{ensureError}</p>
              )}
            </div>
            <div>
              <p className="text-sm text-white/60">Join status</p>
              <p className="text-base font-semibold">{joinStatus}</p>
              {joinError && <p className="text-xs text-red-400">{joinError}</p>}
            </div>
            <div>
              <p className="text-sm text-white/60">Deposit</p>
              <p className="text-base font-semibold">{depositStatus}</p>
              {depositSignature && (
                <p className="max-w-36 truncate text-xs text-white/40">
                  {depositSignature}
                </p>
              )}
            </div>
            <div>
              <p className="text-sm text-white/60">Players</p>
              <p className="text-base font-semibold">
                {room ? `${room.currentPlayers}/${room.totalPlayers}` : "-"}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6 min-h-[400px] flex flex-col">
          {phase === "waiting" && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold">Waiting for players</h2>
                <p className="text-sm text-white/60">
                  Room is ready. The creator can start the game once everyone is
                  in and both deposits are confirmed.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {Array.from({ length: room?.totalPlayers ?? 2 }, (_, index) => {
                  const deposit = room?.depositedPlayers?.[index];
                  return (
                    <div
                      key={deposit?.userId ?? index}
                      className="rounded-xl border border-white/10 bg-white/5 p-4"
                    >
                      <p className="text-xs uppercase tracking-[0.25em] text-white/40">
                        Player {index + 1}
                      </p>
                      <p className="mt-2 truncate text-sm font-semibold">
                        {deposit?.username ?? deposit?.wallet ?? "Waiting"}
                      </p>
                      <p
                        className={`mt-1 text-xs ${
                          deposit ? "text-emerald-300" : "text-amber-300"
                        }`}
                      >
                        {deposit ? "Deposit confirmed" : "Deposit pending"}
                      </p>
                    </div>
                  );
                })}
              </div>
              {isCreator && (
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={handleStart}
                    className="h-11 w-fit rounded-full bg-white px-6 text-sm font-semibold text-zinc-900"
                  >
                    Start game
                  </button>
                  {startError && (
                    <p className="text-xs text-red-400">{startError}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {phase === "starting" && (
            <div className="space-y-3 flex flex-col items-center justify-center flex-1">
              <div className="w-16 h-16 rounded-full border-4 border-white/10 border-t-white animate-spin mb-4" />
              <h2 className="text-2xl font-black">GET READY</h2>
              <p className="text-xl text-white/60 font-mono">
                {Math.ceil((countdownMs ?? 0) / 1000)}s
              </p>
            </div>
          )}

          {phase === "intermission" && (
            <div className="space-y-3 flex flex-col items-center justify-center flex-1">
              <h2 className="text-xl font-semibold text-white/60 uppercase tracking-widest">Next question in</h2>
              <p className="text-4xl font-black font-mono">
                {Math.ceil((countdownMs ?? 0) / 1000)}s
              </p>
              {intermission?.nextIndex !== undefined && room && (
                <p className="mt-4 text-xs text-white/40 font-bold uppercase tracking-tighter">
                  Question {intermission.nextIndex + 1} of {room.questionCount}
                </p>
              )}
            </div>
          )}

          {phase === "question" && question && (
            <div className="space-y-6 flex-1 flex flex-col justify-center">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-white/50 font-bold">
                    Question {question.index + 1} of {question.totalQuestions}
                  </p>
                  <h2 className="mt-4 text-3xl font-black leading-tight">
                    {question.question}
                  </h2>
                </div>
                <div className="flex-shrink-0 w-20 h-20 rounded-full border-4 border-white/10 flex items-center justify-center text-xl font-black font-mono">
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
                      className={`rounded-2xl border-2 px-6 py-4 text-left text-base font-bold transition-all transform active:scale-95 ${
                        isSelected
                          ? "border-white bg-white text-zinc-950 shadow-[0_0_20px_rgba(255,255,255,0.3)]"
                          : "border-white/10 bg-white/5 text-white hover:border-white/40 hover:bg-white/10"
                      }`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>

              {answerFeedback && (
                <div className="mt-4 p-4 rounded-xl bg-white/5 border border-white/10 text-center animate-pulse">
                    <p className="text-sm font-black uppercase tracking-widest text-white/60">
                    {answerFeedback}
                    </p>
                </div>
              )}
            </div>
          )}

          {phase === "finished" && (
            <div className="space-y-8 flex-1 flex flex-col py-4">
              <div className="text-center space-y-4">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-amber-500/10 border-2 border-amber-500/20 mb-2">
                    <Trophy className="w-10 h-10 text-amber-500" />
                </div>
                <h2 className="text-4xl font-black tracking-tighter">MATCH FINISHED</h2>
                
                <div className="flex flex-col items-center gap-2">
                    {winners.length > 0 ? (
                        <div className="flex flex-wrap justify-center gap-4">
                            {winners.map((winner, idx) => (
                                <div key={idx} className="flex items-center gap-3 bg-white text-zinc-950 px-6 py-3 rounded-2xl shadow-xl">
                                    <Crown className="w-6 h-6 text-amber-500" />
                                    <div className="text-left">
                                        <p className="text-[10px] font-black uppercase leading-none opacity-60">Winner</p>
                                        <p className="text-lg font-black leading-tight truncate max-w-[150px]">
                                            {winner.username ?? winner.wallet.slice(0, 8)}
                                        </p>
                                    </div>
                                    <div className="ml-2 pl-4 border-l border-zinc-200">
                                        <p className="text-[10px] font-black uppercase leading-none opacity-60">Score</p>
                                        <p className="text-lg font-black leading-tight">{winner.score}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : room?.winnerId ? (
                         <div className="flex items-center gap-3 bg-white text-zinc-950 px-6 py-3 rounded-2xl shadow-xl">
                            <Crown className="w-6 h-6 text-amber-500" />
                            <div className="text-left">
                                <p className="text-[10px] font-black uppercase leading-none opacity-60">Winner Found</p>
                                <p className="text-lg font-black leading-tight">Match Closed</p>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white/5 border border-white/10 px-6 py-3 rounded-2xl">
                            <p className="text-sm font-bold text-white/60 italic text-center">Finalizing results...</p>
                        </div>
                    )}
                </div>
              </div>

              {leaderboard.length > 0 && (
                <div className="space-y-4 mt-8">
                  <p className="text-xs uppercase tracking-[0.3em] text-white/50 font-black text-center">Final Standings</p>
                  <div className="grid gap-4">
                    {leaderboard.map((entry, idx) => (
                      <div
                        key={entry.userId}
                        className={`rounded-2xl border transition-all ${
                          entry.userId === user?.id 
                            ? "bg-white/10 border-white/20 shadow-lg scale-[1.02]" 
                            : "bg-white/5 border-white/10"
                        } p-6`}
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black ${
                                idx === 0 ? "bg-amber-500 text-zinc-950" : "bg-white/10 text-white"
                            }`}>
                                {idx + 1}
                            </div>
                            <div>
                                <p className="text-lg font-black flex items-center gap-2">
                                    {entry.username ?? entry.wallet.slice(0, 12)}
                                    {entry.userId === user?.id && <span className="text-[10px] bg-white text-zinc-950 px-2 py-0.5 rounded-full uppercase tracking-widest font-black">You</span>}
                                </p>
                                <p className="text-xs font-mono text-white/40">{entry.wallet.slice(0, 24)}...</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-3xl font-black tracking-tighter">{entry.score}</p>
                            <p className="text-[10px] font-black uppercase text-white/40 tracking-widest">Points</p>
                          </div>
                        </div>
                        
                        <div className="flex flex-wrap gap-2 pt-4 border-t border-white/10">
                          {entry.answers?.map((ans, ansIdx) => (
                            <div
                              key={ansIdx}
                              className={`flex flex-col items-center justify-center min-w-[60px] rounded-lg px-2 py-2 text-[9px] uppercase tracking-tighter border transition-all ${
                                ans.isCorrect
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                  : "bg-red-500/10 text-red-400 border-red-500/20"
                              }`}
                            >
                              <span className="opacity-50 font-bold mb-1">Q{ansIdx + 1}</span>
                              {ans.isCorrect ? <Crown className="w-3 h-3 mb-1" /> : <Medal className="w-3 h-3 mb-1 opacity-20" />}
                              <span className="font-black">{ans.isCorrect ? "Correct" : "Miss"}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="mt-8 flex justify-center">
                  <Link href="/home">
                    <button className="bg-white text-zinc-950 px-8 py-3 rounded-2xl font-black uppercase tracking-widest hover:bg-zinc-200 transition-colors shadow-lg">
                        Back to Lobby
                    </button>
                  </Link>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
