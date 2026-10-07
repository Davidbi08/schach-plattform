"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";

type UnreadConversation = { username: string; unread_count: number };
type UnreadByFriend = Record<string, UnreadConversation>;
type NotificationContextValue = {
  unreadByFriend: UnreadByFriend;
  unreadTotal: number;
  refreshUnread: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function useDirectMessageNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error("useDirectMessageNotifications muss innerhalb des Notification-Providers verwendet werden.");
  return context;
}

export function DirectMessageNotifications({ children }: { children: ReactNode }) {
  const [unreadByFriend, setUnreadByFriend] = useState<UnreadByFriend>({});
  const [notice, setNotice] = useState<{ friendId: string | null; text: string } | null>(null);
  const clientRef = useRef<ReturnType<typeof createClient> | null>(null);
  const previousUnreadRef = useRef<UnreadByFriend | null>(null);
  const refreshingRef = useRef(false);
  const lastErrorRef = useRef("");
  const getClient = useCallback(() => {
    if (!clientRef.current) clientRef.current = createClient();
    return clientRef.current;
  }, []);

  const refreshUnread = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    try {
      const supabase = getClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) {
        previousUnreadRef.current = null;
        setUnreadByFriend({});
        setNotice(null);
        return;
      }

      const { data, error } = await supabase.rpc("get_unread_direct_message_counts");
      if (error) throw error;

      const next: UnreadByFriend = {};
      for (const row of (data ?? []) as { friend_id: string; username: string; unread_count: number }[]) {
        next[row.friend_id] = { username: row.username, unread_count: Number(row.unread_count) };
      }

      const previous = previousUnreadRef.current;
      if (previous) {
        const increased = Object.entries(next).find(([friendId, conversation]) =>
          conversation.unread_count > (previous[friendId]?.unread_count ?? 0),
        );
        if (increased) {
          const [friendId, conversation] = increased;
          setNotice({ friendId, text: `Neue private Nachricht von ${conversation.username}` });
        } else if (Object.keys(next).length === 0) {
          setNotice(null);
        }
      } else {
        const total = Object.values(next).reduce((sum, conversation) => sum + conversation.unread_count, 0);
        if (total > 0) setNotice({ friendId: null, text: `Du hast ${total} ungelesene private Nachrichten.` });
      }

      previousUnreadRef.current = next;
      setUnreadByFriend(next);
      lastErrorRef.current = "";
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (lastErrorRef.current !== message) {
        console.error("Private Nachrichten-Benachrichtigungen konnten nicht geladen werden:", error);
        lastErrorRef.current = message;
      }
    } finally {
      refreshingRef.current = false;
    }
  }, [getClient]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void refreshUnread(), 0);
    const interval = window.setInterval(() => void refreshUnread(), 8000);
    const onFocus = () => void refreshUnread();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [refreshUnread]);

  const unreadTotal = useMemo(
    () => Object.values(unreadByFriend).reduce((sum, conversation) => sum + conversation.unread_count, 0),
    [unreadByFriend],
  );

  return (
    <NotificationContext.Provider value={{ unreadByFriend, unreadTotal, refreshUnread }}>
      {children}
      {notice && (
        <div role="status" aria-live="polite" className="fixed bottom-4 right-4 z-[60] flex max-w-sm items-center gap-3 rounded-xl border border-emerald-400/40 bg-slate-900 p-4 text-sm text-slate-100 shadow-xl">
          <Link href="/freunde" onClick={() => setNotice(null)} className="flex-1 hover:text-emerald-300">
            {notice.text}
          </Link>
          <button type="button" onClick={() => setNotice(null)} aria-label="Benachrichtigung schließen" className="text-slate-400 hover:text-white">×</button>
        </div>
      )}
    </NotificationContext.Provider>
  );
}
