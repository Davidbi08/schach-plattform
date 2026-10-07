import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type BanRequest = { action: "ban" | "unban"; userId: string; expiresAt?: string | null };

function isBanRequest(value: unknown): value is BanRequest {
  if (!value || typeof value !== "object") return false;
  const body = value as Record<string, unknown>;
  return (body.action === "ban" || body.action === "unban")
    && typeof body.userId === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.userId)
    && (body.expiresAt === undefined || body.expiresAt === null || typeof body.expiresAt === "string");
}

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Ungültige Anfragequelle." }, { status: 403 });
  }
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 10_000) {
    return NextResponse.json({ error: "Anfrage ist zu groß." }, { status: 413 });
  }

  let body: unknown;
  try {
    const rawBody = await request.text();
    if (rawBody.length > 10_000) {
      return NextResponse.json({ error: "Anfrage ist zu groß." }, { status: 413 });
    }
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Ungültige JSON-Anfrage." }, { status: 400 });
  }
  if (!isBanRequest(body)) {
    return NextResponse.json({ error: "Ungültige Sperranfrage." }, { status: 400 });
  }
  if (body.action === "ban" && body.expiresAt) {
    const expiration = Date.parse(body.expiresAt);
    if (!Number.isFinite(expiration) || expiration <= Date.now()) {
      return NextResponse.json({ error: "Das Ablaufdatum muss in der Zukunft liegen." }, { status: 400 });
    }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !publishableKey) {
    return NextResponse.json({ error: "Supabase ist nicht vollständig konfiguriert." }, { status: 503 });
  }

  const cookieStore = await cookies();
  const sessionClient = createServerClient(supabaseUrl, publishableKey, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
      },
    },
  });
  const { data: { user }, error: authError } = await sessionClient.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Anmeldung erforderlich." }, { status: 401 });
  }

  const { data: roles, error: roleError } = await sessionClient.rpc("get_my_admin_access");
  if (roleError) {
    console.error("Adminrolle konnte im Kontosperr-Endpoint nicht geprüft werden:", roleError);
    return NextResponse.json({ error: "Adminberechtigung konnte nicht geprüft werden." }, { status: 403 });
  }
  const actorRole = (roles ?? [])[0]?.role as string | undefined;
  if (!["owner", "admin", "moderator"].includes(actorRole ?? "")) {
    return NextResponse.json({ error: "Keine Admin-Berechtigung." }, { status: 403 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    console.error("SUPABASE_SERVICE_ROLE_KEY ist auf dem Server nicht konfiguriert.");
    return NextResponse.json({ error: "Kontosperren sind serverseitig noch nicht konfiguriert." }, { status: 503 });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: targetRole, error: targetError } = await adminClient
    .from("site_admins")
    .select("role")
    .eq("user_id", body.userId)
    .maybeSingle();
  if (targetError) {
    console.error("Zielkonto-Rolle konnte nicht geprüft werden:", targetError);
    return NextResponse.json({ error: "Zielkonto konnte nicht geprüft werden." }, { status: 500 });
  }
  if (targetRole?.role === "owner" || (targetRole?.role === "admin" && actorRole !== "owner")) {
    return NextResponse.json({ error: "Dieses Admin-Konto kann hier nicht gesperrt werden." }, { status: 403 });
  }
  if (body.userId === user.id) {
    return NextResponse.json({ error: "Du kannst dein eigenes Konto nicht sperren." }, { status: 400 });
  }

  const banDuration = body.action === "unban"
    ? "none"
    : body.expiresAt
      ? `${Math.ceil((Date.parse(body.expiresAt) - Date.now()) / 1000)}s`
      : "876000h";
  const { error: updateError } = await adminClient.auth.admin.updateUserById(body.userId, {
    ban_duration: banDuration,
  });
  if (updateError) {
    console.error("Supabase Auth konnte die Kontosperre nicht aktualisieren:", updateError);
    return NextResponse.json({ error: "Supabase Auth konnte die Kontosperre nicht aktualisieren." }, { status: 502 });
  }

  return NextResponse.json({ success: true });
}
