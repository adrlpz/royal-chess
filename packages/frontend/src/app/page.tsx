"use client";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { useAuth } from "@/hooks/useAuth";

export default function HomePage() {
  const { isConnected } = useAccount();
  const { isAuthenticated, signIn, user, isLoading } = useAuth();

  return (
    <div className="max-w-5xl mx-auto px-4 py-16">
      {/* Hero */}
      <section className="text-center mb-20">
        <h1 className="text-6xl font-bold mb-6">
          <span className="text-primary-400">♟️ Royal Chess</span>
        </h1>
        <p className="text-xl text-dark-300 mb-8 max-w-2xl mx-auto">
          Play chess. Bet crypto. Win big.<br />
          PvP chess betting on <span className="text-blue-400">Base</span>,{" "}
          <span className="text-yellow-400">BNB Chain</span> &{" "}
          <span className="text-purple-400">Solana</span>.
        </p>

        <div className="flex flex-col items-center gap-4">
          {!isConnected ? (
            <ConnectButton />
          ) : !isAuthenticated ? (
            <button
              onClick={signIn}
              disabled={isLoading}
              className="px-8 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-semibold text-lg transition disabled:opacity-50"
            >
              {isLoading ? "Signing in..." : "Sign In with Wallet"}
            </button>
          ) : (
            <a
              href="/lobby"
              className="px-8 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-semibold text-lg transition"
            >
              Enter Lobby →
            </a>
          )}
        </div>
      </section>

      {/* Features */}
      <section className="grid md:grid-cols-3 gap-8 mb-20">
        <FeatureCard
          icon="🔗"
          title="Trustless Escrow"
          desc="Smart contracts hold your bets. No middleman. Code is law."
        />
        <FeatureCard
          icon="⚡"
          title="Multi-Chain"
          desc="Play with ETH, BNB, SOL, USDC, or USDT on Base, BSC, and Solana."
        />
        <FeatureCard
          icon="🏆"
          title="5% Platform Fee"
          desc="Only 5% from the pot. Winner gets 95%. Low, transparent, on-chain."
        />
        <FeatureCard
          icon="🎯"
          title="ELO Rating"
          desc="Chess.com-style ELO system. Track your progress across time controls."
        />
        <FeatureCard
          icon="🔒"
          title="Anti-Cheat"
          desc="Server-side move validation, statistical analysis, and community reports."
        />
        <FeatureCard
          icon="📱"
          title="Real-time Gameplay"
          desc="WebSocket-powered. Sub-100ms move latency. Reconnection support."
        />
      </section>

      {/* Stats placeholder */}
      <section className="text-center py-12 border-t border-dark-700">
        <div className="grid grid-cols-3 gap-8 max-w-lg mx-auto">
          <Stat value="--" label="Games Played" />
          <Stat value="--" label="Total Volume" />
          <Stat value="--" label="Active Players" />
        </div>
      </section>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="p-6 bg-dark-800 rounded-xl border border-dark-700 hover:border-primary-600 transition">
      <div className="text-3xl mb-3">{icon}</div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-dark-400 text-sm">{desc}</p>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-2xl font-bold text-primary-400">{value}</div>
      <div className="text-sm text-dark-400">{label}</div>
    </div>
  );
}
