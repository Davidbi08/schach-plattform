"use client";

import { useState, useSyncExternalStore } from "react";
import { Chess, type Color, type Square } from "chess.js";
import { MiniChessboard } from "@/components/mini-chessboard";
import { chooseTacticsPuzzle, getTacticsDifficulty, getTacticsPuzzleForRating, getTacticsRatingChange, getTacticsTheme, tacticsPuzzles } from "@/lib/tactics";
import { getTacticsProgress, INITIAL_TACTICS_PROGRESS, subscribeToTacticsProgress, updateTacticsProgress } from "@/lib/tactics-progress";

type Outcome = "solved" | "missed" | null;

function playUci(position: Chess, uci: string) {
  const match = uci.match(/^([a-h][1-8])([a-h][1-8])([qrbn])?$/);
  if (!match) throw new Error(`Ungültiger Aufgabenzug: ${uci}`);

  return position.move({
    from: match[1] as Square,
    to: match[2] as Square,
    ...(match[3] ? { promotion: match[3] } : {}),
  });
}

function moveToUci(move: { from: Square; to: Square; promotion?: string }): string {
  return move.from + move.to + (move.promotion ?? "");
}

export default function TacticsPage() {
  const progress = useSyncExternalStore(subscribeToTacticsProgress, getTacticsProgress, () => INITIAL_TACTICS_PROGRESS);
  const [puzzleId, setPuzzleId] = useState<string | null>(null);
  const [positionState, setPositionState] = useState<{ puzzleId: string; fen: string } | null>(null);
  const [solutionIndex, setSolutionIndex] = useState(0);
  const [selected, setSelected] = useState<Square | null>(null);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [message, setMessage] = useState("");

  const puzzle = puzzleId
    ? tacticsPuzzles.find((candidate) => candidate.id === puzzleId) ?? getTacticsPuzzleForRating(progress.rating, progress.recent)
    : getTacticsPuzzleForRating(progress.rating, progress.recent);
  const positionFen = positionState?.puzzleId === puzzle.id ? positionState.fen : puzzle.fen;
  const chess = new Chess(positionFen);
  const playerColor = puzzle.fen.split(" ")[1] as Color;
  const targets = !selected || outcome || chess.turn() !== playerColor
    ? []
    : chess.moves({ square: selected, verbose: true }).map((move) => move.to);

  function finish(correct: boolean, answer: string) {
    if (outcome) return;

    const ratingChange = getTacticsRatingChange(progress.rating, puzzle.rating, correct);
    setPuzzleId(puzzle.id);
    updateTacticsProgress((current) => ({
      ...current,
      rating: Math.max(400, Math.min(2400, current.rating + ratingChange)),
      solved: current.solved + (correct ? 1 : 0),
      attempted: current.attempted + 1,
      recent: [...current.recent, puzzle.id].slice(-12),
    }));
    setOutcome(correct ? "solved" : "missed");
    setSelected(null);
    setMessage(correct
      ? `Richtig! ${answer} Deine Taktik-Elo ${ratingChange >= 0 ? "+" : ""}${ratingChange}.`
      : `Noch nicht. Gesucht war ${answer} Deine Taktik-Elo ${ratingChange >= 0 ? "+" : ""}${ratingChange}.`);
  }

  function selectSquare(squareName: string) {
    if (outcome || chess.turn() !== playerColor) return;

    const square = squareName as Square;
    const piece = chess.get(square);
    if (!selected) {
      if (piece?.color === playerColor) setSelected(square);
      return;
    }
    if (square === selected) {
      setSelected(null);
      return;
    }
    if (piece?.color === playerColor) {
      setSelected(square);
      return;
    }
    if (!targets.includes(square)) {
      setSelected(null);
      return;
    }

    const position = new Chess(positionFen);
    const played = position.move({ from: selected, to: square, promotion: "q" });
    const expectedPosition = new Chess(positionFen);
    const expected = playUci(expectedPosition, puzzle.moves[solutionIndex]);
    if (moveToUci(played) !== puzzle.moves[solutionIndex]) {
      finish(false, `${expected.san}.`);
      return;
    }

    const opponentMove = puzzle.moves[solutionIndex + 1];
    if (opponentMove) {
      const reply = playUci(position, opponentMove);
      setMessage(`${played.san} – der Gegner antwortet mit ${reply.san}.`);
    }

    const nextIndex = solutionIndex + (opponentMove ? 2 : 1);
    setPositionState({ puzzleId: puzzle.id, fen: position.fen() });
    setSolutionIndex(nextIndex);
    setSelected(null);

    if (nextIndex >= puzzle.moves.length) {
      finish(true, `${played.san}.`);
    }
  }

  function nextPuzzle() {
    const next = chooseTacticsPuzzle(progress.rating, progress.recent);
    setPuzzleId(next.id);
    setPositionState(null);
    setSolutionIndex(0);
    setSelected(null);
    setOutcome(null);
    setMessage("");
  }

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-slate-100 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-400">Training</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Taktikaufgaben</h1>
            <p className="mt-2 text-sm text-slate-400">Echte Partiestellungen, passend zu deiner Taktik-Elo.</p>
          </div>
          <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-5 py-3">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Deine Taktik-Elo</p>
            <p className="mt-1 text-3xl font-bold tabular-nums text-emerald-300">{progress.rating}</p>
          </div>
        </header>

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
          <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-3 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 px-1">
              <div>
                <p className="text-sm font-semibold text-white">Finde die beste Fortsetzung.</p>
                <p className="mt-1 text-xs text-slate-400">
                  Du spielst {playerColor === "w" ? "Weiß" : "Schwarz"} · {puzzle.rating} Aufgaben-Elo · {getTacticsDifficulty(puzzle.rating)}
                </p>
              </div>
              <a
                href={`https://lichess.org/${puzzle.sourceGame}`}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 hover:border-slate-500 hover:text-white"
              >
                {getTacticsTheme(puzzle.themes)} · Partie ansehen ↗
              </a>
            </div>
            <MiniChessboard
              fen={positionFen}
              label={`Taktikaufgabe, ${playerColor === "w" ? "Weiß" : "Schwarz"} am Zug`}
              onSquareClick={selectSquare}
              selected={selected}
              targets={targets}
              orientation={playerColor === "w" ? "white" : "black"}
            />
            <div
              aria-live="polite"
              className={"mt-4 min-h-12 rounded-lg px-4 py-3 text-sm " + (outcome === "solved" ? "bg-emerald-400/10 text-emerald-200" : outcome === "missed" ? "bg-amber-400/10 text-amber-100" : "bg-slate-800/70 text-slate-400")}
            >
              {message || "Wähle eine Figur und danach das Zielfeld."}
            </div>
            {outcome && (
              <button
                type="button"
                onClick={nextPuzzle}
                className="mt-3 w-full rounded-lg bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
              >
                Nächste Aufgabe →
              </button>
            )}
          </section>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
              <h2 className="font-semibold">Dein Fortschritt</h2>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-slate-800/70 p-4">
                  <p className="text-xs text-slate-400">Gelöst</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">{progress.solved}</p>
                </div>
                <div className="rounded-xl bg-slate-800/70 p-4">
                  <p className="text-xs text-slate-400">Versucht</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">{progress.attempted}</p>
                </div>
              </div>
              <p className="mt-4 text-xs leading-5 text-slate-400">
                Die Aufgabenwahl richtet sich nach deiner Taktik-Elo. Sie passt sich daran an, welche Aufgaben du löst.
                Deine Online-Elo bleibt davon getrennt; der Fortschritt wird in diesem Browser gespeichert.
              </p>
            </section>

            <section className="rounded-2xl border border-slate-800 p-5">
              <h2 className="font-semibold">Echte Stellungen, legale Züge</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Jede Aufgabe stammt aus einer echten Lichess-Partie. Du kannst nur mit der am Zug befindlichen Farbe ziehen;
                die besten Antworten der Gegenseite werden automatisch ausgespielt.
              </p>
              <a
                href="https://database.lichess.org/#puzzles"
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block text-xs text-slate-500 underline underline-offset-4 hover:text-slate-300"
              >
                Puzzledatenbank: Creative Commons CC0 ↗
              </a>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
