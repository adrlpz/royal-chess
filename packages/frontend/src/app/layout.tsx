import type { Metadata } from "next";
import { Providers } from "@/providers";
import Navbar from "@/components/Navbar";
import "@/styles/globals.css";
import "@rainbow-me/rainbowkit/styles.css";

export const metadata: Metadata = {
  title: "Royal Chess — Chess PvP Crypto Betting",
  description: "Online chess player vs player with crypto betting on Base, BNB Chain & Solana",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-dark-950 text-dark-50 antialiased">
        <Providers>
          <div className="flex flex-col min-h-screen">
            <Navbar />
            <main className="flex-1">{children}</main>
            <footer className="border-t border-dark-700 py-6 text-center text-dark-500 text-sm">
              <p>Royal Chess © 2026 — Chess PvP Crypto Betting</p>
              <p className="mt-1">Base • BNB Chain • Solana</p>
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
