"use client";
import { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { useAuth } from "@/hooks/useAuth";
import { useSocket } from "@/hooks/useSocket";
import { useRouter } from "next/navigation";

const TIME_CONTROLS = [
  { label: "1 min", value: "1+0", category: "Bullet" },
  { label: "2+1", value: "2+1", category: "Bullet" },
  { label: "3 min", value: "3+0", category: "Blitz" },
  { label: "5 min", value: "5+0", category: "Blitz" },
  { label: "5+3", value: "5+3", category: "Blitz" },
  { label: "10 min", value: "10+0", category: "Rapid" },
  { label: "15+10", value: "15+10", category: "Rapid" },
];

const CHAINS = [
  { id: "BASE", name: "Base", color: "text-blue-400", icon: "🔵" },
  { id: "BSC", name: "BNB Chain", color: "text-yellow-400", icon: "🟡" },
  { id: "SOLANA", name: "Solana", color: "text-purple-400", icon: "🟣" },
];

const TOKENS: Record<string, string[]> = {
  BASE: ["ETH", "USDC", "USDT"],
  BSC: ["BNB", "USDC", "USDT"],
  SOLANA: ["SOL", "USDC", "USDT"],
};

export default function LobbyPage() {
  const { isConnected } = useAccount();
  const { isAuthenticated, signIn, isLoading: authLoading, user } = useAuth();
  const { socket } = useSocket();
  const router = useRouter();

  const [timeControl, setTimeControl] = useState("5+0");
  const [chain, setChain] = useState("BASE");
  const [token, setToken] = useState("ETH");
  const [betAmount, setBetAmount] = useState("10");
  const [isSearching, setIsSearching] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  const handleQuickMatch = () => {
    if (!socket || !isAuthenticated) return;

    setIsSearching(true);
    setStatusMsg("Searching for opponent...");

    socket.emit(
      "matchmaking:join",
      {
        timeControl,
        betMin: betAmount,
        betMax: betAmount,
        chain,
        token,
      },
      (response: any) => {
        if (response.success && response.matched) {
          setStatusMsg("Match found! Redirecting...");
          router.push(`/game/${response.matchId}`);
        } else if (response.success) {
          setStatusMsg("Queued. Waiting for opponent...");
        } else {
          setIsSearching(false);
          setStatusMsg(`Error: ${response.error}`);
        }
      }
    );
  };

  const handleCancelSearch = () => {
    if (!socket) return;
    socket.emit("matchmaking:cancel", {}, () => {
      setIsSearching(false);
      setStatusMsg("");
    });
  };

  // Listen for match found while queued
  if (socket && isSearching) {
    socket.off("match:found");
    socket.on("match:found", (data: any) => {
      setIsSearching(false);
      router.push(`/game/${data.matchId}`);
    });
  }

  if (!isConnected) {
    return (
      <div className="max-w-md mx-auto py-20 text-center">
        <h2 className="text-2xl font-bold mb-6">Connect Wallet to Play</h2>
        <ConnectButton />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto py-20 text-center">
        <h2 className="text-2xl font-bold mb-6">Sign In Required</h2>
        <button
          onClick={signIn}
          disabled={authLoading}
          className="px-6 py-3 bg-primary-600 hover:bg-primary-700 rounded-lg font-semibold transition"
        >
          {authLoading ? "Signing in..." : "Sign In with Wallet"}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-8 text-center">♟️ Quick Match</h1>

      {/* User Info */}
      {user && (
        <div className="mb-8 p-4 bg-dark-800 rounded-lg border border-dark-700 flex items-center justify-between">
          <div>
            <span className="text-dark-400">Playing as</span>{" "}
            <span className="font-semibold">{user.username || user.walletAddress.slice(0, 8) + "..."}</span>
          </div>
          <div className="text-primary-400 font-mono">ELO {user.elo}</div>
        </div>
      )}

      {/* Time Control */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-dark-300 mb-3">Time Control</label>
        <div className="grid grid-cols-4 gap-2">
          {TIME_CONTROLS.map((tc) => (
            <button
              key={tc.value}
              onClick={() => setTimeControl(tc.value)}
              className={`py-2 px-3 rounded-lg text-sm font-medium transition ${
                timeControl === tc.value
                  ? "bg-primary-600 text-white"
                  : "bg-dark-800 text-dark-300 hover:bg-dark-700"
              }`}
            >
              <div>{tc.label}</div>
              <div className="text-xs text-dark-400">{tc.category}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Chain & Token */}
      <div className="mb-6 grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-dark-300 mb-3">Chain</label>
          <div className="flex flex-col gap-2">
            {CHAINS.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setChain(c.id);
                  setToken(TOKENS[c.id][0]);
                }}
                className={`py-2 px-4 rounded-lg text-sm font-medium transition ${
                  chain === c.id
                    ? "bg-primary-600 text-white"
                    : "bg-dark-800 text-dark-300 hover:bg-dark-700"
                }`}
              >
                {c.icon} {c.name}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-dark-300 mb-3">Token</label>
          <div className="flex flex-col gap-2">
            {TOKENS[chain]?.map((t) => (
              <button
                key={t}
                onClick={() => setToken(t)}
                className={`py-2 px-4 rounded-lg text-sm font-medium transition ${
                  token === t
                    ? "bg-primary-600 text-white"
                    : "bg-dark-800 text-dark-300 hover:bg-dark-700"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bet Amount */}
      <div className="mb-8">
        <label className="block text-sm font-medium text-dark-300 mb-3">
          Bet Amount (USD)
        </label>
        <div className="flex gap-2 mb-2">
          {["5", "10", "25", "50", "100", "500"].map((amt) => (
            <button
              key={amt}
              onClick={() => setBetAmount(amt)}
              className={`py-2 px-3 rounded-lg text-sm font-medium transition ${
                betAmount === amt
                  ? "bg-primary-600 text-white"
                  : "bg-dark-800 text-dark-300 hover:bg-dark-700"
              }`}
            >
              ${amt}
            </button>
          ))}
        </div>
        <input
          type="number"
          min="1"
          max="10000"
          value={betAmount}
          onChange={(e) => setBetAmount(e.target.value)}
          className="w-full px-4 py-3 bg-dark-800 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-primary-500"
          placeholder="Custom amount"
        />
        <div className="mt-2 text-sm text-dark-400">
          Pot: <span className="text-white">${parseInt(betAmount || "0") * 2}</span> •
          Fee (5%): <span className="text-yellow-400">${parseInt(betAmount || "0") * 0.1}</span> •
          Winner gets: <span className="text-primary-400">${parseInt(betAmount || "0") * 1.9}</span>
        </div>
      </div>

      {/* Action Buttons */}
      {!isSearching ? (
        <button
          onClick={handleQuickMatch}
          className="w-full py-4 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold text-lg transition"
        >
          ⚡ Quick Match — ${betAmount} on {chain}
        </button>
      ) : (
        <div className="text-center">
          <div className="mb-4">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-primary-400 border-t-transparent"></div>
          </div>
          <p className="text-dark-300 mb-4">{statusMsg}</p>
          <button
            onClick={handleCancelSearch}
            className="px-6 py-2 bg-dark-700 hover:bg-dark-600 rounded-lg text-sm transition"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
