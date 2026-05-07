"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import type { Socket } from "socket.io-client";
import { io } from "socket.io-client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";

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

const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? "http://localhost:8080";

export default function RoomPage() {
  const { publicKey, connected } = useWallet();
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
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!walletAddress) {
      queueMicrotask(() => {
        setUser(null);
        setEnsureStatus("idle");
        setEnsureError("");
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
          setPhase("waiting");
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
  }, [connected, user?.id, walletAddress, inviteCode]);

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
          <p className="text-xs uppercase tracking-[0.4em] text-white/50">
            Tryhard Arena
          </p>
          <h1 className="text-2xl font-semibold">Room {inviteCode}</h1>
          <p className="text-sm text-white/60">
            Stake: {room?.stakeAmount ?? 0} SOL confirmed (demo)
          </p>
        </div>
        {mounted && <WalletMultiButton />}
      </header>

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
              <p className="text-sm text-white/60">Players</p>
              <p className="text-base font-semibold">
                {room ? `${room.currentPlayers}/${room.totalPlayers}` : "-"}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          {phase === "waiting" && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold">Waiting for players</h2>
                <p className="text-sm text-white/60">
                  Room is ready. The creator can start the game once everyone is
                  in.
                </p>
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
            <div className="space-y-3">
              <h2 className="text-xl font-semibold">Game starts soon</h2>
              <p className="text-sm text-white/60">
                Starting in {Math.ceil((countdownMs ?? 0) / 1000)} seconds.
              </p>
            </div>
          )}

          {phase === "intermission" && (
            <div className="space-y-3">
              <h2 className="text-xl font-semibold">Next question incoming</h2>
              <p className="text-sm text-white/60">
                Next question in {Math.ceil((countdownMs ?? 0) / 1000)} seconds.
              </p>
              {intermission?.nextIndex !== undefined && room && (
                <p className="text-xs text-white/40">
                  Question {intermission.nextIndex + 1} of {room.questionCount}
                </p>
              )}
            </div>
          )}

          {phase === "question" && question && (
            <div className="space-y-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-white/50">
                    Question {question.index + 1} of {question.totalQuestions}
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold">
                    {question.question}
                  </h2>
                </div>
                <div className="rounded-full border border-white/20 px-4 py-2 text-sm">
                  {Math.ceil((timeLeftMs ?? 0) / 1000)}s left
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {question.options.map((option) => {
                  const isSelected = selectedAnswer === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => handleAnswer(option)}
                      disabled={Boolean(selectedAnswer)}
                      className={`rounded-xl border px-4 py-3 text-left text-sm transition ${
                        isSelected
                          ? "border-white bg-white text-zinc-900"
                          : "border-white/20 bg-white/5 text-white hover:border-white/60"
                      }`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>

              {answerFeedback && (
                <p className="text-sm font-semibold text-white/80">
                  {answerFeedback}
                </p>
              )}
            </div>
          )}

          {phase === "finished" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-semibold">Match Finished</h2>
                {winners.length > 0 ? (
                  <p className="text-sm text-white/70">
                    Winner{winners.length > 1 ? "s" : ""}: {" "}
                    <span className="font-bold text-white">
                      {winners
                        .map((winner) => winner.username ?? winner.wallet)
                        .join(", ")}
                    </span>
                  </p>
                ) : (
                  <p className="text-sm text-white/70">No winner data.</p>
                )}
              </div>

              {leaderboard.length > 0 && (
                <div className="space-y-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-white/50">
                    Final Standings & Answers
                  </p>
                  <div className="grid gap-4">
                    {leaderboard.map((entry) => (
                      <div
                        key={entry.userId}
                        className="rounded-xl border border-white/10 bg-white/5 p-4"
                      >
                        <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
                          <span className="font-semibold">
                            {entry.username ?? entry.wallet}
                            {entry.userId === user?.id && " (You)"}
                          </span>
                          <span className="text-lg font-bold text-white">
                            {entry.score} pts
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                          {entry.answers?.map((ans, idx) => (
                            <div
                              key={idx}
                              className={`flex flex-col rounded-lg px-3 py-2 text-[10px] uppercase tracking-tighter ${
                                ans.isCorrect
                                  ? "bg-green-500/10 text-green-400 border border-green-500/20"
                                  : "bg-red-500/10 text-red-400 border border-red-500/20"
                              }`}
                            >
                              <span className="opacity-60">Q{idx + 1}</span>
                              <span className="truncate font-bold">
                                {ans.isCorrect ? "Correct" : "Wrong"}
                              </span>
                              <span className="truncate opacity-80">
                                {ans.selected}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
