"use client";
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (password !== confirmPassword) {
      setMessage("Die Passwörter stimmen nicht überein.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await createClient().auth.updateUser({ password });
      if (error) throw error;
      setSaved(true);
      setMessage("Dein Passwort wurde geändert. Du kannst dich jetzt damit einloggen.");
      setPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error("Passwort konnte nicht geändert werden:", error);
      setMessage("Der Link ist möglicherweise abgelaufen. Fordere bitte einen neuen Link an und versuche es erneut.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-md px-6 py-16">
        <h1 className="text-3xl font-bold">Neues Passwort festlegen</h1>
        <p className="mt-2 text-slate-400">Wähle ein neues Passwort für deinen Account.</p>
        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label htmlFor="password" className="mb-2 block text-sm font-medium">Neues Passwort</label>
            <input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} autoComplete="new-password" className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 outline-none focus:border-slate-400" placeholder="Mindestens 6 Zeichen" />
          </div>
          <div>
            <label htmlFor="confirm-password" className="mb-2 block text-sm font-medium">Passwort wiederholen</label>
            <input id="confirm-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={6} autoComplete="new-password" className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 outline-none focus:border-slate-400" placeholder="Neues Passwort wiederholen" />
          </div>
          <button type="submit" disabled={loading || saved} className="w-full rounded-xl bg-white px-4 py-3 font-semibold text-slate-950 disabled:opacity-50">{loading ? "Speichere..." : "Neues Passwort speichern"}</button>
        </form>
        {message && <p role="status" className="mt-6 rounded-xl border border-slate-700 bg-slate-900 p-4 text-sm text-slate-300">{message}</p>}
        {saved && <p className="mt-6 text-sm text-slate-400"><Link className="underline hover:text-white" href="/login">Zum Einloggen</Link></p>}
      </div>
    </main>
  );
}
