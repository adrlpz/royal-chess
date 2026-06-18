"use client";
import { useState, useEffect } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface Player {
  rank: number;
  id: string;
  walletAddress: string;
  username: string | null;
  elo: number;
  wins: number;
  losses: number;
  draws: number;
  totalGames: number;
  winRate: string;
  totalEarnings: string;
}

export default function LeaderboardPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/api/leaderboard?limit=50`)
      .then((r) => r.json())
      .then((data) => setPlayers(data.players || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const getRankBadge = (rank: number) => {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return `#${rank}`;
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-8 text-center">🏆 Leaderboard</h1>

      {loading ? (
        <div className="text-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary-400 border-t-transparent mx-auto mb-4"></div>
          <p className="text-dark-400">Loading leaderboard...</p>
        </div>
      ) : players.length === 0 ? (
        <div className="text-center py-20 text-dark-400">
          <p className="text-4xl mb-4">♟️</p>
          <p>No players yet. Be the first to play!</p>
        </div>
      ) : (
        <div className="bg-dark-800 rounded-xl border border-dark-700 overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[60px_1fr_80px_80px_80px_80px] gap-2 px-4 py-3 bg-dark-900 text-xs font-medium text-dark-400 uppercase">
            <div>Rank</div>
            <div>Player</div>
            <div className="text-right">ELO</div>
            <div className="text-right">W/L/D</div>
            <div className="text-right">Win%</div>
            <div className="text-right">Games</div>
          </div>

          {/* Rows */}
          {players.map((p) => (
            <div
              key={p.id}
              className={`grid grid-cols-[60px_1fr_80px_80px_80px_80px] gap-2 px-4 py-3 border-t border-dark-700 hover:bg-dark-700/50 transition ${
                p.rank <= 3 ? "bg-dark-800/80" : ""
              }`}
            >
              <div className="font-bold text-lg">{getRankBadge(p.rank)}</div>
              <div>
                <div className="font-semibold text-sm">
                  {p.username || formatAddress(p.walletAddress)}
                </div>
                {p.username && (
                  <div className="text-xs text-dark-500 font-mono">{formatAddress(p.walletAddress)}</div>
                )}
              </div>
              <div className="text-right font-mono font-bold text-primary-400">{p.elo}</div>
              <div className="text-right text-sm">
                <span className="text-green-400">{p.wins}</span>
                <span className="text-dark-500">/</span>
                <span className="text-red-400">{p.losses}</span>
                <span className="text-dark-500">/</span>
                <span className="text-dark-400">{p.draws}</span>
              </div>
              <div className="text-right text-sm font-mono">{p.winRate}%</div>
              <div className="text-right text-sm font-mono text-dark-400">{p.totalGames}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
