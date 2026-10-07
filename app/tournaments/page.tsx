import Link from "next/link";
import { Tournaments } from "@/components/tournaments";

export default function TournamentsPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-8 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <Link href="/" className="text-sm text-slate-400 underline underline-offset-4 hover:text-white">← Übersicht</Link>
        <header className="mb-7 mt-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-400">Spielen · Community</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Turniere</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Erstelle ein Rundenturnier, melde dich an und spiele jede Paarung. Ergebnisse zählen erst, wenn beide Spieler dasselbe Resultat bestätigen.</p>
        </header>
        <Tournaments />
      </div>
    </main>
  );
}
