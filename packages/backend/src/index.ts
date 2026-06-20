import express from "express";
import http from "http";
import { Server as SocketIO } from "socket.io";
import cors from "cors";
import helmet from "helmet";
import { PrismaClient } from "@prisma/client";
import { config } from "./config.js";
import { setupSocketHandlers } from "./socket/handler.js";
import { MatchmakingService } from "./game/matchmaking.js";
import { authRouter } from "./routes/auth.js";
import { userRouter } from "./routes/user.js";
import { matchRouter } from "./routes/match.js";
import { leaderboardRouter } from "./routes/leaderboard.js";

const prisma = new PrismaClient();
const matchmaking = new MatchmakingService();

const app: express.Express = express();
const server = http.createServer(app);

const io = new SocketIO(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  },
  pingTimeout: 20000,
  pingInterval: 10000,
});

// ─── Middleware ────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
}));
app.use(express.json());

// ─── Routes ───────────────────────────────────────────────────────
app.use("/api/auth", authRouter(prisma));
app.use("/api/users", userRouter(prisma));
app.use("/api/matches", matchRouter(prisma));
app.use("/api/leaderboard", leaderboardRouter(prisma));

// Health check
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    activeGames: matchmaking.getActiveRoomCount(),
    queueSize: matchmaking.getQueueSize(),
    uptime: process.uptime(),
  });
});

// ─── Socket.IO ────────────────────────────────────────────────────
setupSocketHandlers(io, prisma, matchmaking);

// ─── Matchmaking cleanup ──────────────────────────────────────────
setInterval(() => matchmaking.cleanup(), 30_000);

// ─── Server ───────────────────────────────────────────────────────
server.listen(config.port, () => {
  console.log(`
╔══════════════════════════════════════════════╗
║          🏁 Royal Chess Backend v0.1.0         ║
║──────────────────────────────────────────────║
║  HTTP:     http://localhost:${config.port}           ║
║  Socket:   ws://localhost:${config.port}             ║
║  Env:      ${config.nodeEnv.padEnd(33)}║
╚══════════════════════════════════════════════╝
  `);
});

// ─── Graceful shutdown ────────────────────────────────────────────
async function shutdown(signal: string) {
  console.log(`\n[Server] ${signal} received, shutting down...`);
  io.close();
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

export { app, server, io };
