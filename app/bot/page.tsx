'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ChessPieceIcon } from '@/components/chess-piece-icon';


const clockOptions = [
  { id: 'free', minutes: 0, increment: 0, label: 'Ohne Zeit', category: 'frei' },
  { id: '1+0', minutes: 1, increment: 0, label: '1+0', category: 'Bullet' },
  { id: '3+2', minutes: 3, increment: 2, label: '3+2', category: 'Blitz' },
  { id: '5+0', minutes: 5, increment: 0, label: '5+0', category: 'Blitz' },
  { id: '10+0', minutes: 10, increment: 0, label: '10+0', category: 'Rapid' },
  { id: '15+10', minutes: 15, increment: 10, label: '15+10', category: 'Rapid' },
  { id: '30+0', minutes: 30, increment: 0, label: '30+0', category: 'Klassisch' },
];

const colorOptions = [
  { id: 'white', label: 'Weiß', color: 'w' as const, description: 'Du spielst mit den weißen Figuren.' },
  { id: 'black', label: 'Schwarz', color: 'b' as const, description: 'Du spielst mit den schwarzen Figuren.' },
  { id: 'random', label: 'Zufall', color: null, description: 'Die Farbe wird für dich ausgelost.' },
];

const bots = [
  { elo: 500, name: 'Anfänger', description: 'Ein ruhiger Einstieg zum Üben der Grundlagen.', icon: '♟' },
  { elo: 1000, name: 'Gelegenheitsspieler', description: 'Ein entspannter Gegner für die ersten Partien.', icon: '♞' },
  { elo: 1500, name: 'Taktiker', description: 'Fordert dich mit taktischen Ideen.', icon: '♜' },
  { elo: 2000, name: 'Stratege', description: 'Plant voraus und nutzt kleine Fehler.', icon: '♛' },
  { elo: 2500, name: 'Meister', description: 'Die stärkste Herausforderung.', icon: '♚' },
];

export default function BotPage() {
  const [selectedElo, setSelectedElo] = useState<number | null>(null);
  const [selectedClock, setSelectedClock] = useState('10+0');
  const [selectedColor, setSelectedColor] = useState('white');
  const clock = clockOptions.find((option) => option.id === selectedClock) ?? clockOptions[4];

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
        <section className="mt-8" aria-label="Farbe auswählen">
          <h2 className="mb-3 text-xl font-semibold">Deine Farbe</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {colorOptions.map((option) => (
              <button key={option.id} type="button" aria-pressed={selectedColor === option.id} onClick={() => setSelectedColor(option.id)}
                className={selectedColor === option.id
                  ? 'rounded-xl border border-emerald-400 bg-emerald-950/60 px-4 py-3 text-left ring-2 ring-emerald-400/40'
                  : 'rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-left hover:border-slate-500'}>
                <span className="mr-2 inline-flex h-8 w-8 items-center justify-center align-middle" aria-hidden="true">{option.color ? <ChessPieceIcon color={option.color} type="k" /> : <span className="text-xl">🎲</span>}</span>
                <span className="font-bold">{option.label}</span>
                <span className="mt-1 block text-sm text-slate-400">{option.description}</span>
              </button>
            ))}
          </div>
        </section>
        <section className="mt-8" aria-label="Bedenkzeit auswählen">
          <h2 className="mb-3 text-xl font-semibold">Bedenkzeit</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {clockOptions.map((option) => (
              <button key={option.id} type="button" aria-pressed={selectedClock === option.id} onClick={() => setSelectedClock(option.id)}
                className={selectedClock === option.id
                  ? 'rounded-xl border border-emerald-400 bg-emerald-950/60 px-4 py-3 text-left ring-2 ring-emerald-400/40'
                  : 'rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-left hover:border-slate-500'}>
                <span className="font-bold">{option.label}</span>
                <span className="ml-2 text-sm text-slate-400">{option.category}{option.increment > 0 ? ' · +' + option.increment + ' Sek. pro Zug' : ''}</span>
              </button>
            ))}
          </div>
        </section>
        <p className="mt-5 rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-400">
          Die Elo-Angaben sind ungefähre Schwierigkeitsstufen und keine garantierte Wertung. Besonders 500 und 1000 werden durch eine verkürzte Suche angenähert.
        </p>
        <p className="mt-5 text-sm text-slate-400">Für Offline-Partien die installierte App einmal mit Internet öffnen, damit Seiten und Bot-Engine gespeichert werden.</p>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          {selectedElo !== null ? (
            <a href={'/play?mode=bot&elo=' + selectedElo + '&time=' + clock.minutes + '&increment=' + clock.increment + '&color=' + selectedColor} className="rounded-xl bg-emerald-400 px-6 py-3 font-bold text-slate-950 transition hover:bg-emerald-300">
              Spiel gegen {selectedElo}-Elo-Bot starten
            </a>
          ) : <p aria-live="polite" className="text-sm text-slate-300">Wähle zuerst eine Spielstärke aus.</p>}
          <Link href="/play" className="text-sm text-slate-400 underline underline-offset-4 hover:text-white">Ohne Bot spielen</Link>
        </div>
      </div>
    </main>
  );
}
