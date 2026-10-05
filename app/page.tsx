"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
export default function Home() {
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    async function loadProfile() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase.from("profiles").select("username").eq("id", user.id).single();
        if (data) setUsername(data.username);
      } catch (error) { console.error("Profil konnte nicht geladen werden:", error); }
      finally { setLoading(false); }
    }
    void loadProfile();
  }, []);
  async function handleLogout() {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    if (error) { console.error("Abmelden fehlgeschlagen:", error); return; }
    window.location.assign("/login");
  }
  return <main className="min-h-screen bg-slate-950 text-white"><div className="mx-auto max-w-6xl px-6 py-12">
    <header className="mb-16"><div className="mb-5 text-5xl" aria-hidden="true">♟</div>
      {loading ? <p className="text-lg text-slate-400">Lade Profil …</p> : username ? <><h1 className="text-4xl font-bold sm:text-5xl">Hallo, {username}!</h1><p className="mt-4 max-w-2xl text-lg text-slate-300">Willkommen zurück. Schön, dass du wieder da bist.</p><button type="button" onClick={() => void handleLogout()} className="mt-6 rounded-xl border border-slate-700 px-5 py-3 font-semibold text-slate-100 transition hover:bg-slate-800">Ausloggen</button></> : <><h1 className="text-4xl font-bold sm:text-5xl">Deine Schachplattform</h1><p className="mt-4 max-w-2xl text-lg text-slate-300">Schach. Community. Creator. Deine persönliche Schachreise.</p><div className="mt-6 flex flex-wrap gap-3"><Link href="/login" className="rounded-xl bg-white px-5 py-3 font-semibold text-slate-950">Einloggen</Link><Link href="/auth/register" className="rounded-xl border border-slate-700 px-5 py-3 font-semibold">Account erstellen</Link></div></>}
      <Link href="/installieren" className="mt-6 flex w-fit rounded-xl border border-slate-700 px-5 py-3 font-semibold text-slate-100 transition hover:bg-slate-800">App installieren</Link>
    </header>
    <section className="max-w-3xl rounded-2xl border border-slate-800 bg-slate-900/70 p-7 sm:p-10"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">Spielen · Lernen · Gemeinsam wachsen</p><h2 className="mt-4 text-2xl font-bold sm:text-3xl">Wähle deinen nächsten Schachmoment.</h2><p className="mt-4 leading-7 text-slate-300">Alle Bereiche findest du übersichtlich im Menü. Unter „Spielen“ kannst du eine Partie starten oder gegen einen Bot antreten. In der Analyse kannst du deine Partien nachspielen und untersuchen.</p><p className="mt-6 text-sm text-slate-500">Die Plattform wächst Schritt für Schritt mit deiner Schachreise.</p></section>
  </div></main>;
}
