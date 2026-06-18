import { Server, Socket } from "socket.io";
import { MatchmakingService, MatchRequest } from "../game/matchmaking.js";
import { GameRoom, GameResultReason } from "../game/room.js";
import { verifyToken } from "../auth/middleware.js";
import { PrismaClient, MatchStatus, GameResult } from "@prisma/client";

const RESULT_MAP: Record<GameResultReason, GameResult> = {
  checkmate: "CHECKMATE",
  resign: "RESIGN",
  timeout: "TIMEOUT",
  stalemate: "STALEMATE",
  repetition: "REPETITION",
  fifty_move: "FIFTY_MOVE",
  insufficient_material: "INSUFFICIENT_MATERIAL",
  agreed_draw: "AGREED_DRAW",
  abandoned: "TIMEOUT",
  disconnection: "TIMEOUT",
};

export function setupSocketHandlers(io: Server, prisma: PrismaClient, matchmaking: MatchmakingService) {
  // Auth middleware for socket connections
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Authentication required"));

    const payload = verifyToken(token);
    if (!payload) return next(new Error("Invalid token"));

    socket.data.auth = payload;
    next();
  });

  io.on("connection", (socket: Socket) => {
    const auth = socket.data.auth;
    console.log(`[Socket] Connected: ${auth.walletAddress} (${socket.id})`);

    // ─── Matchmaking ─────────────────────────────────────────────
    socket.on("matchmaking:join", async (data: MatchRequest, callback) => {
      try {
        const req: MatchRequest = {
          ...data,
          userId: auth.userId,
          walletAddress: auth.walletAddress,
          socketId: socket.id,
        };

        const result = matchmaking.findMatch(req);

        if (result && result.matched) {
          const room = result.room;

          // Join socket room
          socket.join(room.matchId);

          // Setup room event handlers
          setupRoomHandlers(room, io, prisma, matchmaking);

          // Notify both players
          const state = room.getState();
          io.to(room.matchId).emit("match:found", {
            matchId: room.matchId,
            state,
          });

          // Start the game
          room.startGame();

          callback?.({ success: true, matchId: room.matchId, matched: true });
        } else {
          callback?.({ success: true, matched: false, message: "Queued" });
        }
      } catch (err: any) {
        callback?.({ success: false, error: err.message });
      }
    });

    socket.on("matchmaking:cancel", (_data, callback) => {
      matchmaking.removeFromQueue(auth.userId);
      callback?.({ success: true });
    });

    // ─── Game Actions ────────────────────────────────────────────
    socket.on("game:move", (data: { matchId: string; from: string; to: string; promotion?: string }, callback) => {
      const room = matchmaking.getRoom(data.matchId);
      if (!room) return callback?.({ success: false, error: "Match not found" });

      const player = room.getPlayerBySocket(socket.id);
      if (!player) return callback?.({ success: false, error: "Not in this match" });

      const result = room.makeMove(player.color, data.from, data.to, data.promotion);
      if (result.success && result.state) {
        // Broadcast to room
        io.to(data.matchId).emit("game:moved", {
          from: data.from,
          to: data.to,
          san: result.move?.san,
          fen: result.state.fen,
          pgn: result.state.pgn,
          turn: result.state.turn,
          times: result.state.times,
          inCheck: result.state.inCheck,
          moveCount: result.state.moveCount,
        });
      }

      callback?.(result);
    });

    socket.on("game:resign", (data: { matchId: string }, callback) => {
      const room = matchmaking.getRoom(data.matchId);
      if (!room) return callback?.({ success: false, error: "Match not found" });

      const player = room.getPlayerBySocket(socket.id);
      if (!player) return callback?.({ success: false, error: "Not in this match" });

      room.handleResign(player.color);
      callback?.({ success: true });
    });

    socket.on("game:draw_offer", (data: { matchId: string }, callback) => {
      const room = matchmaking.getRoom(data.matchId);
      if (!room) return callback?.({ success: false, error: "Match not found" });

      const player = room.getPlayerBySocket(socket.id);
      if (!player) return callback?.({ success: false, error: "Not in this match" });

      const result = room.offerDraw(player.color);
      if (result === "offered") {
        // Notify opponent
        socket.to(data.matchId).emit("game:draw_offered", { from: player.color });
      } else if (result === "accepted") {
        io.to(data.matchId).emit("game:draw_accepted");
      }
      callback?.({ success: true, status: result });
    });

    socket.on("game:draw_decline", (data: { matchId: string }) => {
      socket.to(data.matchId).emit("game:draw_declined");
    });

    // ─── Chat ────────────────────────────────────────────────────
    const CHAT_MESSAGES = [
      "GG", "Good luck!", "Well played!", "Good game!",
      "Thanks!", "Rematch?", "Nice move!", "Oops!",
    ];

    socket.on("chat:send", (data: { matchId: string; message: string }) => {
      if (!CHAT_MESSAGES.includes(data.message)) return; // Pre-defined only
      io.to(data.matchId).emit("chat:message", {
        from: auth.walletAddress,
        message: data.message,
        timestamp: Date.now(),
      });
    });

    // ─── Reconnection ────────────────────────────────────────────
    socket.on("game:reconnect", (data: { matchId: string }, callback) => {
      const room = matchmaking.getRoom(data.matchId);
      if (!room) return callback?.({ success: false, error: "Match not found" });

      const player = room.getPlayerBySocket("old-" + socket.id);
      // Try to find by wallet address instead
      const state = room.getState();
      const myPlayer = state.players.find((p) => p.userId === auth.userId);
      if (!myPlayer) return callback?.({ success: false, error: "Not in this match" });

      room.handleReconnect(myPlayer.color, socket.id);
      socket.join(data.matchId);

      callback?.({ success: true, state: room.getState() });
      io.to(data.matchId).emit("game:player_reconnected", { color: myPlayer.color });
    });

    // ─── Disconnect ──────────────────────────────────────────────
    socket.on("disconnect", () => {
      console.log(`[Socket] Disconnected: ${auth.walletAddress} (${socket.id})`);
      matchmaking.removeFromQueue(auth.userId);
      // Room disconnect handling is done via room.onPlayerDisconnected callback
    });
  });
}

function setupRoomHandlers(
  room: GameRoom,
  io: Server,
  prisma: PrismaClient,
  matchmaking: MatchmakingService,
) {
  room.onStateChange = (state) => {
    io.to(room.matchId).emit("game:state", state);
  };

  room.onGameEnd = async (matchId, winner, reason) => {
    const state = room.getState();

    io.to(matchId).emit("game:ended", {
      matchId,
      winner,
      reason,
      pgn: state.pgn,
      result: state.result,
    });

    // Update database
    try {
      const players = state.players;
      const whitePlayer = players.find((p) => p.color === "w");
      const blackPlayer = players.find((p) => p.color === "b");

      await prisma.match.update({
        where: { id: matchId },
        data: {
          status: "COMPLETED" as MatchStatus,
          fen: state.fen,
          pgn: state.pgn,
          moveCount: state.moveCount,
          result: RESULT_MAP[reason] || null,
          endedAt: new Date(),
          winnerId: winner === "w" ? whitePlayer?.userId : winner === "b" ? blackPlayer?.userId : null,
        },
      });

      // Update ELO
      if (winner && whitePlayer && blackPlayer) {
        const winnerId = winner === "w" ? whitePlayer.userId : blackPlayer.userId;
        const loserId = winner === "w" ? blackPlayer.userId : whitePlayer.userId;
        await updateElo(prisma, winnerId, loserId);
      }
    } catch (err) {
      console.error("[DB] Failed to update match:", err);
    }

    // Cleanup room after delay
    setTimeout(() => matchmaking.removeRoom(matchId), 30_000);
  };

  room.onPlayerDisconnected = (matchId, color) => {
    io.to(matchId).emit("game:player_disconnected", { color });

    // Check reconnect window
    setTimeout(() => {
      if (room.isReconnectWindowExpired(color, 60)) {
        room.handleTimeout(color);
      }
    }, 65_000);
  };
}

async function updateElo(prisma: PrismaClient, winnerId: string, loserId: string) {
  const K = 32;
  const winner = await prisma.user.findUnique({ where: { id: winnerId } });
  const loser = await prisma.user.findUnique({ where: { id: loserId } });
  if (!winner || !loser) return;

  const expectedWin = 1 / (1 + Math.pow(10, (loser.elo - winner.elo) / 400));
  const expectedLose = 1 - expectedWin;

  const newWinnerElo = Math.round(winner.elo + K * (1 - expectedWin));
  const newLoserElo = Math.round(loser.elo + K * (0 - expectedLose));

  await prisma.user.update({
    where: { id: winnerId },
    data: { elo: newWinnerElo, wins: { increment: 1 } },
  });
  await prisma.user.update({
    where: { id: loserId },
    data: { elo: newLoserElo, losses: { increment: 1 } },
  });
}
