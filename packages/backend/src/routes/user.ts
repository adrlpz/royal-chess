import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { requireAuth } from "../auth/middleware.js";

export function userRouter(prisma: PrismaClient): Router {
  const router = Router();

  // GET /api/users/me — current user profile
  router.get("/me", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.auth!.userId },
        select: {
          id: true, walletAddress: true, username: true,
          elo: true, wins: true, losses: true, draws: true,
          totalEarnings: true, totalBets: true, createdAt: true,
          _count: { select: { matchesAsP1: true, matchesAsP2: true } },
        },
      });
      if (!user) return res.status(404).json({ error: "User not found" });

      const totalGames = user.wins + user.losses + user.draws;
      const winRate = totalGames > 0 ? ((user.wins / totalGames) * 100).toFixed(1) : "0.0";

      res.json({ ...user, totalGames, winRate });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // PATCH /api/users/me — update username
  router.patch("/me", requireAuth, async (req: Request, res: Response) => {
    try {
      const { username } = req.body;
      if (!username || username.length < 3 || username.length > 20) {
        return res.status(400).json({ error: "Username must be 3-20 characters" });
      }
      if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        return res.status(400).json({ error: "Username: alphanumeric + underscore only" });
      }

      const existing = await prisma.user.findUnique({ where: { username } });
      if (existing && existing.id !== req.auth!.userId) {
        return res.status(409).json({ error: "Username taken" });
      }

      const user = await prisma.user.update({
        where: { id: req.auth!.userId },
        data: { username },
        select: { id: true, username: true },
      });
      res.json(user);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/users/:id — public profile
  router.get("/:id", async (req: Request, res: Response) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.params.id },
        select: {
          id: true, walletAddress: true, username: true,
          elo: true, wins: true, losses: true, draws: true,
          createdAt: true,
        },
      });
      if (!user) return res.status(404).json({ error: "User not found" });

      const totalGames = user.wins + user.losses + user.draws;
      res.json({ ...user, totalGames });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
