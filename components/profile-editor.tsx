"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

type SocialProfile = { bio: string; avatar_url: string | null };

export function ProfileEditor() {
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  const getSupabase = useCallback(() => {
    if (!supabaseRef.current) supabaseRef.current = createClient();
    return supabaseRef.current;
  }, []);
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<SocialProfile>({ bio: "", avatar_url: null });
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const supabase = getSupabase();
        const { data: { user } } = await supabase.auth.getUser();
        if (!active) return;
        if (!user) {
          setMessage("Melde dich an, um dein Profil zu bearbeiten.");
          return;
        }
        setUserId(user.id);
        const { data, error } = await supabase.from("profiles").select("bio, avatar_url").eq("id", user.id).maybeSingle();
        if (error) throw error;
        if (active && data) setProfile({ bio: data.bio ?? "", avatar_url: data.avatar_url ?? null });
      } catch {
        if (active) setMessage("Dein Profil konnte nicht geladen werden.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [getSupabase]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || saving) return;
    setSaving(true);
    setMessage("");
    try {
      const supabase = getSupabase();
      let avatarUrl = profile.avatar_url;
      if (file) {
        const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
        const path = `${userId}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage.from("profile-avatars").upload(path, file, {
          cacheControl: "3600",
          contentType: file.type,
          upsert: false,
        });
        if (uploadError) throw uploadError;
        avatarUrl = supabase.storage.from("profile-avatars").getPublicUrl(path).data.publicUrl;
      }
      const { error: saveError } = await supabase.rpc("update_my_social_profile", {
        p_bio: profile.bio.trim(),
        p_avatar_url: avatarUrl,
      });
      if (saveError) throw saveError;
      setProfile((current) => ({ ...current, avatar_url: avatarUrl }));
      setFile(null);
      setMessage("Profil gespeichert.");
    } catch {
      setMessage("Das Profilbild oder die Biografie konnte nicht gespeichert werden. Bitte versuche es erneut.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p role="status" className="text-sm text-slate-400">Profil wird geladen …</p>;
  if (!userId) return <p className="text-sm text-slate-400">{message}</p>;

  const preview = previewUrl ?? profile.avatar_url;
  return (
    <form onSubmit={save} className="space-y-5">
      <div className="flex flex-wrap items-center gap-4">
        {preview
          ? <img src={preview} alt="Vorschau des Profilbilds" className="h-20 w-20 rounded-full border border-slate-700 bg-slate-950 object-cover" />
          : <span aria-hidden="true" className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-800 text-3xl text-emerald-300">♟</span>}
        <div>
          <label htmlFor="profile-avatar" className="inline-flex cursor-pointer rounded-lg border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800">Profilbild auswählen</label>
          <input
            id="profile-avatar"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(event) => {
              const selected = event.target.files?.[0] ?? null;
              if (previewUrl) URL.revokeObjectURL(previewUrl);
              if (selected && selected.size > 2 * 1024 * 1024) {
                setMessage("Das Bild darf höchstens 2 MB groß sein.");
                setFile(null);
                setPreviewUrl(null);
                event.target.value = "";
                return;
              }
              setMessage("");
              setFile(selected);
              setPreviewUrl(selected ? URL.createObjectURL(selected) : null);
            }}
          />
          <p className="mt-2 text-xs text-slate-500">JPG, PNG oder WebP · maximal 2 MB</p>
        </div>
      </div>
      <div>
        <label htmlFor="profile-bio" className="mb-2 block text-sm font-medium">Biografie</label>
        <textarea id="profile-bio" value={profile.bio} onChange={(event) => setProfile((current) => ({ ...current, bio: event.target.value }))} maxLength={500} rows={4} placeholder="Erzähl anderen kurz etwas über dich und dein Schach." className="w-full resize-y rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm outline-none focus:border-emerald-400" />
        <p className="mt-1 text-right text-xs text-slate-500">{profile.bio.length}/500</p>
      </div>
      {message && <p role="status" className="text-sm text-slate-300">{message}</p>}
      <button type="submit" disabled={saving} className="rounded-lg bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-emerald-300 disabled:opacity-50">{saving ? "Wird gespeichert …" : "Profil speichern"}</button>
    </form>
  );
}
