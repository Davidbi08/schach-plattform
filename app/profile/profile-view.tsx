"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type PlayerRating = {
  username: string;
  game_mode: "bullet" | "blitz" | "rapid" | "classical";
  rating: number;
  rated_games: number;
  wins: number;
  draws: number;
  losses: number;
};

const modeLabels: Record<PlayerRating["game_mode"], string> = {
  bullet: "Bullet",
  blitz: "Blitz",
  rapid: "Rapid",
  classical: "Klassisch",
};

export function PlayerProfileView({ requestedUsername }: { requestedUsername?: string }) {
  const [username, setUsername] = useState(requestedUsername ?? "");
  const [ratings, setRatings] = useState<PlayerRating[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setMessage("");
      try {
        const supabase = createClient();
        let name = requestedUsername?.trim() ?? "";

        if (!name) {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) {
            if (active) setMessage("Melde dich an, um dein Spielerprofil zu sehen.");
            return;
          }
          const { data: profile, error } = await supabase
            .from("profiles")
            .select("username")
            .eq("id", user.id)
            .maybeSingle();
          if (error || !profile?.username) {
            if (active) setMessage("Richte zuerst deinen Benutzernamen ein.");
            return;
          }
          name = profile.username;
        }

        const { data, error } = await supabase.rpc("get_public_player_ratings", { p_username: name });
        if (error || !Array.isArray(data) || data.length === 0) {
          if (active) setMessage("Dieses Spielerprofil wurde nicht gefunden.");
          return;
        }
        if (active) {
          setUsername(name);
          setRatings(data as PlayerRating[]);
        }
      } catch {
        if (active) setMessage("Das Spielerprofil konnte gerade nicht geladen werden.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => { active = false; };
  }, [requestedUsername]);

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-8 sm:py-12">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="text-sm text-slate-400 underline underline-offset-4 hover:text-white">← Zur Startseite</Link>
        <header className="mt-8 border-b border-slate-800 pb-7">
          <p className="text-sm font-medium text-emerald-400">SPIELERPROFIL</p>
          <h1 className="mt-2 break-all text-4xl font-semibold tracking-tight">{username || "Dein Profil"}</h1>
          <p className="mt-3 text-slate-300">Online-Elo nach Bedenkzeit. Jede Zeitkontrolle hat eine eigene Wertung.</p>
        </header>

        <section className="mt-6" aria-labelledby="ratings-heading">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 id="ratings-heading" className="text-2xl font-bold">Online-Elo</h2>
              <p className="mt-1 text-sm text-slate-400">Der Startwert beruht auf deiner Selbsteinschätzung. In den ersten fünf gewerteten Partien je Modus ist die Wertung vorläufig und reagiert stärker.</p>
            </div>
            <Link href="/online" className="text-sm font-semibold text-emerald-300 underline underline-offset-4">Online spielen</Link>
          </div>

          {loading ? (
            <p className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-slate-300" role="status">Wertungen werden geladen …</p>
          ) : message ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <p className="text-slate-300">{message}</p>
              {message.includes("Benutzernamen") && <Link href="/profile/setup" className="mt-4 inline-flex rounded-lg bg-emerald-400 px-4 py-2 font-semibold text-slate-950">Profil einrichten</Link>}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {ratings.map((rating) => (
                <article key={rating.game_mode} className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="text-lg font-semibold">{modeLabels[rating.game_mode]}</h3>
                    <p className="text-3xl font-bold tabular-nums text-emerald-300">{rating.rating}</p>
                  </div>
                  <p className="mt-3 text-sm text-slate-400">{rating.rated_games < 5 ? "Vorläufig · noch " + (5 - rating.rated_games) + " Partien bis zur stabileren Wertung" : "Einstufungsphase abgeschlossen"}</p>
                  <p className="mt-1 text-sm text-slate-400">{rating.wins} Siege · {rating.draws} Remis · {rating.losses} Niederlagen</p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
