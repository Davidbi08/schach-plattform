"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type MenuItem = { label: string; icon: string; href?: string; soon?: boolean };

const sections: { title?: string; items: MenuItem[] }[] = [
  { items: [
    { label: "Home", icon: "⌂", href: "/" },
    { label: "Spielen", icon: "♟", href: "/play" },
    { label: "Analyse", icon: "⌕", href: "/analyse" },
    { label: "Coach", icon: "♙", soon: true },
    { label: "Training", icon: "◎", soon: true },
  ] },
  { title: "Social", items: [
    { label: "Freunde", icon: "♧", soon: true },
    { label: "Nachrichten", icon: "▱", soon: true },
    { label: "Turniere", icon: "♜", soon: true },
  ] },
  { title: "Community", items: [
    { label: "Clans", icon: "♢", soon: true },
    { label: "Creator", icon: "▻", soon: true },
    { label: "Live", icon: "◉", soon: true },
  ] },
];

export default function AppNavigation() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  if (pathname.startsWith("/login") || pathname.startsWith("/auth") || pathname.startsWith("/forgot-password")) return null;

  function isActive(item: MenuItem) {
    if (!item.href) return false;
    if (item.href === "/") return pathname === "/";
    if (item.href === "/play") return pathname === "/play" || pathname === "/bot";
    return pathname === item.href || pathname.startsWith(item.href + "/");
  }

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-30 flex h-14 items-center border-b border-slate-800 bg-slate-950/95 px-4 backdrop-blur md:hidden">
        <button type="button" onClick={() => setOpen(true)} aria-label="Menü öffnen" aria-expanded={open} className="flex h-10 w-10 items-center justify-center rounded-xl text-3xl leading-none text-slate-100 hover:bg-slate-800">⋯</button>
        <Link href="/" className="ml-3 flex items-center gap-2 font-bold text-white"><span className="text-emerald-400">♕</span> ChessForge</Link>
      </div>

      {open && <button type="button" aria-label="Menü schließen" onClick={() => setOpen(false)} className="fixed inset-0 z-40 bg-black/60 md:hidden" />}

      <aside className={(open ? "translate-x-0" : "-translate-x-full") + " fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-slate-800 bg-slate-950 px-4 py-5 transition-transform duration-200 md:translate-x-0"}>
        <div className="mb-7 flex items-center justify-between px-2">
          <Link href="/" onClick={() => setOpen(false)} className="flex items-center gap-2 text-xl font-bold text-white"><span className="text-emerald-400">♕</span> ChessForge</Link>
          <button type="button" onClick={() => setOpen(false)} aria-label="Menü schließen" className="rounded-lg px-3 py-1 text-2xl text-slate-400 hover:bg-slate-800 md:hidden">×</button>
        </div>
        <nav aria-label="Hauptnavigation" className="flex-1 space-y-5 overflow-y-auto">
          {sections.map((section) => (
            <div key={section.title ?? "main"}>
              {section.title && <h2 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{section.title}</h2>}
              <div className="space-y-1">
                {section.items.map((item) => {
                  const active = isActive(item);
                  const className = "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium " + (active ? "bg-slate-800 text-emerald-300 ring-1 ring-emerald-500/30" : item.soon ? "cursor-default text-slate-600" : "text-slate-300 transition hover:bg-slate-900 hover:text-white");
                  return item.href ? (
                    <Link key={item.label} href={item.href} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined} className={className}>
                      <span aria-hidden="true" className="w-5 text-center text-lg">{item.icon}</span><span>{item.label}</span>
                    </Link>
                  ) : (
                    <div key={item.label} aria-disabled="true" title="Kommt später" className={className}>
                      <span aria-hidden="true" className="w-5 text-center text-lg">{item.icon}</span><span className="flex-1">{item.label}</span><span className="text-[10px] uppercase tracking-wide text-slate-700">Später</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="border-t border-slate-800 pt-4">
          <div className="mb-2 rounded-xl px-3 py-2.5 text-slate-600" aria-disabled="true"><span className="mr-3 inline-block w-5 text-center">⚙</span>Einstellungen <span className="ml-2 text-[10px] uppercase tracking-wide">Später</span></div>
          <Link href="/profile" onClick={() => setOpen(false)} aria-current={isActive({ label: "Profil", icon: "◉", href: "/profile" }) ? "page" : undefined} className={"flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium " + (isActive({ label: "Profil", icon: "◉", href: "/profile" }) ? "bg-slate-800 text-emerald-300" : "text-slate-300 hover:bg-slate-900 hover:text-white")}>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">♟</span><span>Profil</span>
          </Link>
          <Link href="/bot" onClick={() => setOpen(false)} className="mt-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-400 hover:bg-slate-900 hover:text-white"><span className="w-5 text-center">🤖</span>Gegen Bot spielen</Link>
        </div>
      </aside>
    </>
  );
}
