"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function Home() {
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .single();

      if (data) {
        setUsername(data.username);
      }

      setLoading(false);
    }

    loadProfile();
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <header className="mb-12">
          <div className="mb-3 text-5xl">♟️</div>

          {loading ? (
            <p className="text-lg text-slate-400">Lade Profil...</p>
          ) : username ? (
            <>
              <h1 className="text-5xl font-bold">
                Hallo, {username}! 👋
              </h1>

              <p className="mt-4 max-w-2xl text-lg text-slate-300">
                Willkommen auf deiner Schachplattform.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-5xl font-bold">
                Deine Schachplattform
              </h1>

              <p className="mt-4 max-w-2xl text-lg text-slate-300">
                Schach. Community. Creator. Deine persönliche Schachreise.
              </p>

              <div className="mt-6 flex gap-3">
                <Link
                  href="/login"
                  className="rounded-xl bg-white px-5 py-3 font-semibold text-slate-950"
                >
                  Einloggen
                </Link>

                <Link
                  href="/auth/register"
                  className="rounded-xl border border-slate-700 px-5 py-3 font-semibold"
                >
                  Account erstellen
                </Link>
              </div>
            </>
          )}
        </header>

        <section>
          <h2 className="mb-5 text-2xl font-bold">
            Was möchtest du machen?
          </h2>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Link
              href="/play"
              className="rounded-2xl border border-slate-700 bg-slate-900 p-6 transition hover:border-slate-500 hover:bg-slate-800"
            >
              <div className="text-4xl">♟️</div>
              <h3 className="mt-4 text-xl font-bold">
                Schach spielen
              </h3>
              <p className="mt-2 text-slate-400">
                Spiele eine Partie auf unserem Schachbrett.
              </p>
            </Link>

            <div className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
              <div className="text-4xl">🤖</div>
              <h3 className="mt-4 text-xl font-bold">
                Gegen Computer
              </h3>
              <p className="mt-2 text-slate-400">
                Spiele später gegen eine KI.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
              <div className="text-4xl">👥</div>
              <h3 className="mt-4 text-xl font-bold">
                Freunde
              </h3>
              <p className="mt-2 text-slate-400">
                Finde Freunde und spiele gemeinsam.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
              <div className="text-4xl">🏆</div>
              <h3 className="mt-4 text-xl font-bold">
                Turniere
              </h3>
              <p className="mt-2 text-slate-400">
                Nimm später an Turnieren teil.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
              <div className="text-4xl">👤</div>
              <h3 className="mt-4 text-xl font-bold">
                Profil
              </h3>
              <p className="mt-2 text-slate-400">
                Deine Spielerstatistiken und Schachreise.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-700 bg-slate-900 p-6">
              <div className="text-4xl">📊</div>
              <h3 className="mt-4 text-xl font-bold">
                Meine Schachreise
              </h3>
              <p className="mt-2 text-slate-400">
                Fortschritt, Partien und persönliche Entwicklung.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}