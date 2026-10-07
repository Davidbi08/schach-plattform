This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Supabase-Datenbank

Community, Profilbearbeitung, Avatare und Ranglisten benötigen die SQL-Migrationen in `supabase/migrations`. Verknüpfe das Supabase-Projekt mit der CLI (`supabase link --project-ref <project-ref>`) und führe `supabase db push` aus. Alternativ können alle noch nicht angewendeten Migrationsdateien der Reihe nach im Supabase SQL Editor ausgeführt werden. Ohne diese Migrationen funktionieren Suche, Chat, Profiländerungen und Ranglisten nicht.

## Adminbereich und Moderation

Die Adminoberfläche ist unter `/admin` verfügbar, nachdem `20261007000008_admin_moderation.sql` angewendet und ein Konto in `public.site_admins` eingetragen wurde. Die erste Owner-Rolle muss direkt im Supabase SQL Editor vergeben werden:

```sql
insert into public.site_admins (user_id, role)
select p.id, 'owner'
from public.profiles p
where p.username = 'DEIN_BENUTZERNAME'
on conflict (user_id) do update set role = 'owner';

select p.username, a.role
from public.site_admins a
join public.profiles p on p.id = a.user_id
where a.role = 'owner';
```

Ersetze `DEIN_BENUTZERNAME` durch den exakten Profilnamen und prüfe, dass die zweite Abfrage dein Konto als `owner` ausgibt. Der Adminbereich unterstützt Kontosperren, Adminmitteilungen, die Prüfung ausdrücklich gemeldeter Chatnachrichten, das Entfernen von Profilbiografie/-bild sowie ein Maßnahmenprotokoll. Private Nachrichten werden Moderatoren nicht pauschal angezeigt; nur eine vom Empfänger gemeldete Nachricht erscheint in der Moderationsansicht.

Für Kontosperren muss zusätzlich `SUPABASE_SERVICE_ROLE_KEY` als **serverseitige, geheime** Umgebungsvariable in Vercel gesetzt und die Anwendung neu bereitgestellt werden. Der Schlüssel darf niemals `NEXT_PUBLIC_` heißen oder im Browser verfügbar sein. Ohne diese Variable verweigert der Server die Auth-Sperre und zeigt einen Fehler an; die Datenbank-Sperre allein blockiert zwar Community-Schreibzugriffe, sperrt aber keine bestehende Auth-Sitzung.

Supportanfragen unter `/support` verwenden zusätzlich die Migration `20261007000009_private_support_inbox.sql`. Nutzer sehen nur ihre eigenen Anfragen und Antworten; im Adminbereich sind Supportinhalte ausschließlich für Rollen `owner` und `admin` lesbar (nicht für Moderatoren oder andere Nutzer). Nachrichten und Statusänderungen laufen über zugriffsgeschützte RPCs und Adminantworten/-statusänderungen werden protokolliert.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
