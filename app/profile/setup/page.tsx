"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const levels = [
  { id: "beginner", label: "Anfänger", elo: 800, detail: "Ich lerne die Regeln oder kenne sie gerade erst." },
  { id: "casual", label: "Gelegenheitsspieler", elo: 1000, detail: "Ich spiele gelegentlich und kenne die Grundlagen." },
  { id: "intermediate", label: "Fortgeschritten", elo: 1300, detail: "Ich spiele regelmäßig und kenne einfache Taktiken." },
  { id: "advanced", label: "Erfahren", elo: 1600, detail: "Ich plane aktiv und erkenne viele taktische Motive." },
  { id: "expert", label: "Sehr stark", elo: 1900, detail: "Ich spiele auf hohem Vereins- oder Turnierniveau." },
];
const usernamePattern = /^[a-zA-Z0-9_]{3,20}$/;

export default function ProfileSetupPage() {
  const [username, setUsername] = useState("");
  const [skillLevel, setSkillLevel] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();
  useEffect(() => {
    let active = true;
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;
      if (!user) { setUserId(null); setChecking(false); return; }
      setUserId(user.id);
      const { data } = await supabase.from("profiles").select("username").eq("id", user.id).maybeSingle();
      if (active && data?.username) setUsername(data.username);
      if (active) setChecking(false);
    }
    void load().catch(() => { if (active) { setMessage("Dein Profil konnte nicht geladen werden. Bitte lade die Seite neu."); setChecking(false); } });
    return () => { active = false; };
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage("");
    const name = username.trim();
    if (!usernamePattern.test(name)) { setMessage("Der Benutzername muss 3 bis 20 Zeichen haben und darf nur Buchstaben, Zahlen und _ enthalten."); return; }
    if (!skillLevel) { setMessage("Bitte wähle deine Spielstärke aus."); return; }
    if (!userId) { setMessage("Bitte melde dich zuerst an."); return; }
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: profileError } = await supabase.from("profiles").upsert({ id: userId, username: name }, { onConflict: "id" });
      if (profileError) { setMessage(profileError.code === "23505" ? "Dieser Benutzername ist bereits vergeben." : "Dein Profil konnte nicht gespeichert werden."); return; }
      const { error: placementError } = await supabase.rpc("set_online_rating_placement", { p_skill_level: skillLevel });
      if (placementError) { setMessage("Der Name wurde gespeichert, aber die Einstufung konnte nicht gesichert werden. Bitte versuche es erneut."); return; }
      window.dispatchEvent(new CustomEvent("online-rating-placement-complete"));
      router.replace("/"); router.refresh();
    } catch { setMessage("Der Server ist gerade nicht erreichbar. Bitte versuche es erneut."); }
    finally { setLoading(false); }
  }

  return (
    <main className="flex min-h-screen items-center bg-slate-950 px-4 py-10 text-white sm:px-6">
      <div className="mx-auto w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900/70 p-6 sm:p-9">
        <Link href="/" className="text-sm text-slate-400 underline underline-offset-4 hover:text-white">← Zurück</Link>
        <p className="mt-7 text-sm font-medium text-emerald-400">DEIN SPIELERPROFIL</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Richte dein Spielerprofil ein</h1>
        <p className="mt-3 leading-6 text-slate-400">Lege deinen Namen und eine erste Online-Einstufung fest. Die Wertung wird nach den ersten Partien genauer.</p>
        {checking ? (
          <p className="mt-8 text-slate-300" role="status">Profil wird geladen …</p>
        ) : !userId ? (
          <div className="mt-8">
            <p className="text-slate-300">Melde dich an, damit wir die Angaben deinem Account zuordnen können.</p>
            <Link href="/login" className="mt-5 inline-flex rounded-lg bg-emerald-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300">Zum Login</Link>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-8 space-y-6">
            <div>
              <label htmlFor="username" className="mb-2 block text-sm font-medium text-slate-200">Benutzername</label>
              <input id="username" value={username} onChange={(event) => setUsername(event.target.value)} minLength={3} maxLength={20} required autoComplete="nickname" className="min-h-12 w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 outline-none transition placeholder:text-slate-600 focus:border-emerald-400" placeholder="z. B. DavidChess" />
              <p className="mt-2 text-sm text-slate-500">3–20 Zeichen, Buchstaben, Zahlen und Unterstriche.</p>
            </div>
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-slate-200">Wie schätzt du dich ein?</legend>
              <p className="mb-3 text-sm text-slate-400">Der Startwert gilt für Bullet, Blitz, Rapid und Klassisch.</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {levels.map((level) => (
                  <label key={level.id} className={"flex cursor-pointer gap-3 rounded-lg border p-3 transition " + (skillLevel === level.id ? "border-emerald-400 bg-emerald-950/40" : "border-slate-700 bg-slate-950/50 hover:border-slate-500")}>
                    <input type="radio" name="skill-level" value={level.id} checked={skillLevel === level.id} onChange={() => setSkillLevel(level.id)} required className="mt-1 accent-emerald-400" />
                    <span><strong>{level.label} · {level.elo} Elo</strong><span className="mt-1 block text-xs leading-5 text-slate-400">{level.detail}</span></span>
                  </label>
                ))}
              </div>
            </fieldset>
            <p className="text-sm leading-5 text-slate-500">Die ersten fünf gewerteten Partien pro Modus zählen als vorläufige Einstufung. In dieser Phase sind größere Plus- oder Minusänderungen möglich.</p>
            <button type="submit" disabled={loading || !username.trim() || !skillLevel} className="min-h-12 w-full rounded-lg bg-emerald-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:opacity-50">{loading ? "Wird gespeichert …" : "Profil und Einstufung speichern"}</button>
          </form>
        )}
        {message && <p role="alert" className="mt-5 rounded-lg border border-rose-900 bg-rose-950/40 p-4 text-sm text-rose-200">{message}</p>}
      </div>
    </main>
  );
}
