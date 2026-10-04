"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ProfileSetupPage() {
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);
    setMessage("");

    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("Du bist nicht eingeloggt.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("profiles").insert({
      id: user.id,
      username: username.trim(),
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    router.push("/");
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-md px-6 py-16">
        <h1 className="text-3xl font-bold">
          Erstelle deinen Benutzernamen
        </h1>

        <p className="mt-3 text-slate-400">
          Dieser Name wird später auf deinem Profil und bei deinen Partien angezeigt.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium">
              Benutzername
            </label>

            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
              maxLength={20}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 outline-none focus:border-slate-400"
              placeholder="z. B. DavidChess"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-white px-4 py-3 font-semibold text-slate-950 transition hover:bg-slate-200 disabled:opacity-50"
          >
            {loading ? "Speichere..." : "Profil erstellen"}
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