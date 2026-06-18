"use client";
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { SiweMessage } from "siwe";

interface User {
  id: string;
  walletAddress: string;
  username: string | null;
  elo: number;
  wins: number;
  losses: number;
  draws: number;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: () => Promise<void>;
  signOut: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,
  signIn: async () => {},
  signOut: () => {},
  refreshUser: async () => {},
});

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();

  // Restore token from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("royalchess_token");
    const storedUser = localStorage.getItem("royalchess_user");
    if (stored && storedUser) {
      setToken(stored);
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  const signIn = useCallback(async () => {
    if (!address) throw new Error("No wallet connected");
    setIsLoading(true);

    try {
      // Get nonce
      const nonceRes = await fetch(`${API_URL}/api/auth/nonce`);
      const { nonce } = await nonceRes.json();

      // Build SIWE message
      const siwe = new SiweMessage({
        domain: window.location.host,
        address,
        statement: "Sign in to Royal Chess — Chess PvP Betting",
        uri: window.location.origin,
        version: "1",
        chainId: 8453, // Default, actual chain from wallet
        nonce,
      });
      const message = siwe.prepareMessage();

      // Sign
      const signature = await signMessageAsync({ message });

      // Verify
      const verifyRes = await fetch(`${API_URL}/api/auth/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, signature, nonce }),
      });

      if (!verifyRes.ok) throw new Error("Auth failed");

      const data = await verifyRes.json();
      setToken(data.token);
      setUser(data.user);
      localStorage.setItem("royalchess_token", data.token);
      localStorage.setItem("royalchess_user", JSON.stringify(data.user));
    } catch (err) {
      console.error("[Auth] Sign-in failed:", err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [address, signMessageAsync]);

  const signOut = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("royalchess_token");
    localStorage.removeItem("royalchess_user");
  }, []);

  const refreshUser = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
        localStorage.setItem("royalchess_user", JSON.stringify(data));
      }
    } catch {}
  }, [token]);

  // Auto sign-out on wallet disconnect
  useEffect(() => {
    if (!isConnected && user) {
      signOut();
    }
  }, [isConnected]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!token && !!user,
        signIn,
        signOut,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
