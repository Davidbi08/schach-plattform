"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ProfileEditor } from "@/components/profile-editor";
import { createClient } from "@/lib/supabase/client";

type PublicProfile = { id: string; username: string; bio: string; avatar_url: string | null };
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

function isMissingSocialRpc(error: { code?: string; message?: string }) {
  return error.code === "PGRST202" || /could not find the function/i.test(error.message ?? "");
}

export function PlayerProfileView({ requestedUsername }: { requestedUsername?: string }) {
  const [username, setUsername] = useState(requestedUsername ?? "");
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [ratings, setRatings] = useState<PlayerRating[]>([]);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [friendMessage, setFriendMessage] = useState("");
  const [addingFriend, setAddingFriend] = useState(false);
  const handleOwnProfileSaved = useCallback((savedProfile: PublicProfile) => {
    setUsername(savedProfile.username);
    setProfile(savedProfile);
    setMessage("");
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setMessage("");
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (active) setViewerId(user?.id ?? null);
        let name = requestedUsername?.trim() ?? "";

        if (!name) {
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

        const { data: profileData, error: profileError } = await supabase.rpc("get_public_profile", { p_username: name });
        const publicProfile = Array.isArray(profileData) ? profileData[0] as PublicProfile | undefined : null;
        if (profileError || !publicProfile) {
          if (active) setMessage(profileError && isMissingSocialRpc(profileError)
            ? "Die Profildatenbank ist noch nicht eingerichtet. Bitte wende die Supabase-Migrationen an."
            : "Dieses Spielerprofil wurde nicht gefunden.");
          return;
        }
        const { data: ratingData } = await supabase.rpc("get_public_player_ratings", { p_username: name });
        if (active) {
          setUsername(name);
          setProfile(publicProfile);
          setRatings(Array.isArray(ratingData) ? ratingData as PlayerRating[] : []);
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

  async function addFriend() {
    if (!profile || addingFriend) return;
    setAddingFriend(true);
    setFriendMessage("");
    try {
      const { error } = await createClient().rpc("request_friend", { p_username: profile.username });
      if (error) {
        setFriendMessage(error.message.includes("bereits eine Anfrage")
          ? "Für diesen Spieler besteht bereits eine Anfrage oder Freundschaft."
          : "Die Anfrage konnte nicht gesendet werden.");
      } else {
        setFriendMessage("Freundschaftsanfrage gesendet.");
      }
    } catch {
      setFriendMessage("Die Anfrage konnte nicht gesendet werden. Bitte versuche es erneut.");
    } finally {
      setAddingFriend(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-8 sm:py-12">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="text-sm text-slate-400 underline underline-offset-4 hover:text-white">← Zur Startseite</Link>
        <header className="mt-8 border-b border-slate-800 pb-7">
          <p className="text-sm font-medium text-emerald-400">SPIELERPROFIL</p>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            {profile?.avatar_url
              ? <img src={profile.avatar_url} alt={`Profilbild von ${profile.username}`} className="h-20 w-20 rounded-full border border-slate-700 object-cover" />
              : <span aria-hidden="true" className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-800 text-3xl text-emerald-300">♟</span>}
            <div>
              <h1 className="break-all text-4xl font-semibold tracking-tight">{username || "Dein Profil"}</h1>
              {profile?.bio && <p className="mt-2 max-w-2xl whitespace-pre-wrap text-slate-300">{profile.bio}</p>}
            </div>
          </div>
          {profile && viewerId === profile.id
            ? <a href="#profile-settings" className="mt-4 inline-flex text-sm font-semibold text-emerald-300 underline underline-offset-4">Profil bearbeiten</a>
            : profile && viewerId && <div className="mt-4 flex flex-wrap items-center gap-3"><button type="button" onClick={() => void addFriend()} disabled={addingFriend} className="rounded-lg bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50">{addingFriend ? "Wird gesendet …" : "Als Freund hinzufügen"}</button><Link href="/freunde" className="text-sm text-slate-300 underline underline-offset-4">Freunde & Nachrichten</Link>{friendMessage && <p role="status" className="text-sm text-slate-300">{friendMessage}</p>}</div>}
          <p className="mt-3 text-slate-300">Online-Elo nach Bedenkzeit. Jede Zeitkontrolle hat eine eigene Wertung.</p>
        </header>

        {!requestedUsername && viewerId && (
          <section id="profile-settings" className="mt-6 scroll-mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6" aria-labelledby="profile-settings-heading">
            <h2 id="profile-settings-heading" className="text-2xl font-bold">Profileinstellungen</h2>
            <p className="mb-5 mt-1 text-sm text-slate-400">Verwalte deinen Benutzernamen, dein Profilbild und deine Biografie.</p>
            <ProfileEditor onProfileSaved={handleOwnProfileSaved} />
          </section>
        )}

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
          ) : ratings.length === 0 ? (
            <p className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-sm text-slate-400">Für dieses Profil sind noch keine Online-Wertungen verfügbar.</p>
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
