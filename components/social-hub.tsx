"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

type SocialTab = "friends" | "global";
type Person = { id: string; username: string; bio?: string; avatar_url?: string | null };
type FriendRequest = Person & { request_id: string; status: string; direction: "incoming" | "outgoing"; created_at: string };
type ChatMessage = { id: string; sender_id: string; username: string; avatar_url: string | null; body: string; created_at: string };

function Avatar({ person, size = "h-10 w-10" }: { person: Pick<Person, "username" | "avatar_url">; size?: string }) {
  return person.avatar_url
    ? <img src={person.avatar_url} alt="" className={`${size} rounded-full bg-slate-800 object-cover`} />
    : <span aria-hidden="true" className={`${size} flex shrink-0 items-center justify-center rounded-full bg-slate-800 font-semibold text-emerald-300`}>{person.username.slice(0, 1).toUpperCase()}</span>;
}

function messageText(error: { message: string } | null, fallback: string) {
  if (!error) return fallback;
  if (error.message.includes("Private Nachrichten")) return "Private Nachrichten sind nur zwischen bestätigten Freunden möglich.";
  if (error.message.includes("viele Nachrichten")) return "Du hast gerade viele Nachrichten gesendet. Bitte warte kurz.";
  return fallback;
}

export function SocialHub({ initialTab = "friends" }: { initialTab?: SocialTab }) {
  const [tab, setTab] = useState<SocialTab>(initialTab);
  const [userId, setUserId] = useState<string | null>(null);
  const [friends, setFriends] = useState<Person[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Person[]>([]);
  const [activeFriend, setActiveFriend] = useState<Person | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageScope, setMessageScope] = useState("");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  const getSupabase = useCallback(() => {
    if (!supabaseRef.current) supabaseRef.current = createClient();
    return supabaseRef.current;
  }, []);

  const loadFriends = useCallback(async () => {
    const supabase = getSupabase();
    const [{ data: friendData, error: friendError }, { data: requestData, error: requestError }] = await Promise.all([
      supabase.rpc("get_my_friends"),
      supabase.rpc("get_my_friend_requests"),
    ]);
    if (friendError || requestError) throw new Error("Freunde und Anfragen konnten nicht geladen werden.");
    setFriends((friendData ?? []) as Person[]);
    setRequests((requestData ?? []) as FriendRequest[]);
  }, [getSupabase]);

  const loadMessages = useCallback(async () => {
    const supabase = getSupabase();
    if (tab === "global") {
      const { data, error: queryError } = await supabase.rpc("get_global_chat_messages");
      if (queryError) throw new Error("Der globale Chat konnte nicht geladen werden.");
      setMessages((data ?? []) as ChatMessage[]);
      setMessageScope("global");
      return;
    }
    if (activeFriend) {
      const { data, error: queryError } = await supabase.rpc("get_direct_messages", { p_other_user_id: activeFriend.id });
      if (queryError) throw new Error("Der private Chat konnte nicht geladen werden.");
      setMessages((data ?? []) as ChatMessage[]);
      setMessageScope(activeFriend.id);
    }
  }, [activeFriend, getSupabase, tab]);

  useEffect(() => {
    let active = true;
    async function initialize() {
      try {
        const { data: { user } } = await getSupabase().auth.getUser();
        if (!active) return;
        setUserId(user?.id ?? null);
        if (user) await loadFriends();
      } catch {
        if (active) setError("Freundesdaten konnten nicht geladen werden. Bitte lade die Seite neu.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void initialize();
    return () => { active = false; };
  }, [getSupabase, loadFriends]);

  useEffect(() => {
    if (!userId || (tab === "friends" && !activeFriend)) {
      return;
    }
    let active = true;
    const refresh = async () => {
      try {
        await loadMessages();
        if (active) setError("");
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Nachrichten konnten nicht geladen werden.");
      }
    };
    void refresh();
    const interval = window.setInterval(() => void refresh(), 5000);
    return () => { active = false; window.clearInterval(interval); };
  }, [activeFriend, loadMessages, tab, userId]);

  async function searchProfiles(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const query = search.trim();
    if (query.length < 3) {
      setError("Gib mindestens drei Zeichen eines Spielernamens ein.");
      return;
    }
    const { data, error: searchError } = await getSupabase().rpc("search_public_profiles", { p_query: query });
    if (searchError) {
      setError("Spieler konnten nicht gesucht werden.");
      return;
    }
    setResults((data ?? []) as Person[]);
  }

  async function requestFriend(username: string) {
    const { error: requestError } = await getSupabase().rpc("request_friend", { p_username: username });
    if (requestError) {
      setError(requestError.message.includes("bereits eine Anfrage") ? "Für diesen Spieler besteht bereits eine Anfrage oder Freundschaft." : "Freundschaftsanfrage konnte nicht gesendet werden.");
      return;
    }
    setError(`Freundschaftsanfrage an ${username} gesendet.`);
    setResults((current) => current.filter((person) => person.username !== username));
    await loadFriends();
  }

  async function respondToRequest(request: FriendRequest, accept: boolean) {
    const { error: responseError } = await getSupabase().rpc("respond_friend_request", { p_request_id: request.request_id, p_accept: accept });
    if (responseError) {
      setError("Die Freundschaftsanfrage konnte nicht aktualisiert werden.");
      return;
    }
    await loadFriends();
  }

  async function removeFriend(friend: Person) {
    const { error: removeError } = await getSupabase().rpc("remove_friend", { p_other_user_id: friend.id });
    if (removeError) {
      setError("Freund konnte nicht entfernt werden.");
      return;
    }
    if (activeFriend?.id === friend.id) setActiveFriend(null);
    await loadFriends();
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || sending || !userId) return;
    setSending(true);
    setError("");
    const supabase = getSupabase();
    const { error: sendError } = tab === "global"
      ? await supabase.rpc("send_global_chat_message", { p_body: body })
      : activeFriend
        ? await supabase.rpc("send_direct_message", { p_recipient_id: activeFriend.id, p_body: body })
        : { error: { message: "Wähle zuerst einen Freund aus." } };
    setSending(false);
    if (sendError) {
      setError(messageText(sendError, "Nachricht konnte nicht gesendet werden."));
      return;
    }
    setDraft("");
    try {
      await loadMessages();
    } catch {
      setError("Nachricht gesendet, aber der Verlauf konnte nicht aktualisiert werden.");
    }
  }

  if (loading) return <p className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-slate-300" role="status">Freunde werden geladen …</p>;
  if (!userId) return <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6"><h2 className="text-xl font-semibold">Melde dich an, um Freunde und Chat zu nutzen</h2><p className="mt-2 text-sm text-slate-400">Freundesliste, private Nachrichten und globaler Chat sind an dein Konto gebunden.</p><Link href="/login" className="mt-4 inline-flex rounded-lg bg-emerald-400 px-4 py-2 font-semibold text-slate-950">Zum Login</Link></section>;

  const incomingRequests = requests.filter((request) => request.direction === "incoming");
  const currentMessageScope = tab === "global" ? "global" : activeFriend?.id ?? "";
  const visibleMessages = messageScope === currentMessageScope ? messages : [];

  return (
    <div className="space-y-5">
      <div className="flex gap-2 rounded-xl border border-slate-800 bg-slate-900 p-2">
        <button type="button" onClick={() => { setTab("friends"); setActiveFriend(null); }} className={`flex-1 rounded-lg px-4 py-3 text-sm font-semibold ${tab === "friends" ? "bg-emerald-400 text-slate-950" : "text-slate-300 hover:bg-slate-800"}`}>Freunde {incomingRequests.length > 0 && `· ${incomingRequests.length} neu`}</button>
        <button type="button" onClick={() => { setTab("global"); setActiveFriend(null); }} className={`flex-1 rounded-lg px-4 py-3 text-sm font-semibold ${tab === "global" ? "bg-emerald-400 text-slate-950" : "text-slate-300 hover:bg-slate-800"}`}>Globaler Chat</button>
      </div>

      {error && <p role="status" className="rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm text-slate-300">{error}</p>}

      {tab === "friends" && (
        <div className="grid gap-5 lg:grid-cols-[minmax(250px,0.8fr)_minmax(0,1.2fr)]">
          <section className="space-y-4">
            <form onSubmit={searchProfiles} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <h2 className="font-semibold">Spieler finden</h2>
              <label htmlFor="player-search" className="sr-only">Nach Spielernamen suchen</label>
              <div className="mt-3 flex gap-2">
                <input id="player-search" value={search} onChange={(event) => setSearch(event.target.value)} maxLength={20} placeholder="Benutzername" className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-400" />
                <button type="submit" className="rounded-lg border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800">Suchen</button>
              </div>
              {results.length > 0 && <ul className="mt-3 space-y-2">{results.map((person) => <li key={person.id} className="flex items-center gap-2 rounded-lg bg-slate-800/70 p-2"><Link href={`/profile/${encodeURIComponent(person.username)}`} className="flex min-w-0 flex-1 items-center gap-2"><Avatar person={person} size="h-8 w-8" /><span className="truncate text-sm">{person.username}</span></Link><button type="button" onClick={() => void requestFriend(person.username)} className="rounded-md bg-emerald-400 px-2 py-1 text-xs font-semibold text-slate-950">Hinzufügen</button></li>)}</ul>}
              {search.trim().length >= 3 && results.length === 0 && <p className="mt-3 text-sm text-slate-500">Keine Spieler gefunden.</p>}
            </form>

            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <h2 className="font-semibold">Freundschaftsanfragen</h2>
              {requests.length === 0 ? <p className="mt-3 text-sm text-slate-500">Keine offenen Anfragen.</p> : <ul className="mt-3 space-y-3">{requests.map((request) => <li key={request.request_id} className="flex items-center gap-2"><Link href={`/profile/${encodeURIComponent(request.username)}`} className="flex min-w-0 flex-1 items-center gap-2"><Avatar person={request} size="h-8 w-8" /><span className="truncate text-sm">{request.username}</span></Link>{request.direction === "incoming" ? <><button type="button" onClick={() => void respondToRequest(request, true)} className="rounded-md bg-emerald-400 px-2 py-1 text-xs font-semibold text-slate-950">Annehmen</button><button type="button" onClick={() => void respondToRequest(request, false)} className="rounded-md border border-slate-700 px-2 py-1 text-xs">Ablehnen</button></> : <span className="text-xs text-slate-500">Ausstehend</span>}</li>)}</ul>}
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <h2 className="font-semibold">Deine Freunde</h2>
              {friends.length === 0 ? <p className="mt-3 text-sm text-slate-500">Noch keine Freunde – suche nach einem Spielernamen.</p> : <ul className="mt-3 space-y-2">{friends.map((friend) => <li key={friend.id} className="flex items-center gap-2"><button type="button" onClick={() => { setActiveFriend(friend); setTab("friends"); }} className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg p-2 text-left ${activeFriend?.id === friend.id ? "bg-slate-800" : "hover:bg-slate-800/60"}`}><Avatar person={friend} size="h-8 w-8" /><span className="truncate text-sm">{friend.username}</span></button><button type="button" onClick={() => void removeFriend(friend)} aria-label={`${friend.username} als Freund entfernen`} className="px-2 text-xs text-slate-500 hover:text-rose-300">Entfernen</button></li>)}</ul>}
            </section>
          </section>

          <ChatPanel
            title={activeFriend ? `Chat mit ${activeFriend.username}` : "Private Nachrichten"}
            messages={activeFriend ? visibleMessages : []}
            userId={userId}
            draft={draft}
            onDraft={setDraft}
            onSubmit={sendMessage}
            sending={sending}
            maxLength={2000}
            emptyText={activeFriend ? "Schreib deinem Freund eine Nachricht." : "Wähle links einen Freund aus, um privat zu schreiben."}
            onBack={() => setActiveFriend(null)}
            showBack={Boolean(activeFriend)}
          />
        </div>
      )}

      {tab === "global" && (
        <ChatPanel title="Globaler Schach-Chat" messages={visibleMessages} userId={userId} draft={draft} onDraft={setDraft} onSubmit={sendMessage} sending={sending} maxLength={500} emptyText="Noch keine Nachrichten. Starte das Gespräch respektvoll – und bleib beim Schach." />
      )}
    </div>
  );
}

function ChatPanel({
  title, messages, userId, draft, onDraft, onSubmit, sending, maxLength, emptyText, onBack, showBack = false,
}: {
  title: string;
  messages: ChatMessage[];
  userId: string;
  draft: string;
  onDraft: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  sending: boolean;
  maxLength: number;
  emptyText: string;
  onBack?: () => void;
  showBack?: boolean;
}) {
  return (
    <section className="flex min-h-[32rem] flex-col rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <h2 className="font-semibold">{title}</h2>
        {showBack && <button type="button" onClick={onBack} className="text-xs text-slate-400 underline underline-offset-4">Alle Freunde</button>}
        <span className="text-xs text-slate-500">Aktualisiert automatisch</span>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto py-4" aria-live="polite">
        {messages.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">{emptyText}</p> : messages.map((message) => (
          <article key={message.id} className={`flex gap-2 ${message.sender_id === userId ? "flex-row-reverse" : ""}`}>
            <Link href={`/profile/${encodeURIComponent(message.username)}`} aria-label={`Profil von ${message.username}`}>
              <Avatar person={{ username: message.username, avatar_url: message.avatar_url }} size="h-8 w-8" />
            </Link>
            <div className={`max-w-[85%] rounded-xl px-3 py-2 ${message.sender_id === userId ? "bg-emerald-950/60 text-emerald-50" : "bg-slate-800 text-slate-200"}`}>
              <div className="mb-1 flex items-baseline gap-2"><Link href={`/profile/${encodeURIComponent(message.username)}`} className="text-xs font-semibold hover:underline">{message.username}</Link><time dateTime={message.created_at} className="text-[10px] text-slate-500">{new Date(message.created_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</time></div>
              <p className="whitespace-pre-wrap break-words text-sm">{message.body}</p>
            </div>
          </article>
        ))}
      </div>
      <form onSubmit={onSubmit} className="border-t border-slate-800 pt-3">
        <label htmlFor={`message-${title}`} className="sr-only">Nachricht schreiben</label>
        <textarea id={`message-${title}`} value={draft} onChange={(event) => onDraft(event.target.value)} maxLength={maxLength} rows={2} placeholder="Nachricht schreiben …" className="w-full resize-y rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm outline-none focus:border-emerald-400" />
        <div className="mt-2 flex items-center justify-between gap-3"><span className="text-xs text-slate-500">Max. {maxLength} Zeichen</span><button type="submit" disabled={sending || !draft.trim()} className="rounded-lg bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-300 disabled:opacity-50">{sending ? "Wird gesendet …" : "Senden"}</button></div>
      </form>
    </section>
  );
}
