"use client";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";

export default function Navbar() {
  const { isAuthenticated, user, signOut } = useAuth();

  return (
    <header className="border-b border-dark-700 bg-dark-900/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl">♟️</span>
          <span className="text-xl font-bold text-primary-400">Royal Chess</span>
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          <Link href="/lobby" className="text-dark-300 hover:text-primary-400 transition text-sm font-medium">
            Lobby
          </Link>
          <Link href="/leaderboard" className="text-dark-300 hover:text-primary-400 transition text-sm font-medium">
            Leaderboard
          </Link>
          {isAuthenticated && (
            <Link href="/profile" className="text-dark-300 hover:text-primary-400 transition text-sm font-medium">
              Profile
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-3">
          {isAuthenticated && user && (
            <div className="hidden sm:flex items-center gap-2 text-sm">
              <span className="text-dark-400">ELO</span>
              <span className="font-mono font-bold text-primary-400">{user.elo}</span>
            </div>
          )}
          <ConnectButton
            accountStatus="avatar"
            chainStatus="icon"
            showBalance={false}
          />
        </div>
      </div>
    </header>
  );
}
