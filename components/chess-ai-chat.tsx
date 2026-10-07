"use client";

import { FormEvent, useState } from "react";

type ChatScope = "general" | "analysis" | "tactics";
type ChatMessage = { role: "user" | "assistant"; content: string };

const scopeLabels: Record<ChatScope, { title: string; description: string; placeholder: string }> = {
  general: {
    title: "Schach-Chat",
    description: "Frage zu Regeln, Eröffnungen, Strategie, Training oder Schachgeschichte.",
    placeholder: "Was möchtest du über Schach wissen?",
  },
  analysis: {
    title: "Analyse-Coach",
    description: "Frage zur aktuellen Stellung, zu einem Zug oder zur Bewertung.",
    placeholder: "Warum ist dieser Zug gut oder schlecht?",
  },
  tactics: {
    title: "Taktik-Coach",
    description: "Lass dir Motive, Lösungszüge und Ideen dieser Aufgabe erklären.",
    placeholder: "Warum ist das der beste Zug?",
  },
};

export function ChessAIChat({ scope, context = "" }: { scope: ChatScope; context?: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const labels = scopeLabels[scope];

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || busy) return;

    const userMessage: ChatMessage = { role: "user", content };
    const conversation = [...messages, userMessage];
    setMessages(conversation);
    setDraft("");
    setError("");
    setBusy(true);

    try {
      const response = await fetch("/api/chess-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, context, messages: conversation.slice(-12) }),
      });
      const result = await response.json() as { answer?: string; error?: string };
      if (!response.ok || typeof result.answer !== "string") {
        throw new Error(result.error || "Die Antwort konnte nicht geladen werden.");
      }
      setMessages((current) => [...current, { role: "assistant", content: result.answer! }]);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Verbindung zum Schach-Chat fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5" aria-label={labels.title}>
      <h2 className="text-lg font-semibold">{labels.title}</h2>
      <p className="mt-1 text-sm text-slate-400">{labels.description}</p>

      {messages.length > 0 && (
        <div className="mt-4 max-h-80 space-y-3 overflow-y-auto" aria-live="polite">
          {messages.map((message, index) => (
            <div key={`${index}-${message.role}`} className={`rounded-xl p-3 text-sm leading-6 ${message.role === "user" ? "ml-6 bg-emerald-950/50 text-emerald-100" : "mr-3 bg-slate-800 text-slate-200"}`}>
              <p className="mb-1 text-xs font-semibold text-slate-400">{message.role === "user" ? "Du" : "Schach-KI"}</p>
              <p className="whitespace-pre-wrap">{message.content}</p>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={sendMessage} className="mt-4">
        <label className="sr-only" htmlFor={`chess-chat-${scope}`}>Deine Schachfrage</label>
        <textarea
          id={`chess-chat-${scope}`}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={1500}
          rows={3}
          placeholder={labels.placeholder}
          className="w-full resize-y rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-white outline-none focus:border-emerald-400"
          disabled={busy}
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500">Nur Schachthemen · maximal 1.500 Zeichen</span>
          <button type="submit" disabled={busy || !draft.trim()} className="rounded-lg bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50">
            {busy ? "Antwort wird erstellt …" : "Fragen"}
          </button>
        </div>
      </form>

      <p className="mt-3 text-xs leading-5 text-slate-500">
        Deine Frage{context ? " und die aktuelle Schachstellung" : ""} werden zur Antwort an OpenAI gesendet. Der Chatverlauf wird von dieser Website nicht dauerhaft gespeichert.
      </p>
      {error && <p role="alert" className="mt-3 text-sm text-rose-300">{error}</p>}
    </section>
  );
}
