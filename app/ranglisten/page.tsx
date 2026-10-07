import Link from "next/link";
import { Leaderboards } from "@/components/leaderboards";

export default function LeaderboardsPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-8 sm:py-12">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="text-sm text-slate-400 underline underline-offset-4 hover:text-white">← Übersicht</Link>
        <header className="mb-7 mt-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-400">Community</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Ranglisten</h1>
          <p className="mt-2 text-sm text-slate-400">Vergleiche deine Online-Elo global oder mit deinen Freunden.</p>
        </header>
        <Leaderboards />
      </div>
    </main>
  );
}
