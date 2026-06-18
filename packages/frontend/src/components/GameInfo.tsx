"use client";

interface GameInfoProps {
  betAmount: string;
  chain: string;
  token: string;
  pot: string;
  fee: string;
  winnerGets: string;
  moveCount: number;
  status: string;
}

export default function GameInfo({
  betAmount, chain, token, pot, fee, winnerGets, moveCount, status,
}: GameInfoProps) {
  return (
    <div className="bg-dark-800 rounded-lg border border-dark-700 p-4 space-y-3">
      <div className="text-sm font-medium text-dark-300 border-b border-dark-700 pb-2">
        💰 Bet Info
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="text-dark-400">Chain</div>
        <div className="font-medium">{chain}</div>
        <div className="text-dark-400">Token</div>
        <div className="font-medium">{token}</div>
        <div className="text-dark-400">Bet / player</div>
        <div className="font-medium">${betAmount}</div>
        <div className="text-dark-400">Total Pot</div>
        <div className="font-medium text-white">${pot}</div>
        <div className="text-dark-400">Fee (5%)</div>
        <div className="font-medium text-yellow-400">${fee}</div>
        <div className="text-dark-400">Winner gets</div>
        <div className="font-medium text-primary-400">${winnerGets}</div>
      </div>
      <div className="border-t border-dark-700 pt-2 flex justify-between text-sm">
        <span className="text-dark-400">Moves</span>
        <span className="font-mono">{moveCount}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-dark-400">Status</span>
        <span className={`font-medium ${
          status === "active" ? "text-primary-400" :
          status === "finished" ? "text-red-400" :
          "text-yellow-400"
        }`}>{status}</span>
      </div>
    </div>
  );
}
