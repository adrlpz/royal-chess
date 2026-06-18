"use client";

interface GameTimerProps {
  timeMs: number;
  isActive: boolean;
  color: "w" | "b";
  label: string;
  elo?: number;
}

export default function GameTimer({ timeMs, isActive, color, label, elo }: GameTimerProps) {
  const minutes = Math.floor(timeMs / 60000);
  const seconds = Math.floor((timeMs % 60000) / 1000);
  const isLow = timeMs < 30000; // under 30s
  const isCritical = timeMs < 10000; // under 10s

  return (
    <div
      className={`
        flex items-center justify-between px-4 py-2 rounded-lg
        ${color === "w" ? "timer-white" : "timer-black"}
        ${isActive ? "timer-active" : ""}
        ${isCritical && isActive ? "timer-low" : ""}
      `}
    >
      <div className="flex items-center gap-2">
        <span className="text-lg">{color === "w" ? "♔" : "♚"}</span>
        <span className="font-semibold text-sm">{label}</span>
        {elo && <span className="text-xs opacity-60">({elo})</span>}
      </div>
      <div className={`font-mono text-xl font-bold ${isLow && isActive ? "text-red-500" : ""}`}>
        {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
      </div>
    </div>
  );
}
