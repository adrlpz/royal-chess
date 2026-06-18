/**
 * Server-side chess clock for each game room.
 * Tracks remaining time for white and black, handles increment.
 */
export class ChessTimer {
  private whiteMs: number;
  private blackMs: number;
  private incrementMs: number;
  private activeColor: "w" | "b" | null = null;
  private lastTick: number = 0;
  private interval: ReturnType<typeof setInterval> | null = null;
  private onTimeout: ((color: "w" | "b") => void) | null = null;

  constructor(baseSeconds: number, incrementSeconds: number) {
    this.whiteMs = baseSeconds * 1000;
    this.blackMs = baseSeconds * 1000;
    this.incrementMs = incrementSeconds * 1000;
  }

  start(color: "w" | "b", onTimeout: (color: "w" | "b") => void): void {
    this.activeColor = color;
    this.lastTick = Date.now();
    this.onTimeout = onTimeout;
    this.tick();
  }

  switchTurn(): void {
    if (!this.activeColor) return;

    const now = Date.now();
    const elapsed = now - this.lastTick;

    if (this.activeColor === "w") {
      this.whiteMs -= elapsed;
      this.whiteMs += this.incrementMs;
      if (this.whiteMs <= 0) {
        this.whiteMs = 0;
        this.activeColor = null;
        this.onTimeout?.("w");
        return;
      }
      this.activeColor = "b";
    } else {
      this.blackMs -= elapsed;
      this.blackMs += this.incrementMs;
      if (this.blackMs <= 0) {
        this.blackMs = 0;
        this.activeColor = null;
        this.onTimeout?.("b");
        return;
      }
      this.activeColor = "w";
    }

    this.lastTick = now;
  }

  getTimes(): { whiteMs: number; blackMs: number } {
    if (this.activeColor) {
      const now = Date.now();
      const elapsed = now - this.lastTick;
      if (this.activeColor === "w") {
        return { whiteMs: Math.max(0, this.whiteMs - elapsed), blackMs: this.blackMs };
      } else {
        return { whiteMs: this.whiteMs, blackMs: Math.max(0, this.blackMs - elapsed) };
      }
    }
    return { whiteMs: this.whiteMs, blackMs: this.blackMs };
  }

  pause(): void {
    if (this.activeColor) {
      const now = Date.now();
      const elapsed = now - this.lastTick;
      if (this.activeColor === "w") this.whiteMs -= elapsed;
      else this.blackMs -= elapsed;
      this.activeColor = null;
    }
  }

  resume(color: "w" | "b"): void {
    this.activeColor = color;
    this.lastTick = Date.now();
    this.tick();
  }

  isActive(): boolean {
    return this.activeColor !== null;
  }

  private tick(): void {
    if (this.interval) clearInterval(this.interval);
    this.interval = setInterval(() => {
      const { whiteMs, blackMs } = this.getTimes();
      if (whiteMs <= 0) {
        this.whiteMs = 0;
        this.activeColor = null;
        if (this.interval) clearInterval(this.interval);
        this.onTimeout?.("w");
      } else if (blackMs <= 0) {
        this.blackMs = 0;
        this.activeColor = null;
        if (this.interval) clearInterval(this.interval);
        this.onTimeout?.("b");
      }
    }, 200);
  }

  destroy(): void {
    if (this.interval) clearInterval(this.interval);
    this.activeColor = null;
  }
}
