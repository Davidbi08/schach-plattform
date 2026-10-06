"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type MenuItem = { label: string; mark: string; href: string };
const sections: { title: string; items: MenuItem[] }[] = [
  { title: "Spielen", items: [
    { label: "Online spielen", mark: "◎", href: "/online" },
    { label: "Gegen Bot", mark: "♟", href: "/bot" },
    { label: "Freie Partie", mark: "＋", href: "/play" },
  ] },
  { title: "Deine Partien", items: [
    { label: "Partieverlauf", mark: "↗", href: "/partien" },
    { label: "Analyse", mark: "⌕", href: "/analyse" },
  ] },
];

export default function AppNavigation() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  if (pathname.startsWith("/login") || pathname.startsWith("/auth") || pathname.startsWith("/forgot-password")) return null;

  function isActive(item: MenuItem) {
    return pathname === item.href || pathname.startsWith(item.href + "/");
  }

  return <>
    <div className="fixed inset-x-0 top-0 z-30 flex h-14 items-center border-b border-slate-800 bg-slate-950/95 px-4 backdrop-blur md:hidden">
      <button type="button" onClick={() => setOpen(true)} aria-label="Menü öffnen" aria-expanded={open} className="flex h-10 w-10 items-center justify-center rounded-lg text-2xl text-slate-300 hover:bg-slate-800">☰</button>
      <Link href="/" aria-label="Startseite" className="ml-3 flex items-center gap-2 font-semibold tracking-tight text-slate-100"><span className="text-emerald-400">♟</span> Schach</Link>
    </div>
    {open && <button type="button" aria-label="Menü schließen" onClick={() => setOpen(false)} className="fixed inset-0 z-40 bg-black/60 md:hidden" />}
    <aside className={(open ? "translate-x-0" : "-translate-x-full") + " fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-800 bg-slate-950 px-4 py-5 transition-transform duration-200 md:translate-x-0"}>
      <div className="mb-10 flex items-center gap-3 px-2 py-1">
        <Link href="/" onClick={() => setOpen(false)} aria-label="Schach Startseite" className="flex min-w-0 items-center gap-3 text-base font-semibold tracking-tight text-slate-100">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-400/10 text-lg text-emerald-300">♟</span>
          <span>Schach<span className="font-normal text-slate-400">plattform</span></span>
        </Link>
        <button type="button" onClick={() => setOpen(false)} aria-label="Menü schließen" className="ml-auto rounded-lg px-2 py-1 text-xl text-slate-500 hover:bg-slate-800 md:hidden">×</button>
      </div>
      <nav aria-label="Hauptnavigation" className="flex-1 space-y-8">
        <Link href="/" onClick={() => setOpen(false)} aria-current={pathname === "/" ? "page" : undefined} className={"flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition " + (pathname === "/" ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-900 hover:text-white")}>
          <span aria-hidden="true" className="w-5 text-center text-base">⌂</span>Übersicht
        </Link>
        {sections.map(section => <div key={section.title}>
          <h2 className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">{section.title}</h2>
          <div className="space-y-1">
            {section.items.map(item => {
              const active = isActive(item);
              return <Link key={item.href} href={item.href} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined} className={"flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition " + (active ? "bg-slate-800 text-emerald-300" : "text-slate-400 hover:bg-slate-900 hover:text-white")}>
                <span aria-hidden="true" className="w-5 text-center text-base">{item.mark}</span>{item.label}
              </Link>;
            })}
          </div>
        </div>)}
      </nav>
      <div className="border-t border-slate-800 pt-4">
        <Link href="/profile" onClick={() => setOpen(false)} aria-current={pathname.startsWith("/profile") ? "page" : undefined} className={"flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition " + (pathname.startsWith("/profile") ? "bg-slate-800 text-emerald-300" : "text-slate-400 hover:bg-slate-900 hover:text-white")}>
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-xs text-slate-300">♟</span>Profil
        </Link>
      </div>
    </aside>
  </>;
}