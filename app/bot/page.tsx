'use client';

import Link from 'next/link';
import { useState } from 'react';

const bots = [
  { elo: 500, name: 'Anfänger', description: 'Ein ruhiger Einstieg zum Üben der Grundlagen.', icon: '♟' },
  { elo: 1000, name: 'Gelegenheitsspieler', description: 'Ein entspannter Gegner für die ersten Partien.', icon: '♞' },
  { elo: 1500, name: 'Taktiker', description: 'Fordert dich mit taktischen Ideen.', icon: '♜' },
  { elo: 2000, name: 'Stratege', description: 'Plant voraus und nutzt kleine Fehler.', icon: '♛' },
  { elo: 2500, name: 'Meister', description: 'Die stärkste Herausforderung.', icon: '♚' },
];

export default function BotPage() {
  const [selectedElo, setSelectedElo] = useState<number | null>(null);

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="text-sm text-slate-300 underline underline-offset-4 hover:text-white">
          ← Zur Startseite
        </Link>
        <header className="mt-8">
          <div className="text-5xl" aria-hidden="true">🤖</div>
          <h1 className="mt-4 text-4xl font-bold">Gegen einen Bot spielen</h1>
          <p className="mt-3 max-w-2xl text-slate-300">
            Wähle die Spielstärke deines Gegners. Die Bots laufen kostenlos direkt in deinem Browser.
          </p>
        </header>
        <section aria-label="Bot auswählen" className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {bots.map((bot) => {
            const isSelected = selectedElo === bot.elo;
            return (
              <button key={bot.elo} type="button" aria-pressed={isSelected} onClick={() => setSelectedElo(bot.elo)}
                className={isSelected
                  ? 'rounded-2xl border border-emerald-400 bg-emerald-950/60 p-5 text-left ring-2 ring-emerald-400/50 transition'
                  : 'rounded-2xl border border-slate-700 bg-slate-900 p-5 text-left transition hover:border-slate-500 hover:bg-slate-800'}>
                <div className="flex items-center justify-between">
                  <span className="text-4xl" aria-hidden="true">{bot.icon}</span>
                  <span className="rounded-full bg-slate-800 px-3 py-1 text-sm font-semibold text-emerald-300">{bot.elo} Elo</span>
                </div>
                <h2 className="mt-4 text-xl font-bold">{bot.name}</h2>
                <p className="mt-2 min-h-12 text-sm text-slate-400">{bot.description}</p>
                <span className="mt-4 inline-block text-sm font-semibold text-emerald-300">{isSelected ? 'Ausgewählt ✓' : 'Bot auswählen →'}</span>
              </button>
            );
          })}
        </section>
        <p className="mt-5 rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-400">
          Die Elo-Angaben sind ungefähre Schwierigkeitsstufen und keine garantierte Wertung. Besonders 500 und 1000 werden durch eine verkürzte Suche angenähert.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          {selectedElo !== null ? (
            <Link href={'/play?mode=bot&elo=' + selectedElo} className="rounded-xl bg-emerald-400 px-6 py-3 font-bold text-slate-950 transition hover:bg-emerald-300">
              Spiel gegen {selectedElo}-Elo-Bot starten
            </Link>
          ) : <p aria-live="polite" className="text-sm text-slate-300">Wähle zuerst eine Spielstärke aus.</p>}
          <Link href="/play" className="text-sm text-slate-400 underline underline-offset-4 hover:text-white">Ohne Bot spielen</Link>
        </div>
      </div>
    </main>
  );
}
