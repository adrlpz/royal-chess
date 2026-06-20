import { Chess, Move } from "chess.js";

export interface GameState {
  fen: string;
  pgn: string;
  moves: string[];
  isGameOver: boolean;
  isCheckmate: boolean;
  isDraw: boolean;
  isStalemate: boolean;
  isThreefoldRepetition: boolean;
  isInsufficientMaterial: boolean;
  isDrawByFiftyMoves: boolean;
  turn: "w" | "b";
  winner: "w" | "b" | null; // null = draw or ongoing
  result: string | null; // "1-0", "0-1", "1/2-1/2"
  inCheck: boolean;
}

export class ChessEngine {
  private chess: Chess;

  constructor(fen?: string, pgn?: string) {
    this.chess = new Chess();
    if (pgn) {
      try {
        this.chess.loadPgn(pgn);
      } catch {
        if (fen) this.chess.load(fen);
      }
    } else if (fen && fen !== this.chess.fen()) {
      this.chess.load(fen);
    }
  }

  makeMove(from: string, to: string, promotion?: string): Move | null {
    try {
      const move = this.chess.move({ from, to, promotion: promotion || "q" });
      return move;
    } catch {
      return null;
    }
  }

  getLegalMoves(square?: string): string[] {
    if (square) {
      return this.chess.moves({ square: square as any, verbose: false });
    }
    return this.chess.moves();
  }

  isLegalMove(from: string, to: string): boolean {
    try {
      const moves = this.chess.moves({ square: from as any, verbose: true });
      return moves.some((m: any) => m.to === to);
    } catch {
      return false;
    }
  }

  getGameState(): GameState {
    const isGameOver = this.chess.isGameOver();
    const isCheckmate = this.chess.isCheckmate();
    const isDraw = this.chess.isDraw();
    const isStalemate = this.chess.isStalemate();
    const isThreefoldRepetition = this.chess.isThreefoldRepetition();
    const isInsufficientMaterial = this.chess.isInsufficientMaterial();
    const isDrawByFiftyMoves = this.chess.isDrawByFiftyMoves();

    let winner: "w" | "b" | null = null;
    let result: string | null = null;

    if (isCheckmate) {
      winner = this.chess.turn() === "w" ? "b" : "w";
      result = winner === "w" ? "1-0" : "0-1";
    } else if (isDraw || isStalemate || isThreefoldRepetition || isInsufficientMaterial || isDrawByFiftyMoves) {
      result = "1/2-1/2";
    }

    return {
      fen: this.chess.fen(),
      pgn: this.chess.pgn(),
      moves: this.chess.history(),
      isGameOver,
      isCheckmate,
      isDraw,
      isStalemate,
      isThreefoldRepetition,
      isInsufficientMaterial,
      isDrawByFiftyMoves,
      turn: this.chess.turn(),
      winner,
      result,
      inCheck: this.chess.inCheck(),
    };
  }

  getFen(): string {
    return this.chess.fen();
  }

  getPgn(): string {
    return this.chess.pgn();
  }

  getTurn(): "w" | "b" {
    return this.chess.turn();
  }

  undo(): Move | null {
    return this.chess.undo();
  }

  reset(): void {
    this.chess.reset();
  }
}
