import "dotenv/config";
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import {
  MatchStatus,
  TxType,
  type MatchStatus as MatchStatusType,
} from "./generated/prisma/enums";
import { prisma } from "./lib/prisma";

const START_BUFFER_MS = 5000;
const INTERMISSION_MS = 5000;

type MatchRow = {
  id: string;
  inviteCode: string;
  status: MatchStatusType;
  timePerQ: number;
  questionCount: number;
  totalPlayers: number;
  stakeAmount: number;
  creatorId: string;
};

type UserRow = {
  id: string;
  wallet: string;
  username: string | null;
};

type QuestionRow = {
  id: string;
  question: string;
  options: unknown;
  order: number;
  correctAns: string;
};

type StoredQuestion = {
  id: string;
  question: string;
  options: string[];
  order: number;
  correctAns: string;
};

type UserAnswerDetail = {
  questionId: string;
  selected: string;
  isCorrect: boolean;
};

type RoomState = {
  matchId: string;
  inviteCode: string;
  creatorId: string;
  timePerQ: number;
  questionCount: number;
  totalPlayers: number;
  stakeAmount: number;
  currentIndex: number | null;
  startsAt: number | null;
  questionEndsAt: number | null;
  questions: StoredQuestion[];
  timers: NodeJS.Timeout[];
  started: boolean;
  players: Map<string, UserRow>;
  scores: Map<string, number>;
  answers: Map<string, Set<string>>;
  detailedAnswers: Map<string, UserAnswerDetail[]>;
};

type JoinRoomPayload = {
  inviteCode?: string;
  wallet?: string;
  userId?: string;
};

type StartRoomPayload = {
  inviteCode?: string;
};

type AnswerPayload = {
  questionId?: string;
  answer?: string;
};

type AckResponse = {
  ok: boolean;
  error?: string;
  data?: unknown;
};

type ScoreEntry = {
  userId: string;
  username: string | null;
  wallet: string;
  score: number;
  answers: UserAnswerDetail[];
};

type MatchPlayerWithUser = {
  userId: string;
  score: number;
  user: UserRow;
};

if (!process.env.DATABASE_URL) {
  console.error("Missing DATABASE_URL for websocket server.");
}

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.WS_CORS_ORIGIN ?? "*",
  },
});

const rooms = new Map<string, RoomState>();

const createUsername = (wallet: string) => {
  const suffix = wallet.slice(0, 6).toLowerCase();
  return `player-${suffix}`;
};

const parseOptions = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map((option) => String(option));
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map((option) => String(option));
      }
    } catch {
      return [];
    }
  }

  return [];
};

const toStoredQuestion = (row: QuestionRow): StoredQuestion => ({
  id: row.id,
  question: row.question,
  options: parseOptions(row.options),
  order: row.order,
  correctAns: row.correctAns,
});

const fetchMatchByInvite = async (
  inviteCode: string
): Promise<MatchRow | null> => {
  const match = await prisma.match.findUnique({
    where: { inviteCode },
    select: {
      id: true,
      inviteCode: true,
      status: true,
      timePerQ: true,
      questionCount: true,
      totalPlayers: true,
      stakeAmount: true,
      creatorId: true,
    },
  });

  return match ?? null;
};

const fetchQuestions = async (matchId: string): Promise<StoredQuestion[]> => {
  const result = await prisma.question.findMany({
    where: { matchId },
    orderBy: { order: "asc" },
    select: {
      id: true,
      question: true,
      options: true,
      order: true,
      correctAns: true,
    },
  });

  return result.map(toStoredQuestion);
};

const fetchUserById = async (userId: string): Promise<UserRow | null> => {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, wallet: true, username: true },
  });
};

const fetchUserByWallet = async (wallet: string): Promise<UserRow | null> => {
  return prisma.user.findUnique({
    where: { wallet },
    select: { id: true, wallet: true, username: true },
  });
};

const ensureUser = async (
  payload: JoinRoomPayload
): Promise<UserRow | null> => {
  if (payload.userId) {
    const user = await fetchUserById(payload.userId);
    if (user?.username) {
      return user;
    }

    if (user) {
      return prisma.user.update({
        where: { id: user.id },
        data: { username: createUsername(user.wallet) },
        select: { id: true, wallet: true, username: true },
      });
    }
  }

  const wallet = payload.wallet?.trim();
  if (!wallet) {
    return null;
  }

  const existing = await fetchUserByWallet(wallet);
  if (!existing) {
    return prisma.user.create({
      data: {
        wallet,
        username: createUsername(wallet),
      },
      select: { id: true, wallet: true, username: true },
    });
  }

  if (!existing.username) {
    return prisma.user.update({
      where: { id: existing.id },
      data: { username: createUsername(wallet) },
      select: { id: true, wallet: true, username: true },
    });
  }

  return existing;
};

const ensureMatchPlayer = async (matchId: string, userId: string) => {
  await prisma.matchPlayer.upsert({
    where: { userId_matchId: { userId, matchId } },
    update: {},
    create: { userId, matchId },
  });
};

const hasStakePaid = async (
  matchId: string,
  userId: string
): Promise<boolean> => {
  const existingStake = await prisma.transaction.findFirst({
    where: {
      matchId,
      userId,
      type: TxType.STAKE,
    },
    select: { id: true },
  });

  return Boolean(existingStake);
};

const fetchDepositedPlayers = async (matchId: string) => {
  return prisma.transaction.findMany({
    where: {
      matchId,
      type: TxType.STAKE,
    },
    select: {
      userId: true,
      amount: true,
      signature: true,
      createdAt: true,
      user: {
        select: { id: true, wallet: true, username: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });
};

const countMatchPlayers = async (matchId: string): Promise<number> => {
  return prisma.matchPlayer.count({ where: { matchId } });
};

const hasMatchPlayer = async (matchId: string, userId: string): Promise<boolean> => {
  const existing = await prisma.matchPlayer.findUnique({
    where: { userId_matchId: { userId, matchId } },
    select: { id: true },
  });

  return Boolean(existing);
};

const buildRoomState = (match: MatchRow): RoomState => ({
  matchId: match.id,
  inviteCode: match.inviteCode,
  creatorId: match.creatorId,
  timePerQ: match.timePerQ,
  questionCount: match.questionCount,
  totalPlayers: match.totalPlayers,
  stakeAmount: match.stakeAmount,
  currentIndex: null,
  startsAt: null,
  questionEndsAt: null,
  questions: [],
  timers: [],
  started: false,
  players: new Map(),
  scores: new Map(),
  answers: new Map(),
  detailedAnswers: new Map(),
});

const fetchMatchPlayers = async (
  matchId: string
): Promise<MatchPlayerWithUser[]> => {
  return prisma.matchPlayer.findMany({
    where: { matchId },
    select: {
      userId: true,
      score: true,
      user: {
        select: { id: true, wallet: true, username: true },
      },
    },
    orderBy: { joinedAt: "asc" },
  });
};

const hydrateRoomPlayers = async (room: RoomState) => {
  const players = await fetchMatchPlayers(room.matchId);

  players.forEach((player) => {
    room.players.set(player.userId, player.user);
    if (!room.scores.has(player.userId)) {
      room.scores.set(player.userId, player.score);
    }
  });
};

const serializeRoom = async (room: RoomState, status: MatchStatusType) => ({
  inviteCode: room.inviteCode,
  status,
  totalPlayers: room.totalPlayers,
  currentPlayers: room.players.size,
  questionCount: room.questionCount,
  timePerQ: room.timePerQ,
  stakeAmount: room.stakeAmount,
  creatorId: room.creatorId,
  depositedPlayers: (await fetchDepositedPlayers(room.matchId)).map((deposit) => ({
    userId: deposit.userId,
    wallet: deposit.user.wallet,
    username: deposit.user.username,
    amount: deposit.amount,
    signature: deposit.signature,
  })),
});

const clearRoomTimers = (room: RoomState) => {
  room.timers.forEach((timer) => clearTimeout(timer));
  room.timers = [];
};

const buildLeaderboard = (room: RoomState): ScoreEntry[] => {
  const entries = Array.from(room.scores.entries()).map(([userId, score]) => {
    const user = room.players.get(userId);
    const answers = room.detailedAnswers.get(userId) ?? [];
    return {
      userId,
      username: user?.username ?? null,
      wallet: user?.wallet ?? "",
      score,
      answers,
    };
  });

  entries.sort((a, b) => b.score - a.score);
  return entries;
};

const callEndGameRoute = async (
  room: RoomState,
  winnerId: string | null
) => {
  const baseUrl =
    process.env.NEXT_APP_URL ??
    process.env.WEB_APP_URL ??
    "http://localhost:3000";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (process.env.END_GAME_SECRET) {
    headers.Authorization = `Bearer ${process.env.END_GAME_SECRET}`;
  }

  const response = await fetch(`${baseUrl}/api/end-game`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      matchId: room.matchId,
      inviteCode: room.inviteCode,
      winnerId,
    }),
  });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error ?? "End game route failed");
  }

  return data;
};

const finishRoom = async (room: RoomState) => {
  room.started = false;
  room.currentIndex = null;
  room.startsAt = null;
  room.questionEndsAt = null;
  clearRoomTimers(room);

  const leaderboard = buildLeaderboard(room);
  const topScore = leaderboard[0]?.score ?? 0;
  const winners = leaderboard.filter((entry) => entry.score === topScore);
  const isDraw = winners.length !== 1;
  const winnerId = isDraw ? null : winners[0].userId;

  console.log(
    `[ws] Match ${room.inviteCode} finished. Top score: ${topScore}, Winners: ${winners.length}, Result: ${
      isDraw ? "DRAW (both get refund)" : `WINNER ${winnerId}`
    }`
  );

  await prisma.match.update({
    where: { id: room.matchId },
    data: {
      status: MatchStatus.FINISHED,
      endedAt: new Date(),
      winnerId,
    },
  });

  let payment: unknown = null;
  try {
    payment = await callEndGameRoute(room, winnerId);
  } catch (error) {
    console.error("[ws] Failed to release payment:", error);
    payment = {
      status: "FAILED",
      error: error instanceof Error ? error.message : "Failed to release payment",
    };
  }

  io.to(room.inviteCode).emit("room:finished", {
    endedAt: Date.now(),
    winners,
    leaderboard,
    payment,
  });
};

const scheduleQuestion = (room: RoomState, index: number) => {
  if (!room.started) {
    return;
  }

  if (index >= room.questions.length) {
    finishRoom(room).catch((error) => {
      console.error("[ws] Failed to finish room:", error);
    });
    return;
  }

  const question = room.questions[index];
  room.currentIndex = index;
  room.startsAt = null;
  room.questionEndsAt = Date.now() + room.timePerQ * 1000;

  if (index === 0) {
    prisma.match
      .update({
        where: { id: room.matchId },
        data: { status: MatchStatus.INGAME },
      })
      .catch((error) => {
        console.error("[ws] Failed to mark match in-game:", error);
      });
  }

  const nextStartsAt =
    index + 1 < room.questions.length
      ? room.questionEndsAt + INTERMISSION_MS
      : null;

  io.to(room.inviteCode).emit("room:question", {
    id: question.id,
    index,
    question: question.question,
    options: question.options,
    endsAt: room.questionEndsAt,
    nextStartsAt,
    totalQuestions: room.questionCount,
  });

  if (index + 1 < room.questions.length) {
    const intermissionTimer = setTimeout(() => {
      if (!room.started) {
        return;
      }

      io.to(room.inviteCode).emit("room:intermission", {
        nextIndex: index + 1,
        startsAt: nextStartsAt,
      });
    }, room.timePerQ * 1000);
    room.timers.push(intermissionTimer);
  }

  const timer = setTimeout(() => {
    scheduleQuestion(room, index + 1);
  }, room.timePerQ * 1000 + INTERMISSION_MS);
  room.timers.push(timer);
};

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

io.on("connection", (socket) => {
  console.log("[ws] user connected", socket.id);

  socket.on("room:join", async (payload: JoinRoomPayload, ack?: (res: AckResponse) => void) => {
    try {
      const inviteCode = payload.inviteCode?.trim().toUpperCase();
      if (!inviteCode) {
        ack?.({ ok: false, error: "Missing invite code" });
        return;
      }

      const match = await fetchMatchByInvite(inviteCode);
      if (!match) {
        ack?.({ ok: false, error: "Room not found" });
        return;
      }

      const existingRoom = rooms.get(inviteCode);
      if (existingRoom?.started) {
        ack?.({ ok: false, error: "Room already started" });
        return;
      }

      if (match.status !== MatchStatus.WAITING) {
        ack?.({ ok: false, error: "Room is not accepting players" });
        return;
      }

      const user = await ensureUser(payload);
      if (!user) {
        ack?.({ ok: false, error: "Missing user identity" });
        return;
      }

      const alreadyJoined = await hasMatchPlayer(match.id, user.id);
      const stakePaid = await hasStakePaid(match.id, user.id);
      if (!stakePaid) {
        ack?.({ ok: false, error: "Deposit required before joining" });
        return;
      }

      if (!alreadyJoined) {
        const playerCount = await countMatchPlayers(match.id);
        if (playerCount >= match.totalPlayers) {
          ack?.({ ok: false, error: "Room is full" });
          return;
        }

        await ensureMatchPlayer(match.id, user.id);
      }

      socket.data.inviteCode = inviteCode;
      socket.data.userId = user.id;
      socket.data.wallet = user.wallet;

      socket.join(inviteCode);

      const roomState = existingRoom ?? buildRoomState(match);
      rooms.set(inviteCode, roomState);
      await hydrateRoomPlayers(roomState);

      if (!roomState.players.has(user.id)) {
        roomState.players.set(user.id, user);
      }

      if (!roomState.scores.has(user.id)) {
        roomState.scores.set(user.id, 0);
      }

      const serializedRoom = await serializeRoom(roomState, match.status);

      io.to(inviteCode).emit("room:player-joined", {
        user,
        currentPlayers: roomState.players.size,
        room: serializedRoom,
      });

      ack?.({
        ok: true,
        data: {
          room: serializedRoom,
          user,
        },
      });
    } catch (error) {
      console.error("[ws] room:join error:", error);
      ack?.({ ok: false, error: "Failed to join room" });
    }
  });

  socket.on("room:start", async (payload: StartRoomPayload, ack?: (res: AckResponse) => void) => {
    try {
      const inviteCode = payload.inviteCode?.trim().toUpperCase() ?? (socket.data.inviteCode as string | undefined);
      if (!inviteCode) {
        ack?.({ ok: false, error: "Missing invite code" });
        return;
      }

      const match = await fetchMatchByInvite(inviteCode);
      if (!match) {
        ack?.({ ok: false, error: "Room not found" });
        return;
      }

      if (match.status !== MatchStatus.WAITING) {
        ack?.({ ok: false, error: "Room already started" });
        return;
      }

      const userId = socket.data.userId as string | undefined;
      if (!userId || userId !== match.creatorId) {
        ack?.({ ok: false, error: "Only the creator can start the room" });
        return;
      }

      const roomState = rooms.get(inviteCode) ?? buildRoomState(match);
      if (roomState.started) {
        ack?.({ ok: false, error: "Room already started" });
        return;
      }

      roomState.questions = await fetchQuestions(match.id);
      await hydrateRoomPlayers(roomState);
      if (!roomState.questions.length) {
        ack?.({ ok: false, error: "Room has no questions" });
        return;
      }

      const dbPlayers = await fetchMatchPlayers(match.id);
      if (dbPlayers.length !== 2) {
        ack?.({ ok: false, error: "This game requires exactly 2 players" });
        return;
      }

      const depositChecks = await Promise.all(
        dbPlayers.map((player) => hasStakePaid(match.id, player.userId))
      );
      if (depositChecks.some((paid) => !paid)) {
        ack?.({ ok: false, error: "Both player deposits must be confirmed" });
        return;
      }

      roomState.answers = new Map();
      roomState.detailedAnswers = new Map();
      roomState.scores = new Map(
        Array.from(roomState.players.keys()).map((playerId) => [playerId, 0])
      );

      await prisma.matchPlayer.updateMany({
        where: { matchId: match.id },
        data: { score: 0 },
      });

      roomState.started = true;
      roomState.currentIndex = null;
      roomState.startsAt = Date.now() + START_BUFFER_MS;
      roomState.questionEndsAt = null;

      rooms.set(inviteCode, roomState);

      await prisma.match.update({
        where: { id: match.id },
        data: { status: MatchStatus.STARTED, startedAt: new Date(), endedAt: null },
      });

      io.to(inviteCode).emit("room:starting", {
        startsAt: roomState.startsAt,
      });

      clearRoomTimers(roomState);
      const timer = setTimeout(() => {
        scheduleQuestion(roomState, 0);
      }, START_BUFFER_MS);
      roomState.timers.push(timer);

      ack?.({ ok: true });
    } catch (error) {
      console.error("[ws] room:start error:", error);
      ack?.({ ok: false, error: "Failed to start room" });
    }
  });

  socket.on("room:answer", async (payload: AnswerPayload, ack?: (res: AckResponse) => void) => {
    try {
      const inviteCode = socket.data.inviteCode as string | undefined;
      if (!inviteCode) {
        ack?.({ ok: false, error: "Not in a room" });
        return;
      }

      const room = rooms.get(inviteCode);
      if (!room || !room.started) {
        ack?.({ ok: false, error: "Room not active" });
        return;
      }

      const userId = socket.data.userId as string | undefined;
      if (!userId) {
        ack?.({ ok: false, error: "Missing user" });
        return;
      }

      const questionId = payload.questionId?.trim();
      const answer = payload.answer?.trim();
      if (!questionId || !answer) {
        ack?.({ ok: false, error: "Missing answer" });
        return;
      }

      if (!room.questionEndsAt || Date.now() > room.questionEndsAt) {
        ack?.({ ok: false, error: "Question closed" });
        return;
      }

      if (room.currentIndex === null) {
        ack?.({ ok: false, error: "No active question" });
        return;
      }

      const currentQuestion = room.questions[room.currentIndex];
      if (!currentQuestion || currentQuestion.id !== questionId) {
        ack?.({ ok: false, error: "Question mismatch" });
        return;
      }

      const answeredSet = room.answers.get(userId) ?? new Set<string>();
      if (answeredSet.has(questionId)) {
        ack?.({ ok: false, error: "Already answered" });
        return;
      }

      answeredSet.add(questionId);
      room.answers.set(userId, answeredSet);

      const correct = answer === currentQuestion.correctAns;
      const questionStartedAt = room.questionEndsAt - room.timePerQ * 1000;
      const timeTaken = Math.max(0, Date.now() - questionStartedAt);
      if (correct) {
        const currentScore = room.scores.get(userId) ?? 0;
        room.scores.set(userId, currentScore + 1);
      }

      const userDetailed = room.detailedAnswers.get(userId) ?? [];
      userDetailed.push({
        questionId,
        selected: answer,
        isCorrect: correct,
      });
      room.detailedAnswers.set(userId, userDetailed);

      await prisma.answer
        .create({
          data: {
            userId,
            questionId,
            selected: answer,
            isCorrect: correct,
            timeTaken,
          },
        })
        .catch((error) => {
          console.error("[ws] Failed to persist answer:", error);
        });

      if (correct) {
        await prisma.matchPlayer.update({
          where: { userId_matchId: { userId, matchId: room.matchId } },
          data: { score: room.scores.get(userId) ?? 0 },
        });
      }

      ack?.({
        ok: true,
      });
    } catch (error) {
      console.error("[ws] room:answer error:", error);
      ack?.({ ok: false, error: "Failed to submit answer" });
    }
  });

});

const port = Number(process.env.WS_PORT ?? 8080);
server.listen(port, () => {
  console.log(`[ws] server running at http://localhost:${port}`);
});
