"use client";
import { useState, useCallback, useEffect } from "react";
import { Chess, Square } from "chess.js";

interface ChessBoardProps {
  fen: string;
  playerColor: "w" | "b";
  onMove: (from: string, to: string, promotion?: string) => void;
  lastMove?: { from: string; to: string } | null;
  isGameOver: boolean;
  inCheck: boolean;
}

const PIECE_UNICODE: Record<string, string> = {
  K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙",
  k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟",
};

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = ["1", "2", "3", "4", "5", "6", "7", "8"];

export default function ChessBoard({
  fen,
  playerColor,
  onMove,
  lastMove,
  isGameOver,
  inCheck,
}: ChessBoardProps) {
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalMoves, setLegalMoves] = useState<string[]>([]);
  const [chess] = useState(() => new Chess());

  // Update chess position when fen changes
  useEffect(() => {
    try {
      chess.load(fen);
    } catch {}
  }, [fen, chess]);

  const board = chess.board();
  const isFlipped = playerColor === "b";

  const handleSquareClick = useCallback(
    (square: string) => {
      if (isGameOver) return;

      const piece = chess.get(square as Square);

      if (selectedSquare) {
        // Try to make a move
        if (legalMoves.includes(square)) {
          onMove(selectedSquare, square);
          setSelectedSquare(null);
          setLegalMoves([]);
          return;
        }
        // Deselect or select new piece
        if (piece && piece.color === playerColor) {
          setSelectedSquare(square);
          const moves = chess.moves({ square: square as Square, verbose: true });
          setLegalMoves(moves.map((m: any) => m.to));
        } else {
          setSelectedSquare(null);
          setLegalMoves([]);
        }
      } else if (piece && piece.color === playerColor) {
        setSelectedSquare(square);
        const moves = chess.moves({ square: square as Square, verbose: true });
        setLegalMoves(moves.map((m: any) => m.to));
      }
    },
    [selectedSquare, legalMoves, playerColor, isGameOver, chess, onMove]
  );

  const getSquareColor = (file: number, rank: number): string => {
    const isLight = (file + rank) % 2 === 0;
    const square = FILES[file] + RANKS[rank];

    if (square === selectedSquare) return "bg-blue-500/40";
    if (legalMoves.includes(square)) return isLight ? "bg-green-400/40" : "bg-green-600/40";
    if (lastMove && (square === lastMove.from || square === lastMove.to))
      return "bg-yellow-400/30";

    return isLight ? "bg-[#f0d9b5]" : "bg-[#b58863]";
  };

  const renderSquare = (file: number, rank: number) => {
    const f = isFlipped ? 7 - file : file;
    const r = isFlipped ? 7 - rank : rank;
    const square = FILES[f] + RANKS[r];
    const piece = board[r]?.[f];
    const isKing = piece?.type === "k" && piece?.color === playerColor && inCheck;

    return (
      <div
        key={square}
        onClick={() => handleSquareClick(square)}
        className={`
          ${getSquareColor(file, rank)}
          flex items-center justify-center cursor-pointer
          select-none relative
          ${isKing ? "ring-2 ring-red-500 ring-inset" : ""}
        `}
        style={{ aspectRatio: "1" }}
      >
        {piece && (
          <span
            className={`text-4xl md:text-5xl leading-none ${
              piece.color === "w" ? "drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]" : ""
            }`}
            style={{ filter: piece.color === "w" ? "brightness(1.2)" : "brightness(0.8)" }}
          >
            {PIECE_UNICODE[piece.color === "w" ? piece.type.toUpperCase() : piece.type]}
          </span>
        )}
        {/* Legal move dot */}
        {legalMoves.includes(square) && !piece && (
          <div className="absolute w-3 h-3 rounded-full bg-dark-900/30" />
        )}
        {/* Legal move capture ring */}
        {legalMoves.includes(square) && piece && (
          <div className="absolute inset-0 rounded-full border-4 border-dark-900/30" />
        )}
      </div>
    );
  };

  return (
    <div className="select-none">
      <div
        className="grid grid-cols-8 border-2 border-dark-600 rounded overflow-hidden"
        style={{ maxWidth: "480px", margin: "0 auto" }}
      >
        {Array.from({ length: 8 }, (_, rank) =>
          Array.from({ length: 8 }, (_, file) => renderSquare(file, rank))
        )}
      </div>
      {/* Rank labels */}
      <div
        className="flex justify-between px-1 mt-1 text-xs text-dark-500"
        style={{ maxWidth: "480px", margin: "4px auto 0" }}
      >
        {(isFlipped ? [...FILES].reverse() : FILES).map((f) => (
          <span key={f}>{f}</span>
        ))}
      </div>
    </div>
  );
}
