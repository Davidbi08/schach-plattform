"use client";

import { useEffect, useState } from "react";
import { Chess } from "chess.js";

const pieceSymbols: Record<string, string> = {
  wK: "♔",
  wQ: "♕",
  wR: "♖",
  wB: "♗",
  wN: "♘",
  wP: "♙",
  bK: "♚",
  bQ: "♛",
  bR: "♜",
  bB: "♝",
  bN: "♞",
  bP: "♟",
};

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

export default function Home() {
  const [game, setGame] = useState(() => new Chess());
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [possibleMoves, setPossibleMoves] = useState<string[]>([]);

  const [whiteTime, setWhiteTime] = useState(600);
  const [blackTime, setBlackTime] = useState(600);

  const [moves, setMoves] = useState<string[]>([]);

  const board = game.board();

  useEffect(() => {
    const timer = setInterval(() => {
      if (game.isGameOver()) {
        return;
      }

      if (game.turn() === "w") {
        setWhiteTime((time) => Math.max(0, time - 1));
      } else {
        setBlackTime((time) => Math.max(0, time - 1));
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [game]);

  function handleSquareClick(square: string) {
    if (game.isGameOver()) {
      return;
    }

    if (whiteTime === 0 || blackTime === 0) {
      return;
    }

    const piece = game.get(square as any);

    if (selectedSquare) {
      try {
        const move = game.move({
          from: selectedSquare,
          to: square,
          promotion: "q",
        });

        setMoves((oldMoves) => [...oldMoves, move.san]);

        setGame(new Chess(game.fen()));
        setSelectedSquare(null);
        setPossibleMoves([]);

        return;
      } catch {
        // Ungültiger Zug
      }
    }

    if (piece && piece.color === game.turn()) {
      const availableMoves = game.moves({
        square: square as any,
        verbose: true,
      });

      setSelectedSquare(square);
      setPossibleMoves(availableMoves.map((move) => move.to));
    } else {
      setSelectedSquare(null);
      setPossibleMoves([]);
    }
  }

  function newGame() {
    setGame(new Chess());
    setSelectedSquare(null);
    setPossibleMoves([]);
    setWhiteTime(600);
    setBlackTime(600);
    setMoves([]);
  }

  const currentPlayer = game.turn() === "w" ? "Weiß" : "Schwarz";

  let status = `Am Zug: ${currentPlayer}`;

  if (whiteTime === 0) {
    status = "⏱️ Zeit abgelaufen – Schwarz gewinnt.";
  } else if (blackTime === 0) {
    status = "⏱️ Zeit abgelaufen – Weiß gewinnt.";
  } else if (game.isCheckmate()) {
    const winner = game.turn() === "w" ? "Schwarz" : "Weiß";
    status = `♚ Schachmatt! ${winner} gewinnt.`;
  } else if (game.isStalemate()) {
    status = "🤝 Patt – Unentschieden.";
  } else if (game.isDraw()) {
    status = "🤝 Remis – Unentschieden.";
  } else if (game.inCheck()) {
    status = `⚠️ Schach! ${currentPlayer} muss reagieren.`;
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col items-center px-4 py-10">
        <div className="mb-6 text-center">
          <div className="mb-2 text-5xl">♟️</div>

          <h1 className="text-4xl font-bold">
            Deine Schachplattform
          </h1>

          <p className="mt-2 text-slate-300">
            Schach. Community. Creator. Deine persönliche Schachreise.
          </p>
        </div>

        <div className="mb-4 rounded-xl border border-slate-700 bg-slate-900 px-6 py-3 text-center font-semibold">
          {status}
        </div>

        <div className="mb-4 flex w-full max-w-2xl justify-between gap-4">
          <div className="rounded-xl border border-slate-700 bg-slate-900 px-5 py-3">
            <div className="text-sm text-slate-400">Weiß</div>
            <div className="text-2xl font-bold">
              {formatTime(whiteTime)}
            </div>
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-900 px-5 py-3 text-right">
            <div className="text-sm text-slate-400">Schwarz</div>
            <div className="text-2xl font-bold">
              {formatTime(blackTime)}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="overflow-hidden rounded-xl border-4 border-slate-700 shadow-2xl">
            <div className="grid grid-cols-8">
              {board.map((row, rowIndex) =>
                row.map((piece, colIndex) => {
                  const square =
                    String.fromCharCode(97 + colIndex) +
                    (8 - rowIndex);

                  const isLight =
                    (rowIndex + colIndex) % 2 === 0;

                  const isSelected =
                    selectedSquare === square;

                  const isPossibleMove =
                    possibleMoves.includes(square);

                  return (
                    <button
                      key={square}
                      onClick={() => handleSquareClick(square)}
                      className={`relative flex aspect-square w-11 items-center justify-center text-3xl sm:w-16 sm:text-5xl md:w-20 md:text-6xl ${
                        isLight
                          ? "bg-amber-100"
                          : "bg-amber-700"
                      } ${
                        isSelected
                          ? "ring-4 ring-blue-500 ring-inset"
                          : ""
                      }`}
                    >
                      {piece && (
                        <span
                          className={
                            piece.color === "w"
                              ? "text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]"
                              : "text-slate-900 drop-shadow-[0_2px_2px_rgba(255,255,255,0.5)]"
                          }
                        >
                          {
                            pieceSymbols[
                              piece.color +
                                piece.type.toUpperCase()
                            ]
                          }
                        </span>
                      )}

                      {isPossibleMove && (
                        <span className="absolute h-3 w-3 rounded-full bg-slate-800/60" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="w-full rounded-xl border border-slate-700 bg-slate-900 p-4 lg:w-64">
            <h2 className="mb-3 text-lg font-bold">
              Zugliste
            </h2>

            {moves.length === 0 ? (
              <p className="text-sm text-slate-500">
                Noch keine Züge.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2 text-sm">
                {moves.map((move, index) => (
                  <div
                    key={index}
                    className="rounded bg-slate-800 px-2 py-1"
                  >
                    {index % 2 === 0
                      ? `${Math.floor(index / 2) + 1}. ${move}`
                      : move}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <button
          onClick={newGame}
          className="mt-6 rounded-xl bg-white px-6 py-3 font-semibold text-slate-950"
        >
          🔄 Neues Spiel
        </button>

        <p className="mt-5 max-w-md text-center text-sm text-slate-400">
          10 Minuten pro Spieler · Klicke eine Figur und anschließend
          auf das gewünschte Zielfeld.
        </p>
      </div>
    </main>
  );
}