import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { verifySiwe, generateNonce } from "../auth/siwe.js";
import { generateToken } from "../auth/middleware.js";

export function authRouter(prisma: PrismaClient): Router {
  const router = Router();

  // GET /api/auth/nonce — get a fresh nonce for SIWE
  router.get("/nonce", (_req: Request, res: Response) => {
    const nonce = generateNonce();
    res.json({ nonce });
  });

  // POST /api/auth/verify — verify SIWE signature, return JWT
  router.post("/verify", async (req: Request, res: Response) => {
    try {
      const { message, signature, nonce } = req.body;
      if (!message || !signature || !nonce) {
        return res.status(400).json({ error: "Missing message, signature, or nonce" });
      }

      const { address } = await verifySiwe({ message, signature, nonce });

      // Upsert user
      const user = await prisma.user.upsert({
        where: { walletAddress: address },
        update: {},
        create: { walletAddress: address },
      });

      const token = generateToken({ userId: user.id, walletAddress: address });

      res.json({
        token,
        user: {
          id: user.id,
          walletAddress: user.walletAddress,
          username: user.username,
          elo: user.elo,
          wins: user.wins,
          losses: user.losses,
          draws: user.draws,
        },
      });
    } catch (err: any) {
      console.error("[Auth] SIWE verify failed:", err.message);
      res.status(401).json({ error: "Signature verification failed" });
    }
  });

  return router;
}
