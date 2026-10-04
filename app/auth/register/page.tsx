"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);
    setMessage("");

    const supabase = createClient();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    if (data.session) {
      router.push("/profile/setup");
      return;
    }

    setMessage(
      "Registrierung erfolgreich. Bitte bestätige zuerst deine E-Mail. Danach kannst du dich einloggen."
    );

    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-md px-6 py-16">
        <h1 className="text-3xl font-bold">Account erstellen</h1>

        <p className="mt-2 text-slate-400">
          Erstelle deinen Account für die Schachplattform.
        </p>

        <form onSubmit={handleRegister} className="mt-8 space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium">
              E-Mail
            </label>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 outline-none focus:border-slate-400"
              placeholder="deine@email.de"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Passwort
            </label>

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 outline-none focus:border-slate-400"
              placeholder="Mindestens 6 Zeichen"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-white px-4 py-3 font-semibold text-slate-950 transition hover:bg-slate-200 disabled:opacity-50"
          >
            {loading ? "Erstelle Account..." : "Account erstellen"}
          </button>
        </form>

        {message && (
          <p className="mt-6 rounded-xl border border-slate-700 bg-slate-900 p-4 text-sm text-slate-300">
            {message}
          </p>
        )}
      </div>
    </main>
  );
}