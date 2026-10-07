"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type AdminNotice = { id: string; title: string; body: string; created_at: string };
type CommunitySuspension = { is_suspended: boolean; reason: string; expires_at: string | null } | null;
type AdminCenterValue = {
  role: string | null;
  suspension: CommunitySuspension;
  refresh: () => Promise<void>;
};

const AdminCenterContext = createContext<AdminCenterValue | null>(null);

export function useAdminCenter() {
  const context = useContext(AdminCenterContext);
  if (!context) throw new Error("useAdminCenter muss innerhalb des Admin-Providers verwendet werden.");
  return context;
}

export function AdminCenterProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [suspension, setSuspension] = useState<CommunitySuspension>(null);
  const [notices, setNotices] = useState<AdminNotice[]>([]);
  const [noticeVisible, setNoticeVisible] = useState(false);
  const clientRef = useRef<ReturnType<typeof createClient> | null>(null);
  const busyRef = useRef(false);
  const errorRef = useRef("");
  const getClient = useCallback(() => {
    if (!clientRef.current) clientRef.current = createClient();
    return clientRef.current;
  }, []);

  const refresh = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      const supabase = getClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) {
        setRole(null);
        setSuspension(null);
        setNotices([]);
        setNoticeVisible(false);
        return;
      }

      const [roleResult, suspensionResult, noticeResult] = await Promise.all([
        supabase.rpc("get_my_admin_access"),
        supabase.rpc("get_my_community_suspension"),
        supabase.rpc("get_my_admin_notifications"),
      ]);
      if (roleResult.error) throw roleResult.error;
      if (suspensionResult.error) throw suspensionResult.error;
      if (noticeResult.error) throw noticeResult.error;

      const firstRole = (roleResult.data ?? [])[0] as { role: string } | undefined;
      const firstSuspension = (suspensionResult.data ?? [])[0] as CommunitySuspension | undefined;
      const nextNotices = (noticeResult.data ?? []) as AdminNotice[];
      setRole(firstRole?.role ?? null);
      setSuspension(firstSuspension?.is_suspended ? firstSuspension : null);
      setNotices(nextNotices);
      if (nextNotices.length > 0) setNoticeVisible(true);
      errorRef.current = "";
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (errorRef.current !== message) {
        console.error("Adminstatus und Nutzermitteilungen konnten nicht geladen werden:", error);
        errorRef.current = message;
      }
    } finally {
      busyRef.current = false;
    }
  }, [getClient]);

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const interval = window.setInterval(() => void refresh(), 20000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  async function dismissNotice(notice: AdminNotice) {
    const { error } = await getClient().rpc("mark_admin_notification_read", { p_notification_id: notice.id });
    if (error) {
      console.error("Adminmitteilung konnte nicht als gelesen markiert werden:", error);
      return;
    }
    setNotices((current) => current.filter((item) => item.id !== notice.id));
    setNoticeVisible(false);
  }

  async function signOutSuspendedUser() {
    const { error } = await getClient().auth.signOut();
    if (error) console.error("Abmeldung nach Kontosperre fehlgeschlagen:", error);
    else router.push("/login");
  }

  const notice = noticeVisible ? notices[0] : undefined;
  return (
    <AdminCenterContext.Provider value={{ role, suspension, refresh }}>
      {children}
      {suspension && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/95 p-4 backdrop-blur-sm">
          <section role="alertdialog" aria-modal="true" aria-labelledby="account-suspension-title" className="w-full max-w-lg rounded-2xl border border-rose-400/50 bg-slate-900 p-6 text-rose-50 shadow-2xl">
            <h1 id="account-suspension-title" className="text-xl font-semibold">Dein Konto ist gesperrt</h1>
            <p className="mt-3 text-sm text-rose-100/90">Du kannst die Plattform derzeit nicht verwenden.</p>
            <p className="mt-2 text-sm text-rose-200/80">Grund: {suspension.reason}</p>
            {suspension.expires_at && <p className="mt-2 text-sm text-rose-200/80">Endet: {new Date(suspension.expires_at).toLocaleString("de-DE")}</p>}
            <button type="button" onClick={() => void signOutSuspendedUser()} className="mt-5 rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-800">Abmelden</button>
          </section>
        </div>
      )}
      {notice && (
        <div role="status" aria-live="polite" className={`fixed right-4 z-[70] flex max-w-sm items-start gap-3 rounded-xl border border-emerald-400/40 bg-slate-900 p-4 text-sm text-slate-100 shadow-xl ${suspension ? "bottom-36" : "bottom-4"}`}>
          <div className="flex-1">
            <strong className="block">{notice.title}</strong>
            <p className="mt-1 whitespace-pre-wrap">{notice.body}</p>
            <time className="mt-2 block text-xs text-slate-500" dateTime={notice.created_at}>{new Date(notice.created_at).toLocaleString("de-DE")}</time>
          </div>
          <button type="button" onClick={() => void dismissNotice(notice)} aria-label="Mitteilung schließen" className="text-slate-400 hover:text-white">×</button>
        </div>
      )}
    </AdminCenterContext.Provider>
  );
}
