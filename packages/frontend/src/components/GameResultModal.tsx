"use client";

interface GameResultModalProps {
  isOpen: boolean;
  winner: "w" | "b" | null;
  reason: string | null;
  playerColor: "w" | "b";
  betAmount: string;
  onClose: () => void;
  onRematch: () => void;
}

export default function GameResultModal({
  isOpen, winner, reason, playerColor, betAmount, onClose, onRematch,
}: GameResultModalProps) {
  if (!isOpen) return null;

  const isWinner = winner === playerColor;
  const isDraw = winner === null;
  const payout = isWinner ? (parseFloat(betAmount) * 1.9).toFixed(2) : "0";

  const reasonText: Record<string, string> = {
    checkmate: "by Checkmate",
    resign: "by Resignation",
    timeout: "on Time",
    stalemate: "Stalemate",
    repetition: "Threefold Repetition",
    fifty_move: "50-Move Rule",
    insufficient_material: "Insufficient Material",
    agreed_draw: "by Agreement",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-dark-800 rounded-2xl border border-dark-600 p-8 max-w-md w-full mx-4 text-center">
        <div className="text-6xl mb-4">
          {isWinner ? "🏆" : isDraw ? "🤝" : "😔"}
        </div>
        <h2 className={`text-2xl font-bold mb-2 ${
          isWinner ? "text-primary-400" : isDraw ? "text-yellow-400" : "text-red-400"
        }`}>
          {isWinner ? "You Won!" : isDraw ? "Draw" : "You Lost"}
        </h2>
        <p className="text-dark-300 mb-4">
          {reason ? reasonText[reason] || reason : ""}
        </p>
        {isWinner && (
          <div className="mb-6 p-4 bg-primary-900/30 rounded-lg border border-primary-700">
            <div className="text-sm text-dark-300">Payout (after 5% fee)</div>
            <div className="text-2xl font-bold text-primary-400">+${payout}</div>
          </div>
        )}
        {isDraw && (
          <div className="mb-6 p-4 bg-dark-700 rounded-lg">
            <div className="text-sm text-dark-300">Both players refunded</div>
            <div className="text-lg font-semibold">${betAmount}</div>
          </div>
        )}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-dark-700 hover:bg-dark-600 rounded-lg transition"
          >
            Close
          </button>
          <button
            onClick={onRematch}
            className="flex-1 py-3 bg-primary-600 hover:bg-primary-700 rounded-lg font-semibold transition"
          >
            Rematch
          </button>
        </div>
      </div>
    </div>
  );
}
