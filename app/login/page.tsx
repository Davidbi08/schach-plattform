"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMessage(error.message);
        return;
      }
      const user = data.user;
      if (!user) {
        setMessage("Login fehlgeschlagen.");
        return;
      }
      const { data: profile } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
      if (profile) router.push("/");
      else router.push("/profile/setup");
    } catch (error) {
      console.error("Login fehlgeschlagen:", error);
      setMessage("Anmeldung momentan nicht möglich. Bitte überprüfe deine Verbindung und versuche es erneut.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center bg-slate-950 px-5 py-12 text-white">
      <div className="mx-auto w-full max-w-md">
        <Link href="/" className="mb-7 inline-flex items-center gap-2 text-sm font-medium text-slate-400 transition hover:text-white"><span className="text-emerald-400" aria-hidden="true">♟</span> Zur Schachplattform</Link>
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8">
          <h1 className="text-3xl font-semibold tracking-tight">Einloggen</h1>
          <p className="mt-2 text-slate-400">Melde dich an, um weiterzuspielen.</p>
          <form onSubmit={handleLogin} className="mt-7 space-y-5">
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-200">E-Mail</label>
              <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 outline-none transition placeholder:text-slate-600 focus:border-emerald-400" placeholder="deine@email.de" />
            </div>
            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-200">Passwort</label>
              <input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 outline-none transition placeholder:text-slate-600 focus:border-emerald-400" placeholder="Dein Passwort" />
            </div>
            <button type="submit" disabled={loading} className="w-full rounded-lg bg-emerald-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:opacity-50">
              {loading ? "Einloggen..." : "Einloggen"}
            </button>
          </form>
          <p className="mt-4 text-sm text-slate-400"><Link href="/forgot-password" className="underline hover:text-white">Passwort vergessen?</Link></p>
          <p className="mt-6 border-t border-slate-800 pt-5 text-sm text-slate-400">Noch kein Konto? <Link href="/auth/register" className="font-medium text-slate-200 underline underline-offset-4 hover:text-emerald-300">Account erstellen</Link></p>
          {message && <p className="mt-6 rounded-xl border border-slate-700 bg-slate-900 p-4 text-sm text-slate-300">{message}</p>}
        </section>
      </div>
    </main>
  );
}
