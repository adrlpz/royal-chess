import { v4 as uuidv4 } from "uuid";
import { GameRoom, RoomOptions } from "./room.js";

export interface MatchRequest {
  userId: string;
  walletAddress: string;
  socketId: string;
  timeControl: string;   // e.g. "5+0", "3+2"
  betMin: string;        // USD min
  betMax: string;        // USD max
  chain: string;         // BASE | BSC | SOLANA
  token: string;         // ETH, BNB, SOL, USDC, USDT
}

interface QueuedRequest extends MatchRequest {
  queuedAt: number;
}

export class MatchmakingService {
  private queue: Map<string, QueuedRequest[]> = new Map(); // key = timeControl
  private activeRooms: Map<string, GameRoom> = new Map();

  /**
   * Add player to matchmaking queue.
   * Returns a GameRoom if matched immediately, null if queued.
   */
  findMatch(req: MatchRequest): { room: GameRoom; matched: boolean } | null {
    const queueKey = req.timeControl;
    const existing = this.queue.get(queueKey) || [];

    // Try to find a compatible match
    const matchIdx = existing.findIndex(
      (q) =>
        q.userId !== req.userId &&
        q.chain === req.chain &&
        q.token === req.token &&
        this.betRangesOverlap(q.betMin, q.betMax, req.betMin, req.betMax)
    );

    if (matchIdx >= 0) {
      const opponent = existing.splice(matchIdx, 1)[0];
      this.queue.set(queueKey, existing);

      // Parse time control
      const [base, increment] = this.parseTimeControl(req.timeControl);
      const betAmount = this.calculateBetAmount(req.betMin, opponent.betMin);

      const roomOpts: RoomOptions = {
        matchId: uuidv4(),
        timeBase: base,
        timeIncrement: increment,
        betAmount,
        chain: req.chain,
        token: req.token,
      };

      const room = new GameRoom(roomOpts);
      const player1 = room.addPlayer(opponent.userId, opponent.walletAddress, opponent.socketId);
      const player2 = room.addPlayer(req.userId, req.walletAddress, req.socketId);

      this.activeRooms.set(room.matchId, room);

      return { room, matched: true };
    }

    // No match found — queue the request
    existing.push({ ...req, queuedAt: Date.now() });
    this.queue.set(queueKey, existing);
    return null;
  }

  /**
   * Remove player from queue (e.g. on disconnect or cancel).
   */
  removeFromQueue(userId: string): boolean {
    let removed = false;
    for (const [key, queue] of this.queue.entries()) {
      const idx = queue.findIndex((q) => q.userId === userId);
      if (idx >= 0) {
        queue.splice(idx, 1);
        this.queue.set(key, queue);
        removed = true;
      }
    }
    return removed;
  }

  getRoom(matchId: string): GameRoom | undefined {
    return this.activeRooms.get(matchId);
  }

  removeRoom(matchId: string): void {
    const room = this.activeRooms.get(matchId);
    if (room) {
      room.destroy();
      this.activeRooms.delete(matchId);
    }
  }

  getActiveRoomCount(): number {
    return this.activeRooms.size;
  }

  getQueueSize(): number {
    let total = 0;
    for (const q of this.queue.values()) total += q.length;
    return total;
  }

  /**
   * Cleanup expired queued requests and empty rooms.
   */
  cleanup(maxQueueAgeMs: number = 120_000): void {
    const now = Date.now();
    for (const [key, queue] of this.queue.entries()) {
      const filtered = queue.filter((q) => now - q.queuedAt < maxQueueAgeMs);
      this.queue.set(key, filtered);
    }
  }

  private parseTimeControl(tc: string): [number, number] {
    const parts = tc.split("+");
    return [parseInt(parts[0]) * 60, parseInt(parts[1] || "0")];
  }

  private betRangesOverlap(min1: string, max1: string, min2: string, max2: string): boolean {
    const lo = Math.max(parseFloat(min1), parseFloat(min2));
    const hi = Math.min(parseFloat(max1), parseFloat(max2));
    return lo <= hi;
  }

  private calculateBetAmount(bet1: string, bet2: string): string {
    // Use the lower of the two maxes
    return Math.min(parseFloat(bet1), parseFloat(bet2)).toString();
  }
}
