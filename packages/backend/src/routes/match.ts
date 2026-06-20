import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { requireAuth } from "../auth/middleware.js";

export function matchRouter(prisma: PrismaClient): Router {
  const router = Router();

  // GET /api/matches/:id — get match details
  router.get("/:id", async (req: Request, res: Response) => {
    try {
      const match = await prisma.match.findUnique({
        where: { id: String(req.params.id) },
        include: {
          player1: { select: { id: true, walletAddress: true, username: true, elo: true } },
          player2: { select: { id: true, walletAddress: true, username: true, elo: true } },
          moves: { orderBy: { moveNumber: "asc" } },
        },
      });
      if (!match) return res.status(404).json({ error: "Match not found" });
      res.json(match);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/matches/user/:userId — get user's match history
  router.get("/user/:userId", async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
      const offset = (page - 1) * limit;

      const matches = await prisma.match.findMany({
        where: {
          OR: [
            { player1Id: String(req.params.userId) },
            { player2Id: String(req.params.userId) },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          player1: { select: { walletAddress: true, username: true, elo: true } },
          player2: { select: { walletAddress: true, username: true, elo: true } },
        },
      });

      res.json({ matches, page, limit });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
