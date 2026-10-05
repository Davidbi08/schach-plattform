"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { readOnlineHistory, type OnlineGameRecord } from "@/app/online/history-store";

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Datum unbekannt" : new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function GameHistoryPage() {
  const [games, setGames] = useState<OnlineGameRecord[]>([]);

  useEffect(() => {
    const refresh = () => setGames(readOnlineHistory());
    refresh();
    window.addEventListener("online-history-updated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("online-history-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-8 sm:py-12">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="text-sm text-slate-400 underline underline-offset-4 hover:text-white">← Zur Startseite</Link>
        <header className="mt-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">Deine Schachreise</p>
          <h1 className="mt-3 text-4xl font-bold sm:text-5xl">Partieverlauf</h1>
          <p className="mt-3 max-w-2xl leading-7 text-slate-300">Hier findest du deine beendeten Online-Partien mit Ergebnis, Bedenkzeit und Zugfolge.</p>
        </header>

        <p className="mt-6 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm leading-6 text-slate-400">
          Der Verlauf wird momentan auf diesem Gerät gespeichert. Wenn du Browserdaten löschst oder ein anderes Gerät verwendest, ist er dort nicht verfügbar.
        </p>

        {games.length === 0 ? (
          <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/50 p-8 text-center sm:p-12">
            <div className="text-5xl" aria-hidden="true">♟</div>
            <h2 className="mt-4 text-xl font-bold">Noch keine Online-Partien</h2>
            <p className="mt-2 text-slate-400">Deine abgeschlossenen Partien erscheinen nach dem ersten Spiel hier.</p>
            <Link href="/online" className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-emerald-400 px-5 font-semibold text-slate-950 transition hover:bg-emerald-300">Online-Partie starten</Link>
          </section>
        ) : (
          <section className="mt-6 space-y-3" aria-label="Beendete Partien">
            {games.map((game, index) => {
              const badge = game.result === "win" ? "bg-emerald-950 text-emerald-300" : game.result === "loss" ? "bg-rose-950 text-rose-300" : "bg-slate-800 text-slate-200";
              const whiteMoves = game.moves.filter((move) => move.color === "w");
              const blackMoves = game.moves.filter((move) => move.color === "b");
              return (
                <details key={game.id} className="group rounded-2xl border border-slate-800 bg-slate-900/60">
                  <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 p-4 sm:p-5">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 font-semibold text-slate-300">{games.length - index}</span>
                    <span className="min-w-36 flex-1">
                      <span className="block font-semibold">Gegen {game.color === "w" ? game.blackName ?? "Gast" : game.whiteName ?? "Gast"} · {game.timeControl}</span>
                      <span className="mt-1 block text-sm text-slate-400">{dateLabel(game.playedAt)} · Du spieltest {game.color === "w" ? "Weiß" : "Schwarz"}</span>
                    </span>
                    <span className={`rounded-full px-3 py-1.5 text-sm font-semibold ${badge}`}>{game.resultText}</span>
                    <span className="ml-1 text-slate-500 transition group-open:rotate-180" aria-hidden="true">⌄</span>
                  </summary>
                  <div className="border-t border-slate-800 px-4 py-4 sm:px-5">
                    <p className="text-sm text-slate-400">{game.reason} · Weiß: {game.whiteName ?? "Gast"} · Schwarz: {game.blackName ?? "Gast"}</p>
                    {game.moves.length === 0 ? (
                      <p className="mt-3 text-sm text-slate-500">In dieser Partie wurden keine Züge gespeichert.</p>
                    ) : (
                      <div className="mt-4 overflow-hidden rounded-xl border border-slate-800">
                        <div className="grid grid-cols-[3rem_1fr_1fr] bg-slate-950 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500"><span>Zug</span><span>Weiß</span><span>Schwarz</span></div>
                        {whiteMoves.map((move, moveIndex) => (
                          <div key={moveIndex} className="grid grid-cols-[3rem_1fr_1fr] border-t border-slate-800 px-3 py-2.5 text-sm even:bg-slate-950/40">
                            <span className="text-slate-500">{moveIndex + 1}.</span>
                            <span>{move.san}</span>
                            <span>{blackMoves[moveIndex]?.san ?? ""}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </details>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}
