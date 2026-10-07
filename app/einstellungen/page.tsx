"use client";

import Link from "next/link";
import { useState } from "react";
import { ProfileEditor } from "@/components/profile-editor";
import { createClient } from "@/lib/supabase/client";

export default function SettingsPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleLogout() {
    setBusy(true);
    setError("");
    const { error: signOutError } = await createClient().auth.signOut();
    if (signOutError) {
      setError("Abmelden hat gerade nicht geklappt. Bitte versuche es erneut.");
      setBusy(false);
      return;
    }
    window.location.assign("/login");
  }

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-10 text-slate-100 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-400">Konto</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Einstellungen</h1>
        <p className="mt-2 text-sm text-slate-400">Verwalte dein Konto und dein öffentliches Spielerprofil.</p>

        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6">
          <h2 className="text-lg font-semibold">Dein Spielerprofil</h2>
          <p className="mb-5 mt-1 text-sm text-slate-400">Ändere deinen öffentlichen Benutzernamen, dein Profilbild und deine Biografie.</p>
          <ProfileEditor />
          <Link href="/profile" className="mt-5 inline-flex text-sm font-medium text-emerald-300 underline underline-offset-4">Mein öffentliches Profil ansehen</Link>
        </section>

        <section className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6">
          <h2 className="font-semibold">Community</h2>
          <p className="mt-1 text-sm text-slate-400">Verwalte Freundschaften und schreibe mit anderen Schachspielern.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/freunde" className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-medium hover:border-slate-500">Freunde</Link>
            <Link href="/chat" className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-medium hover:border-slate-500">Globaler Chat</Link>
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6">
          <h2 className="font-semibold">Sitzung</h2>
          <p className="mt-1 text-sm text-slate-400">Melde dich auf diesem Gerät von deinem Konto ab.</p>
          {error && <p role="alert" className="mt-4 text-sm text-rose-300">{error}</p>}
          <button type="button" onClick={() => void handleLogout()} disabled={busy} className="mt-4 rounded-lg border border-rose-400/30 px-4 py-2.5 text-sm font-medium text-rose-200 transition hover:bg-rose-400/10 disabled:opacity-50">{busy ? "Wird abgemeldet …" : "Abmelden"}</button>
        </section>
      </div>
    </main>
  );
}
