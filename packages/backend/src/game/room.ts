import { ChessEngine, GameState } from "../chess/engine.js";
import { ChessTimer } from "./timer.js";

export interface Player {
  id: string;
  userId: string;
  walletAddress: string;
  color: "w" | "b";
  socketId: string;
  connected: boolean;
  disconnectedAt: number | null;
}

export interface RoomOptions {
  matchId: string;
  timeBase: number;      // seconds
  timeIncrement: number;  // seconds
  betAmount: string;
  chain: string;
  token: string;
}

export interface RoomState {
  matchId: string;
  players: Player[];
  fen: string;
  pgn: string;
  turn: "w" | "b";
  isGameOver: boolean;
  winner: "w" | "b" | null;
  result: string | null;
  resultReason: string | null;
  times: { whiteMs: number; blackMs: number };
  moveCount: number;
  inCheck: boolean;
  status: "waiting" | "active" | "paused" | "finished";
}

export type GameResultReason =
  | "checkmate"
  | "resign"
  | "timeout"
  | "stalemate"
  | "repetition"
  | "fifty_move"
  | "insufficient_material"
  | "agreed_draw"
  | "abandoned"
  | "disconnection";

export class GameRoom {
  readonly matchId: string;
  readonly timeBase: number;
  readonly timeIncrement: number;
  readonly betAmount: string;
  readonly chain: string;
  readonly token: string;

  private engine: ChessEngine;
  private timer: ChessTimer;
  private players: Map<string, Player> = new Map();
  private status: "waiting" | "active" | "paused" | "finished" = "waiting";
  private resultReason: GameResultReason | null = null;
  private drawOfferedBy: "w" | "b" | null = null;
  private createdAt: number = Date.now();

  // Callbacks
  onStateChange: ((state: RoomState) => void) | null = null;
  onGameEnd: ((matchId: string, winner: "w" | "b" | null, reason: GameResultReason) => void) | null = null;
  onPlayerDisconnected: ((matchId: string, color: "w" | "b") => void) | null = null;

  constructor(opts: RoomOptions) {
    this.matchId = opts.matchId;
    this.timeBase = opts.timeBase;
    this.timeIncrement = opts.timeIncrement;
    this.betAmount = opts.betAmount;
    this.chain = opts.chain;
    this.token = opts.token;
    this.engine = new ChessEngine();
    this.timer = new ChessTimer(opts.timeBase, opts.timeIncrement);
  }

  addPlayer(userId: string, walletAddress: string, socketId: string): Player | null {
    if (this.players.size >= 2) return null;

    const color: "w" | "b" = this.players.size === 0 ? "w" : "b";
    const player: Player = {
      id: `${this.matchId}-${color}`,
      userId,
      walletAddress,
      color,
      socketId,
      connected: true,
      disconnectedAt: null,
    };
    this.players.set(color, player);
    return player;
  }

  startGame(): void {
    if (this.players.size !== 2) return;
    this.status = "active";
    // White moves first — timer starts after white's first move
    this.emitState();
  }

  makeMove(color: "w" | "b", from: string, to: string, promotion?: string): {
    success: boolean;
    move?: any;
    state?: RoomState;
    error?: string;
  } {
    if (this.status !== "active") return { success: false, error: "Game not active" };
    if (this.engine.getTurn() !== color) return { success: false, error: "Not your turn" };

    const move = this.engine.makeMove(from, to, promotion);
    if (!move) return { success: false, error: "Illegal move" };

    // Switch timer after successful move
    if (!this.timer.isActive()) {
      // First move — start timer for black
      this.timer.start("w", (timedOutColor) => this.handleTimeout(timedOutColor));
      this.timer.switchTurn();
    } else {
      this.timer.switchTurn();
    }

    // Cancel any pending draw offer
    if (this.drawOfferedBy && this.drawOfferedBy !== color) {
      this.drawOfferedBy = null;
    }

    const gs = this.engine.getGameState();

    if (gs.isGameOver) {
      this.endGame(gs);
    }

    this.emitState();

    return {
      success: true,
      move: {
        from: move.from,
        to: move.to,
        san: move.san,
        fen: gs.fen,
        captured: move.captured,
        promotion: move.promotion,
      },
      state: this.getState(),
    };
  }

  handleResign(color: "w" | "b"): void {
    if (this.status !== "active") return;
    const winner = color === "w" ? "b" : "w";
    this.timer.pause();
    this.status = "finished";
    this.resultReason = "resign";
    this.emitState();
    this.onGameEnd?.(this.matchId, winner, "resign");
  }

  offerDraw(color: "w" | "b"): "offered" | "accepted" | "pending" {
    if (this.status !== "active") return "pending";

    if (this.drawOfferedBy === null) {
      this.drawOfferedBy = color;
      return "offered";
    }

    if (this.drawOfferedBy !== color) {
      // Opponent already offered — draw accepted
      this.timer.pause();
      this.status = "finished";
      this.resultReason = "agreed_draw";
      this.emitState();
      this.onGameEnd?.(this.matchId, null, "agreed_draw");
      return "accepted";
    }

    return "pending";
  }

  handleDisconnect(color: "w" | "b"): void {
    const player = this.players.get(color);
    if (!player) return;
    player.connected = false;
    player.disconnectedAt = Date.now();

    if (this.status === "active") {
      this.timer.pause();
      this.status = "paused";
      this.emitState();
      this.onPlayerDisconnected?.(this.matchId, color);
    }
  }

  handleReconnect(color: "w" | "b", newSocketId: string): boolean {
    const player = this.players.get(color);
    if (!player) return false;
    player.connected = true;
    player.disconnectedAt = null;
    player.socketId = newSocketId;

    // If both connected, resume
    if (this.status === "paused" && this.allConnected()) {
      this.status = "active";
      const times = this.timer.getTimes();
      const nextColor = this.engine.getTurn();
      this.timer.resume(nextColor);
      this.emitState();
    }

    return true;
  }

  allConnected(): boolean {
    return Array.from(this.players.values()).every((p) => p.connected);
  }

  isReconnectWindowExpired(color: "w" | "b", windowSec: number): boolean {
    const player = this.players.get(color);
    if (!player || player.connected) return false;
    if (!player.disconnectedAt) return false;
    return Date.now() - player.disconnectedAt > windowSec * 1000;
  }

  handleTimeout(color: "w" | "b"): void {
    if (this.status !== "active" && this.status !== "paused") return;
    const winner = color === "w" ? "b" : "w";

    // Check if opponent has insufficient material → draw
    const gs = this.engine.getGameState();
    // chess.js doesn't directly tell us about the OTHER side's material,
    // but isInsufficientMaterial covers the whole board
    if (gs.isInsufficientMaterial) {
      this.timer.pause();
      this.status = "finished";
      this.resultReason = "insufficient_material";
      this.emitState();
      this.onGameEnd?.(this.matchId, null, "insufficient_material");
      return;
    }

    this.timer.pause();
    this.status = "finished";
    this.resultReason = "timeout";
    this.emitState();
    this.onGameEnd?.(this.matchId, winner, "timeout");
  }

  getState(): RoomState {
    const gs = this.engine.getGameState();
    const times = this.timer.getTimes();
    return {
      matchId: this.matchId,
      players: Array.from(this.players.values()),
      fen: gs.fen,
      pgn: gs.pgn,
      turn: gs.turn,
      isGameOver: gs.isGameOver,
      winner: gs.winner,
      result: gs.result,
      resultReason: this.resultReason,
      times,
      moveCount: gs.moves.length,
      inCheck: gs.inCheck,
      status: this.status,
    };
  }

  getPlayerBySocket(socketId: string): Player | undefined {
    for (const p of this.players.values()) {
      if (p.socketId === socketId) return p;
    }
    return undefined;
  }

  getPlayer(color: "w" | "b"): Player | undefined {
    return this.players.get(color);
  }

  isExpired(timeoutSec: number): boolean {
    if (this.status === "waiting" && this.players.size < 2) {
      return Date.now() - this.createdAt > timeoutSec * 1000;
    }
    return false;
  }

  private endGame(gs: GameState): void {
    this.timer.pause();
    this.status = "finished";

    if (gs.isCheckmate) {
      this.resultReason = "checkmate";
      this.onGameEnd?.(this.matchId, gs.winner, "checkmate");
    } else if (gs.isStalemate) {
      this.resultReason = "stalemate";
      this.onGameEnd?.(this.matchId, null, "stalemate");
    } else if (gs.isThreefoldRepetition) {
      this.resultReason = "repetition";
      this.onGameEnd?.(this.matchId, null, "repetition");
    } else if (gs.isDrawByFiftyMoves) {
      this.resultReason = "fifty_move";
      this.onGameEnd?.(this.matchId, null, "fifty_move");
    } else if (gs.isInsufficientMaterial) {
      this.resultReason = "insufficient_material";
      this.onGameEnd?.(this.matchId, null, "insufficient_material");
    }
  }

  private emitState(): void {
    this.onStateChange?.(this.getState());
  }

  destroy(): void {
    this.timer.destroy();
    this.onStateChange = null;
    this.onGameEnd = null;
    this.onPlayerDisconnected = null;
  }
}
