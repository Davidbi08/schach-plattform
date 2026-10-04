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
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-md px-6 py-16">
        <h1 className="text-3xl font-bold">Einloggen</h1>
        <p className="mt-2 text-slate-400">Logge dich in deinen Account ein.</p>
        <form onSubmit={handleLogin} className="mt-8 space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium">E-Mail</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 outline-none focus:border-slate-400" placeholder="deine@email.de" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">Passwort</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 outline-none focus:border-slate-400" placeholder="Dein Passwort" />
          </div>
          <button type="submit" disabled={loading} className="w-full rounded-xl bg-white px-4 py-3 font-semibold text-slate-950 transition hover:bg-slate-200 disabled:opacity-50">
            {loading ? "Einloggen..." : "Einloggen"}
          </button>
        </form>
        <p className="mt-4 text-sm text-slate-400">
          <Link href="/forgot-password" className="underline hover:text-white">Passwort vergessen?</Link>
        </p>
        {message && <p className="mt-6 rounded-xl border border-slate-700 bg-slate-900 p-4 text-sm text-slate-300">{message}</p>}
      </div>
    </main>
  );
}
