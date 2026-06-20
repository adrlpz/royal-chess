import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

export function leaderboardRouter(prisma: PrismaClient): Router {
  const router = Router();

  // GET /api/leaderboard — top players by ELO
  router.get("/", async (req: Request, res: Response) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const offset = parseInt(req.query.offset as string) || 0;

      const players = await prisma.user.findMany({
        where: { wins: { gt: 0 } },
        orderBy: { elo: "desc" },
        take: limit,
        skip: offset,
        select: {
          id: true, walletAddress: true, username: true,
          elo: true, wins: true, losses: true, draws: true,
          totalEarnings: true,
        },
      });

      const ranked = players.map((p: any, i: number) => ({
        rank: offset + i + 1,
        ...p,
        totalGames: p.wins + p.losses + p.draws,
        winRate: p.wins + p.losses + p.draws > 0
          ? ((p.wins / (p.wins + p.losses + p.draws)) * 100).toFixed(1)
          : "0.0",
      }));

      res.json({ players: ranked });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
