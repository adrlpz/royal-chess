"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface MatchHistory {
  id: string;
  chain: string;
  token: string;
  betAmount: string;
  status: string;
  result: string | null;
  moveCount: number;
  createdAt: string;
  player1: { walletAddress: string; username: string | null };
  player2: { walletAddress: string; username: string | null } | null;
}

export default function ProfilePage() {
  const { user, isAuthenticated, token, refreshUser } = useAuth();
  const router = useRouter();
  const [history, setHistory] = useState<MatchHistory[]>([]);
  const [username, setUsername] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !user || !token) return;
    setUsername(user.username || "");

    fetch(`${API_URL}/api/matches/user/${user.id}?limit=20`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => setHistory(data.matches || []))
      .catch(() => {});
  }, [isAuthenticated, user, token]);

  if (!isAuthenticated || !user) {
    return (
      <div className="max-w-md mx-auto py-20 text-center">
        <p className="text-dark-300">Please sign in to view your profile.</p>
        <button onClick={() => router.push("/lobby")} className="mt-4 px-6 py-2 bg-primary-600 rounded-lg">
          Go to Lobby
        </button>
      </div>
    );
  }

  const handleSaveUsername = async () => {
    if (!token) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/users/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ username }),
      });
      if (res.ok) {
        await refreshUser();
        setEditing(false);
      }
    } catch {}
    setSaving(false);
  };

  const totalGames = user.wins + user.losses + user.draws;
  const winRate = totalGames > 0 ? ((user.wins / totalGames) * 100).toFixed(1) : "0.0";
  const formatAddress = (a: string) => `${a.slice(0, 6)}...${a.slice(-4)}`;

  const resultColor = (result: string | null, isPlayer1: boolean) => {
    if (!result) return "text-dark-400";
    if (result === "CHECKMATE") return isPlayer1 ? "text-green-400" : "text-red-400";
    if (result === "RESIGN") return isPlayer1 ? "text-green-400" : "text-red-400";
    if (result === "TIMEOUT") return "text-yellow-400";
    return "text-dark-400";
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-8">👤 Profile</h1>

      {/* Stats Card */}
      <div className="bg-dark-800 rounded-xl border border-dark-700 p-6 mb-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            {editing ? (
              <div className="flex gap-2">
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="px-3 py-1 bg-dark-700 border border-dark-600 rounded text-white"
                  maxLength={20}
                />
                <button onClick={handleSaveUsername} disabled={saving} className="px-3 py-1 bg-primary-600 rounded text-sm">
                  {saving ? "..." : "Save"}
                </button>
                <button onClick={() => setEditing(false)} className="px-3 py-1 bg-dark-600 rounded text-sm">Cancel</button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold">{user.username || "Anonymous"}</h2>
                <button onClick={() => setEditing(true)} className="text-dark-400 hover:text-primary-400 text-sm">✏️ Edit</button>
              </div>
            )}
            <p className="text-dark-400 font-mono text-sm mt-1">{user.walletAddress}</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-primary-400">{user.elo}</div>
            <div className="text-sm text-dark-400">ELO Rating</div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <StatBox label="Wins" value={user.wins} color="text-green-400" />
          <StatBox label="Losses" value={user.losses} color="text-red-400" />
          <StatBox label="Draws" value={user.draws} color="text-dark-400" />
          <StatBox label="Win Rate" value={`${winRate}%`} color="text-primary-400" />
        </div>
      </div>

      {/* Match History */}
      <h2 className="text-xl font-bold mb-4">📜 Match History</h2>
      {history.length === 0 ? (
        <div className="text-center py-10 text-dark-400">
          <p className="text-3xl mb-2">♟️</p>
          <p>No matches played yet. Head to the lobby!</p>
        </div>
      ) : (
        <div className="bg-dark-800 rounded-xl border border-dark-700 overflow-hidden">
          {history.map((m) => {
            const isP1 = m.player1.walletAddress.toLowerCase() === user.walletAddress.toLowerCase();
            const opponent = isP1 ? m.player2 : m.player1;
            return (
              <div key={m.id} className="px-4 py-3 border-t border-dark-700 flex items-center justify-between hover:bg-dark-700/30 transition">
                <div>
                  <div className="text-sm font-medium">
                    vs {opponent?.username || formatAddress(opponent?.walletAddress || "...")}
                  </div>
                  <div className="text-xs text-dark-500">
                    {m.chain} • {m.token} • ${m.betAmount} • {m.moveCount} moves
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-semibold ${resultColor(m.result, isP1)}`}>
                    {m.result || m.status}
                  </div>
                  <div className="text-xs text-dark-500">
                    {new Date(m.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="bg-dark-900 rounded-lg p-4 text-center">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-dark-400 mt-1">{label}</div>
    </div>
  );
}
