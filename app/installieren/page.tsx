"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function InstallierenPage() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in window.navigator && Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone));
    setInstalled(isStandalone);

    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
  }, []);

  async function installApp() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const result = await installPrompt.userChoice;
    setMessage(result.outcome === "accepted" ? "Die App wird hinzugefügt." : "Du kannst die Installation jederzeit später starten.");
    setInstallPrompt(null);
  }

  function refreshApp() {
    window.location.assign("/?refresh=" + Date.now());
  }

  const choiceClass = "rounded-xl border border-slate-600 px-4 py-3 text-center font-semibold text-slate-100 transition hover:border-slate-400 hover:bg-slate-800";
  const updateClass = "mt-3 rounded-lg border border-slate-500 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-slate-300 hover:bg-slate-800";
  const chromeIntentUrl = "intent://schach-plattform.vercel.app/installieren#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=https%3A%2F%2Fschach-plattform.vercel.app%2Finstallieren%23android;end";

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm text-slate-300 underline underline-offset-4 hover:text-white">← Zur Startseite</Link>
        <div className="mt-10 rounded-3xl border border-slate-800 bg-slate-900 p-8 sm:p-10">
          <div className="relative mb-6 flex h-16 w-16 items-start justify-start" aria-label="Läufer und Springer">
            <span className="absolute left-0 top-0 text-4xl leading-none text-slate-100">♝</span>
            <span className="absolute bottom-0 right-0 text-4xl leading-none text-slate-300">♞</span>
          </div>
          <h1 className="text-3xl font-bold sm:text-4xl">Schach auf deinem Gerät</h1>
          <p className="mt-4 text-slate-300">Wähle dein Gerät aus. Ich zeige dir dann genau, wie du die Schachplattform dort hinzufügst.</p>

          <nav aria-label="Gerät auswählen" className="mt-6 grid gap-3 sm:grid-cols-3">
            <Link href="#iphone" className={choiceClass}>iPhone / iPad</Link>
            <Link href="#android" className={choiceClass}>Android</Link>
            <Link href="#computer" className={choiceClass}>PC / Mac</Link>
          </nav>

          <div className="mt-7">
            {installed ? (
              <p className="rounded-xl bg-slate-800 px-5 py-4 text-slate-100">Die App ist auf diesem Gerät bereits installiert.</p>
            ) : installPrompt ? (
              <button onClick={installApp} className="rounded-xl bg-white px-5 py-3 font-semibold text-slate-950 hover:bg-slate-200">Jetzt installieren</button>
            ) : (
              <p className="rounded-xl bg-slate-800 px-5 py-4 text-slate-200">Wähle oben dein Gerät aus. Dein Browser zeigt dir, wo du die Installation startest.</p>
            )}
            {message && <p className="mt-3 text-sm text-slate-300" role="status">{message}</p>}
          </div>

          <div className="mt-9 grid gap-5 sm:grid-cols-2">
            <section id="iphone" className="scroll-mt-6 rounded-2xl border border-slate-700 p-5">
              <h2 className="text-lg font-semibold">iPhone oder iPad</h2>
              <p className="mt-3 text-sm text-slate-300">Die Installation funktioniert in Safari. Wenn diese Seite gerade in einem anderen Browser geöffnet ist, tippe dort auf „Teilen“ und wähle „In Safari öffnen“, falls diese Option angezeigt wird. Eine Website kann Safari nicht selbst erzwingen.</p>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-300">
                <li>Öffne diese Seite in Safari.</li>
                <li>Tippe auf „Teilen“ (Quadrat mit Pfeil nach oben).</li>
                <li>Wähle „Zum Home-Bildschirm“ und dann „Hinzufügen“.</li>
              </ol>
              <button type="button" onClick={refreshApp} className={updateClass}>In diesem App-Fenster neu laden</button>
            </section>
            <section id="android" className="scroll-mt-6 rounded-2xl border border-slate-700 p-5">
              <h2 className="text-lg font-semibold">Android</h2>
              <a href={chromeIntentUrl} className="mt-3 inline-flex rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-slate-200">Seite in Chrome öffnen</a>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-300">
                <li>Tippe oben rechts auf ⋮.</li>
                <li>Wähle „App installieren“ oder „Zum Startbildschirm hinzufügen“.</li>
              </ol>
              <button type="button" onClick={refreshApp} className={updateClass}>In diesem App-Fenster neu laden</button>
            </section>
            <section id="computer" className="scroll-mt-6 rounded-2xl border border-slate-700 p-5 sm:col-span-2">
              <h2 className="text-lg font-semibold">Windows oder Mac</h2>
              <p className="mt-3 text-sm text-slate-300">Öffne die Seite in Chrome oder Edge. Klicke auf das Installieren-Symbol rechts in der Adresszeile oder öffne das Browsermenü und wähle „App installieren“.</p>
              <button type="button" onClick={refreshApp} className={updateClass}>In diesem App-Fenster neu laden</button>
            </section>
          </div>
          <p className="mt-7 text-xs text-slate-400">Der Button lädt die Startseite in diesem App-Fenster neu. Eine Browserleiste wird dabei nicht eingeblendet; das App-Symbol aktualisiert sich separat. Dafür brauchst du eine Internetverbindung. Du kannst die App später wie andere Apps von deinem Gerät entfernen.</p>
        </div>
      </div>
    </main>
  );
}
