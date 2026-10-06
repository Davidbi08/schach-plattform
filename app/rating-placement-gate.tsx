"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const choices = [
  { id: "beginner", label: "Anfänger", rating: 800, detail: "Ich kenne die Regeln oder lerne sie gerade." },
  { id: "casual", label: "Gelegenheitsspieler", rating: 1000, detail: "Ich spiele gelegentlich und kenne die Grundlagen." },
  { id: "intermediate", label: "Fortgeschritten", rating: 1300, detail: "Ich spiele regelmäßig und kenne einfache Taktiken." },
  { id: "advanced", label: "Erfahren", rating: 1600, detail: "Ich plane aktiv und erkenne viele taktische Motive." },
  { id: "expert", label: "Sehr stark", rating: 1900, detail: "Ich spiele auf hohem Vereins- oder Turnierniveau." },
] as const;

export default function RatingPlacementGate() {
  const pathname = usePathname();
  const [required, setRequired] = useState(false);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    async function checkPlacement() {
      if (["/profile/setup", "/login", "/auth", "/forgot-password", "/update-password"].some((path) => pathname.startsWith(path))) { setRequired(false); setLoading(false); return; }
      setLoading(true);
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { if (active) setRequired(false); return; }
        const { data, error } = await supabase.from("player_rating_placements").select("user_id").eq("user_id", user.id).maybeSingle();
        if (!active) return;
        if (error) { setErrorMessage("Deine Einstufung konnte nicht geprüft werden. Bitte versuche es erneut."); setRequired(true); }
        else { setRequired(!data); setErrorMessage(""); }
      } catch { if (active) { setErrorMessage("Deine Einstufung konnte nicht geprüft werden. Bitte versuche es erneut."); setRequired(true); } }
      finally { if (active) setLoading(false); }
    }
    void checkPlacement();
    return () => { active = false; };
  }, [pathname, retry]);
  async function savePlacement() {
    if (!selected || saving) return;
    setSaving(true); setErrorMessage("");
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("set_online_rating_placement", { p_skill_level: selected });
      if (error) { setErrorMessage("Deine Einstufung konnte nicht gespeichert werden. Bitte versuche es erneut."); return; }
      setRequired(false);
      window.dispatchEvent(new CustomEvent("online-rating-placement-complete"));
    } catch { setErrorMessage("Der Server ist gerade nicht erreichbar. Bitte versuche es erneut."); }
    finally { setSaving(false); }
  }
  if (loading || !required) return null;
  return <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/90 p-4 backdrop-blur-sm" role="presentation">
    <section role="dialog" aria-modal="true" aria-labelledby="rating-placement-title" className="my-auto w-full max-w-2xl rounded-3xl border border-slate-700 bg-slate-900 p-6 text-white shadow-2xl sm:p-8">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300">Einmalige Einstufung</p>
      <h1 id="rating-placement-title" className="mt-3 text-2xl font-bold sm:text-3xl">Wie schätzt du deine Spielstärke ein?</h1>
      <p className="mt-3 leading-6 text-slate-300">Damit du passende Gegner findest, legen wir für Bullet, Blitz, Rapid und Klassisch einen vorläufigen Startwert fest. Diese Auswahl ist nur eine grobe Selbsteinschätzung.</p>
      <fieldset className="mt-6 grid gap-2 sm:grid-cols-2"><legend className="sr-only">Wähle deine Spielstärke</legend>{choices.map((choice) => <label key={choice.id} className={"flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition " + (selected === choice.id ? "border-emerald-400 bg-emerald-950/50 ring-1 ring-emerald-400" : "border-slate-700 bg-slate-950/50 hover:border-slate-500")}>
        <input type="radio" name="skill-level" value={choice.id} checked={selected === choice.id} onChange={() => setSelected(choice.id)} className="mt-1 accent-emerald-400" />
        <span><span className="flex flex-wrap items-center gap-2 font-semibold">{choice.label}<span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs font-medium text-emerald-300">Startwert {choice.rating}</span></span><span className="mt-1 block text-sm leading-5 text-slate-400">{choice.detail}</span></span>
      </label>)}</fieldset>
      <p className="mt-5 rounded-xl border border-slate-700 bg-slate-950/60 p-4 text-sm leading-6 text-slate-400">Deine ersten fünf gewerteten Partien pro Zeitmodus sind eine vorläufige Phase: In dieser Zeit kann deine Wertung stärker steigen oder fallen. Danach wird sie schrittweise stabiler und richtet sich weiter nach dem Ergebnis und der Wertung des Gegners.</p>
      {errorMessage && <div className="mt-4 flex flex-wrap items-center justify-between gap-3" role="alert"><p className="text-sm text-rose-300">{errorMessage}</p><button type="button" onClick={() => setRetry((value) => value + 1)} className="text-sm font-semibold text-emerald-300 underline underline-offset-4">Erneut prüfen</button></div>}
      <button type="button" onClick={() => void savePlacement()} disabled={!selected || saving} className="mt-6 min-h-12 w-full rounded-xl bg-emerald-400 px-5 py-3 font-bold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Einstufung wird gespeichert …" : "Einstufung speichern und weiterspielen"}</button>
    </section>
  </div>;
}
