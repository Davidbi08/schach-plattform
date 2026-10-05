"use client";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
const START_FEN = new Chess().fen();
const PIECES: Record<string, string> = { wK: "♔", wQ: "♕", wR: "♖", wB: "♗", wN: "♘", wP: "♙", bK: "♚", bQ: "♛", bR: "♜", bB: "♝", bN: "♞", bP: "♟" };
type EvalInfo = { score: string; depth: string; line: string };
export default function AnalysePage() {
  const [pgn, setPgn] = useState("");
  const [moves, setMoves] = useState<string[]>([]);
  const [positions, setPositions] = useState<string[]>([START_FEN]);
  const [moveIndex, setMoveIndex] = useState(0);
  const [message, setMessage] = useState("");
  const [engineReady, setEngineReady] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [evaluation, setEvaluation] = useState<EvalInfo | null>(null);
  const [engineError, setEngineError] = useState("");
  const [sheetName, setSheetName] = useState("");
  const workerRef = useRef<Worker | null>(null);
  const game = useMemo(() => new Chess(positions[moveIndex] ?? START_FEN), [positions, moveIndex]);
  const board = game.board();
  useEffect(() => {
    let worker: Worker | undefined;
    try {
      worker = new Worker("/stockfish/stockfish-19-lite-single.js");
      workerRef.current = worker;
      worker.onmessage = (event: MessageEvent<string>) => {
        const text = String(event.data);
        if (text.includes("uciok")) { worker?.postMessage("setoption name Threads value 1"); worker?.postMessage("setoption name Hash value 16"); worker?.postMessage("isready"); }
        if (text.includes("readyok")) setEngineReady(true);
        if (text.startsWith("info ")) {
          const depth = text.match(/depth (\d+)/)?.[1];
          const score = text.match(/score (cp|mate) (-?\d+)/);
          const line = text.match(/\spv (.+)$/)?.[1];
          if (depth && score) setEvaluation({ depth, score: score[1] === "mate" ? "Matt in " + Math.abs(Number(score[2])) : (Number(score[2]) / 100).toFixed(2), line: line ?? "" });
        }
        if (text.startsWith("bestmove")) setAnalyzing(false);
      };
      worker.onerror = () => { setEngineError("Stockfish konnte nicht geladen werden. Bitte lade die Seite neu."); setAnalyzing(false); };
      worker.postMessage("uci");
    } catch { setEngineError("Dieser Browser konnte Stockfish nicht starten."); }
    return () => { workerRef.current = null; worker?.terminate(); };
  }, []);
  function loadPgn(source: string) {
    try {
      const parsed = new Chess();
      parsed.loadPgn(source);
      const headers = parsed.header();
      const replay = new Chess(headers.FEN || START_FEN);
      const sanMoves = parsed.history();
      const nextPositions = [replay.fen()];
      sanMoves.forEach((san) => { replay.move(san); nextPositions.push(replay.fen()); });
      setPgn(source); setMoves(sanMoves); setPositions(nextPositions); setMoveIndex(sanMoves.length); setEvaluation(null); setMessage(sanMoves.length ? sanMoves.length + " Züge geladen." : "Partie geladen. Noch keine Züge gefunden."); setEngineError("");
    } catch { setMessage("Die PGN konnte nicht gelesen werden. Bitte prüfe die Zugnotation."); }
  }
  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    void file.text().then(loadPgn).catch(() => setMessage("Die Datei konnte nicht gelesen werden."));
  }
  function analyzePosition() {
    const worker = workerRef.current;
    if (!worker || !engineReady) { setEngineError("Stockfish wird noch geladen. Bitte warte kurz."); return; }
    setEngineError(""); setEvaluation(null); setAnalyzing(true);
    worker.postMessage("stop"); worker.postMessage("position fen " + game.fen()); worker.postMessage("go depth 15");
  }
  const scoreLabel = evaluation ? evaluation.score.startsWith("Matt") ? evaluation.score : (Number(evaluation.score) > 0 ? "+" : "") + evaluation.score : "Noch nicht analysiert";
  return <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6"><div className="mx-auto max-w-7xl">
    <header className="mb-7"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">Partie verstehen · besser spielen</p><h1 className="mt-2 text-3xl font-bold sm:text-4xl">Analyse</h1><p className="mt-2 text-slate-400">Lade eine Partie und untersuche sie Schritt für Schritt mit Stockfish.</p></header>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Partiebrett</h2><p className="text-sm text-slate-400">{moves.length ? moveIndex === 0 ? "Ausgangsstellung" : "Nach " + Math.ceil(moveIndex / 2) + ". Zug" : "Neue Partie"}</p></div><span className="rounded-full bg-slate-800 px-3 py-1 text-sm text-emerald-300">Engine: {engineReady ? "bereit" : "lädt …"}</span></div>
        <div className="mx-auto grid w-full max-w-[600px] grid-cols-8 overflow-hidden rounded-lg border border-slate-700">{board.flatMap((row, rowIndex) => row.map((piece, colIndex) => { const light = (rowIndex + colIndex) % 2 === 0; const square = String.fromCharCode(97 + colIndex) + (8 - rowIndex); return <div key={square} aria-label={square} className={"flex aspect-square items-center justify-center text-[clamp(1.7rem,7vw,3.5rem)] " + (light ? "bg-slate-200 text-slate-950" : "bg-slate-600 text-white")}>{piece ? <span className={piece.color === "w" ? "drop-shadow-[0_1px_1px_rgba(0,0,0,0.7)]" : "drop-shadow-[0_1px_1px_rgba(255,255,255,0.2)]"}>{PIECES[piece.color + piece.type.toUpperCase()]}</span> : null}</div>; }))}</div>
        <div className="mx-auto mt-4 flex max-w-[600px] items-center justify-between gap-2"><button type="button" onClick={() => setMoveIndex(Math.max(0, moveIndex - 1))} disabled={moveIndex === 0} className="rounded-lg border border-slate-700 px-4 py-2 disabled:opacity-40">← Zurück</button><span className="text-sm text-slate-400">{moveIndex} / {moves.length}</span><button type="button" onClick={() => setMoveIndex(Math.min(moves.length, moveIndex + 1))} disabled={moveIndex >= moves.length} className="rounded-lg border border-slate-700 px-4 py-2 disabled:opacity-40">Weiter →</button></div>
        <div className="mt-5"><h3 className="mb-2 text-sm font-semibold text-slate-300">Züge</h3><div className="flex max-h-36 flex-wrap gap-2 overflow-auto">{moves.length ? moves.map((san, index) => <button type="button" key={index} onClick={() => setMoveIndex(index + 1)} className={"rounded px-2 py-1 text-sm " + (moveIndex === index + 1 ? "bg-emerald-500/20 text-emerald-200" : "bg-slate-800 text-slate-300")}>{index % 2 === 0 ? Math.floor(index / 2) + 1 + ". " : ""}{san}</button>) : <p className="text-sm text-slate-500">Noch keine Züge geladen.</p>}</div></div>
      </section>
      <aside className="space-y-5">
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><h2 className="text-lg font-bold">Partie laden</h2><p className="mt-1 text-sm text-slate-400">Füge PGN-Züge ein oder wähle eine .pgn- bzw. .txt-Datei aus.</p><textarea value={pgn} onChange={(event) => setPgn(event.target.value)} placeholder="Zum Beispiel: 1. e4 e5 2. Nf3 Nc6 3. Bb5 a6" rows={6} className="mt-4 w-full resize-y rounded-xl border border-slate-700 bg-slate-950 p-3 font-mono text-sm text-white outline-none focus:border-emerald-400"/><div className="mt-3 flex flex-wrap gap-3"><button type="button" onClick={() => loadPgn(pgn)} className="rounded-xl bg-emerald-400 px-4 py-2.5 font-semibold text-slate-950 hover:bg-emerald-300">Partie laden</button><label className="cursor-pointer rounded-xl border border-slate-700 px-4 py-2.5 text-sm hover:bg-slate-800">PGN-Datei wählen<input type="file" accept=".pgn,.txt,text/plain" onChange={handleFile} className="sr-only"/></label></div>{message && <p role="status" className="mt-3 text-sm text-slate-300">{message}</p>}</section>
        <section className="rounded-2xl border border-violet-500/30 bg-slate-900 p-5"><div className="flex items-center justify-between"><h2 className="text-lg font-bold">Stockfish-Analyse</h2><span className="rounded-full bg-violet-500/15 px-3 py-1 text-xs text-violet-200">Lokal & kostenlos</span></div><p className="mt-2 text-sm text-slate-400">Die Stellung wird in deinem Browser untersucht.</p><button type="button" onClick={analyzePosition} disabled={analyzing || !engineReady} className="mt-4 w-full rounded-xl bg-violet-500 px-4 py-3 font-semibold text-white transition hover:bg-violet-400 disabled:cursor-wait disabled:opacity-50">{analyzing ? "Analysiere Stellung …" : "Stellung analysieren"}</button>{engineError && <p role="alert" className="mt-3 text-sm text-red-300">{engineError}</p>}<div className="mt-4 rounded-xl border border-slate-800 bg-slate-950 p-4"><p className="text-sm text-slate-400">Engine-Bewertung</p><p className="mt-1 text-2xl font-bold text-emerald-300">{scoreLabel}</p>{evaluation && <><p className="mt-2 text-xs text-slate-500">Tiefe {evaluation.depth} · beste Zugfolge</p><p className="mt-1 break-words font-mono text-sm text-slate-200">{evaluation.line || "—"}</p></>}</div></section>
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><h2 className="text-lg font-bold">Partieformular abfotografieren</h2><p className="mt-2 text-sm text-slate-400">Du kannst ein Foto auswählen und lokal ansehen. Handschriftliche Züge werden noch nicht automatisch erkannt; für die Analyse bitte vorerst als PGN eingeben.</p><label className="mt-4 inline-flex cursor-pointer rounded-xl border border-slate-700 px-4 py-2.5 text-sm hover:bg-slate-800">Foto auswählen<input type="file" accept="image/*" onChange={(event) => setSheetName(event.target.files?.[0]?.name ?? "")} className="sr-only"/></label>{sheetName && <p className="mt-2 text-sm text-slate-300">Ausgewählt: {sheetName}</p>}</section>
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5"><h2 className="text-lg font-bold">Fragen an den KI-Coach</h2><p className="mt-2 text-sm leading-6 text-slate-400">Der Gesprächs-Chat folgt als nächster Schritt. Diese erste Version analysiert Stellungen direkt mit Stockfish; sie sendet deine Partie an keinen KI-Dienst.</p></section>
      </aside>
    </div>
  </div></main>;
}
