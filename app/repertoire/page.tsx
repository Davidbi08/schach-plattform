"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Chess } from "chess.js";
import { MiniChessboard } from "@/components/mini-chessboard";

const openings = [
  {
    name: "Londoner System",
    side: "Weiß",
    idea: "Entwickle den Läufer früh nach f4 und baue eine stabile Stellung mit e3 und c3 auf.",
    moves: "d4 d5 Bf4 Nf6 e3 e6 Nf3 c5 c3 Nc6 Nbd2 Bd6 Bd3 O-O O-O",
  },
  {
    name: "Italienische Partie",
    side: "Weiß",
    idea: "Entwickle schnell, kontrolliere das Zentrum und bereite mit c3 und d3 einen soliden Aufbau vor.",
    moves: "e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O",
  },
  {
    name: "Damengambit",
    side: "Weiß",
    idea: "Mit c4 setzt du d5 unter Druck. Nach ...e6 kannst du Figuren entwickeln und Raum im Zentrum sichern.",
    moves: "d4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 h6 Bh4",
  },
];

export default function RepertoirePage() {
  const [openingIndex, setOpeningIndex] = useState(0);
  const [ply, setPly] = useState(0);
  const opening = openings[openingIndex];
  const moves = opening.moves.split(" ");
  const position = useMemo(() => {
    const chess = new Chess();
    moves.slice(0, ply).forEach((san) => chess.move(san));
    return chess;
  }, [moves, ply]);

  function selectOpening(index: number) {
    setOpeningIndex(index);
    setPly(0);
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-8 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <Link href="/" className="text-sm text-slate-400 underline underline-offset-4 hover:text-white">← Zur Startseite</Link>
        <header className="mt-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">Eröffnungen lernen</p>
          <h1 className="mt-3 text-4xl font-bold sm:text-5xl">Dein Repertoire</h1>
          <p className="mt-3 max-w-2xl leading-7 text-slate-300">Lerne drei solide Einstiege Zug für Zug. Nutze die Navigation, um die Stellung nach jedem Zugpaar nachzuspielen.</p>
        </header>

        <nav className="mt-7 flex flex-wrap gap-2" aria-label="Eröffnung auswählen">
          {openings.map((item, index) => (
            <button key={item.name} type="button" onClick={() => selectOpening(index)} aria-pressed={openingIndex === index} className={`rounded-xl border px-4 py-3 text-sm font-semibold ${openingIndex === index ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-200" : "border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-600"}`}>
              {item.name}
            </button>
          ))}
        </nav>

        <section className="mt-5 grid gap-5 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(16rem,0.8fr)] sm:p-6" aria-labelledby="opening-heading">
          <div>
            <h2 id="opening-heading" className="text-2xl font-bold">{opening.name}</h2>
            <p className="mt-1 text-sm text-emerald-300">Repertoire für {opening.side}</p>
            <p className="mt-3 text-sm leading-6 text-slate-400">{opening.idea}</p>
            <MiniChessboard fen={position.fen()} label={`${opening.name}, Stellung nach ${ply} Halbzügen`} />
            <div className="mt-3 flex items-center justify-between gap-2">
              <button type="button" onClick={() => setPly((value) => Math.max(0, value - 1))} disabled={ply === 0} className="rounded-lg border border-slate-700 px-3 py-2 text-sm disabled:opacity-40">← Zurück</button>
              <span className="text-xs tabular-nums text-slate-400">{ply}/{moves.length} Halbzüge</span>
              <button type="button" onClick={() => setPly((value) => Math.min(moves.length, value + 1))} disabled={ply === moves.length} className="rounded-lg border border-slate-700 px-3 py-2 text-sm disabled:opacity-40">Weiter →</button>
              <button type="button" onClick={() => setPly(0)} className="text-xs text-slate-400 underline">Neu starten</button>
            </div>
          </div>
          <div>
            <h3 className="font-semibold">Zugfolge</h3>
            <div className="mt-3 grid grid-cols-2 gap-1">
              {moves.map((san, index) => (
                <button key={`${index}-${san}`} type="button" onClick={() => setPly(index + 1)} aria-current={ply === index + 1 ? "step" : undefined} className={`rounded px-2 py-2 text-left text-sm ${ply === index + 1 ? "bg-emerald-400/20 text-emerald-200" : "bg-slate-950 text-slate-300 hover:bg-slate-800"}`}>
                  <span className="mr-2 text-slate-500">{index % 2 === 0 ? `${Math.floor(index / 2) + 1}.` : ""}</span>{san}
                </button>
              ))}
            </div>
            <p className="mt-5 rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-xs leading-5 text-slate-400">Dies ist ein Lernleitfaden, kein Engine-Repertoire: Die gezeigten Varianten sind beispielhafte Hauptideen und decken nicht alle Antworten des Gegners ab.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
