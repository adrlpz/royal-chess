"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useSocket } from "@/hooks/useSocket";
import ChessBoard from "@/components/ChessBoard";
import GameTimer from "@/components/GameTimer";
import MoveList from "@/components/MoveList";
import GameInfo from "@/components/GameInfo";
import GameResultModal from "@/components/GameResultModal";

interface Player {
  id: string;
  userId: string;
  walletAddress: string;
  color: "w" | "b";
  connected: boolean;
}

interface GameState {
  matchId: string;
  players: Player[];
  fen: string;
  pgn: string;
  turn: "w" | "b";
  isGameOver: boolean;
  winner: "w" | "b" | null;
  result: string | null;
  resultReason: string | null;
  times: { whiteMs: number; blackMs: number };
  moveCount: number;
  inCheck: boolean;
  status: string;
}

interface ChatMessage {
  from: string;
  message: string;
  timestamp: number;
}

const CHAT_PRESETS = ["GG", "Good luck!", "Well played!", "Good game!", "Thanks!", "Nice move!"];

export default function GamePage() {
  const params = useParams();
  const router = useRouter();
  const matchId = params.matchId as string;
  const { user, isAuthenticated } = useAuth();
  const { socket } = useSocket();

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerColor, setPlayerColor] = useState<"w" | "b">("w");
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);
  const [drawOffered, setDrawOffered] = useState(false);
  const [error, setError] = useState("");

  // Derive moves array from PGN
  const moves: string[] = gameState?.pgn
    ? gameState.pgn.split(/\d+\.\s*/).filter(Boolean).flatMap((m) => m.trim().split(/\s+/))
    : [];

  // Bet calculations
  const betAmount = "10"; // TODO: get from match data
  const pot = (parseFloat(betAmount) * 2).toFixed(2);
  const fee = (parseFloat(pot) * 0.05).toFixed(2);
  const winnerGets = (parseFloat(pot) - parseFloat(fee)).toFixed(2);

  useEffect(() => {
    if (!socket || !isAuthenticated) return;

    // Try to reconnect to existing game
    socket.emit("game:reconnect", { matchId }, (res: any) => {
      if (res.success) {
        setGameState(res.state);
        const me = res.state.players.find((p: Player) => p.userId === user?.id);
        if (me) setPlayerColor(me.color);
      }
    });

    // Listen for game state updates
    socket.on("game:moved", (data: any) => {
      setGameState((prev) => prev ? { ...prev, ...data } : null);
      setLastMove({ from: data.from, to: data.to });
    });

    socket.on("game:state", (state: GameState) => {
      setGameState(state);
    });

    socket.on("game:ended", (data: any) => {
      setGameState((prev) => prev ? { ...prev, isGameOver: true, winner: data.winner, resultReason: data.reason, status: "finished" } : null);
      setShowResult(true);
    });

    socket.on("game:player_disconnected", (data: any) => {
      setOpponentDisconnected(true);
    });

    socket.on("game:player_reconnected", () => {
      setOpponentDisconnected(false);
    });

    socket.on("game:draw_offered", () => {
      setDrawOffered(true);
    });

    socket.on("game:draw_declined", () => {
      setDrawOffered(false);
    });

    socket.on("game:draw_accepted", () => {
      setGameState((prev) => prev ? { ...prev, isGameOver: true, resultReason: "agreed_draw", status: "finished" } : null);
      setShowResult(true);
    });

    socket.on("chat:message", (msg: ChatMessage) => {
      setChatMessages((prev) => [...prev.slice(-49), msg]);
    });

    return () => {
      socket.off("game:moved");
      socket.off("game:state");
      socket.off("game:ended");
      socket.off("game:player_disconnected");
      socket.off("game:player_reconnected");
      socket.off("game:draw_offered");
      socket.off("game:draw_declined");
      socket.off("game:draw_accepted");
      socket.off("chat:message");
    };
  }, [socket, matchId, isAuthenticated, user?.id]);

  const handleMove = useCallback((from: string, to: string, promotion?: string) => {
    if (!socket || !gameState || gameState.turn !== playerColor) return;
    socket.emit("game:move", { matchId, from, to, promotion }, (res: any) => {
      if (!res.success) setError(res.error || "Move failed");
    });
  }, [socket, matchId, gameState, playerColor]);

  const handleResign = () => {
    if (!socket || !confirm("Are you sure you want to resign?")) return;
    socket.emit("game:resign", { matchId });
  };

  const handleOfferDraw = () => {
    if (!socket) return;
    socket.emit("game:draw_offer", { matchId });
  };

  const handleAcceptDraw = () => {
    if (!socket) return;
    socket.emit("game:draw_offer", { matchId });
    setDrawOffered(false);
  };

  const handleDeclineDraw = () => {
    if (!socket) return;
    socket.emit("game:draw_decline", { matchId });
    setDrawOffered(false);
  };

  const handleChat = (msg: string) => {
    if (!socket) return;
    socket.emit("chat:send", { matchId, message: msg });
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto py-20 text-center">
        <p className="text-dark-300">Please sign in to view this game.</p>
        <button onClick={() => router.push("/lobby")} className="mt-4 px-6 py-2 bg-primary-600 rounded-lg">
          Go to Lobby
        </button>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-400 border-t-transparent mx-auto mb-4"></div>
          <p className="text-dark-300">Loading game...</p>
        </div>
      </div>
    );
  }

  const opponent = gameState.players.find((p) => p.color !== playerColor);
  const myPlayer = gameState.players.find((p) => p.color === playerColor);
  const opponentLabel = opponent?.walletAddress.slice(0, 8) + "..." || "Waiting...";
  const myLabel = myPlayer?.walletAddress.slice(0, 8) + "..." || "You";

  // Determine which timer is on top (opponent on top, me on bottom)
  const topColor = playerColor === "w" ? "b" : "w";
  const bottomColor = playerColor;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Opponent disconnected banner */}
      {opponentDisconnected && (
        <div className="mb-4 p-3 bg-yellow-900/30 border border-yellow-700 rounded-lg text-center text-yellow-300">
          Opponent disconnected. Waiting to reconnect (60s)...
        </div>
      )}

      {/* Draw offer */}
      {drawOffered && (
        <div className="mb-4 p-3 bg-blue-900/30 border border-blue-700 rounded-lg flex items-center justify-between">
          <span className="text-blue-300">Opponent offers a draw</span>
          <div className="flex gap-2">
            <button onClick={handleAcceptDraw} className="px-4 py-1 bg-primary-600 rounded text-sm">Accept</button>
            <button onClick={handleDeclineDraw} className="px-4 py-1 bg-dark-600 rounded text-sm">Decline</button>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        {/* Left: Board + Timers */}
        <div>
          {/* Opponent timer (top) */}
          <div className="mb-2">
            <GameTimer
              timeMs={gameState.times[topColor === "w" ? "whiteMs" : "blackMs"]}
              isActive={gameState.turn === topColor && gameState.status === "active"}
              color={topColor}
              label={opponentLabel}
              elo={opponent ? undefined : undefined}
            />
          </div>

          {/* Chess Board */}
          <div className="board-container">
            <ChessBoard
              fen={gameState.fen}
              playerColor={playerColor}
              onMove={handleMove}
              lastMove={lastMove}
              isGameOver={gameState.isGameOver}
              inCheck={gameState.inCheck}
            />
          </div>

          {/* My timer (bottom) */}
          <div className="mt-2">
            <GameTimer
              timeMs={gameState.times[bottomColor === "w" ? "whiteMs" : "blackMs"]}
              isActive={gameState.turn === bottomColor && gameState.status === "active"}
              color={bottomColor}
              label={myLabel}
            />
          </div>

          {/* Game controls */}
          {gameState.status === "active" && (
            <div className="mt-4 flex gap-2 justify-center">
              <button onClick={handleOfferDraw} className="px-4 py-2 bg-dark-700 hover:bg-dark-600 rounded-lg text-sm transition">
                🤝 Offer Draw
              </button>
              <button onClick={handleResign} className="px-4 py-2 bg-red-900/50 hover:bg-red-900/80 rounded-lg text-sm transition">
                🏳️ Resign
              </button>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-2 text-center text-red-400 text-sm">{error}</div>
          )}
        </div>

        {/* Right: Info panel */}
        <div className="space-y-4">
          <GameInfo
            betAmount={betAmount}
            chain="BASE"
            token="ETH"
            pot={pot}
            fee={fee}
            winnerGets={winnerGets}
            moveCount={gameState.moveCount}
            status={gameState.status}
          />
          <MoveList moves={moves} />

          {/* Quick Chat */}
          {gameState.status === "active" && (
            <div className="bg-dark-800 rounded-lg border border-dark-700 p-3">
              <div className="text-sm font-medium text-dark-300 mb-2">Quick Chat</div>
              <div className="flex flex-wrap gap-1">
                {CHAT_PRESETS.map((msg) => (
                  <button
                    key={msg}
                    onClick={() => handleChat(msg)}
                    className="px-2 py-1 bg-dark-700 hover:bg-dark-600 rounded text-xs transition"
                  >
                    {msg}
                  </button>
                ))}
              </div>
              <div className="mt-2 max-h-32 overflow-y-auto text-xs space-y-1">
                {chatMessages.map((msg, i) => (
                  <div key={i} className="text-dark-400">
                    <span className="text-dark-300">{msg.from.slice(0, 6)}:</span> {msg.message}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Result Modal */}
      <GameResultModal
        isOpen={showResult}
        winner={gameState.winner}
        reason={gameState.resultReason}
        playerColor={playerColor}
        betAmount={betAmount}
        onClose={() => setShowResult(false)}
        onRematch={() => router.push("/lobby")}
      />
    </div>
  );
}
