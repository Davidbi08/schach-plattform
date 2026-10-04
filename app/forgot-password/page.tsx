"use client";
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const { error } = await createClient().auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + "/auth/callback?next=/update-password",
      });
      if (error) throw error;
      setMessage("Wenn ein Konto mit dieser E-Mail existiert, erhältst du in Kürze eine E-Mail mit dem Link zum Zurücksetzen.");
    } catch (error) {
      console.error("Passwort-Reset konnte nicht angefordert werden:", error);
      setMessage("Die Anfrage konnte gerade nicht gesendet werden. Bitte versuche es später erneut.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-md px-6 py-16">
        <h1 className="text-3xl font-bold">Passwort zurücksetzen</h1>
        <p className="mt-2 text-slate-400">Gib die E-Mail-Adresse deines Accounts ein. Wenn sie registriert ist, schicken wir dir einen Link.</p>
        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-medium">E-Mail</label>
            <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 outline-none focus:border-slate-400" placeholder="deine@email.de" />
          </div>
          <button type="submit" disabled={loading} className="w-full rounded-xl bg-white px-4 py-3 font-semibold text-slate-950 disabled:opacity-50">{loading ? "Sende Link..." : "Link per E-Mail senden"}</button>
        </form>
        {message && <p role="status" className="mt-6 rounded-xl border border-slate-700 bg-slate-900 p-4 text-sm text-slate-300">{message}</p>}
        <p className="mt-6 text-sm text-slate-400"><Link className="underline hover:text-white" href="/login">Zurück zum Einloggen</Link></p>
      </div>
    </main>
  );
}
