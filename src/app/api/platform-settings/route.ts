import { requireSession, errorResponse } from "@/lib/auth";
import { AuthError } from "@/lib/auth";
import { one } from "@/lib/db";

function requireSuperAdmin(session: { superAdmin: boolean }) {
  if (!session.superAdmin) throw new AuthError("forbidden", 403);
}

export async function GET(req: Request) {
  try {
    const session = await requireSession();
    requireSuperAdmin(session);

    const row = await one<{ dashboard_url: string }>(
      `SELECT dashboard_url FROM wa_platform_settings WHERE id = 1`
    );
    return Response.json({ ok: true, dashboard_url: row?.dashboard_url ?? "" });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PUT(req: Request) {
  try {
    const session = await requireSession();
    requireSuperAdmin(session);

    const b = await req.json();
    const url = String(b.dashboard_url || "").trim().replace(/\/$/, "");

    await one(
      `INSERT INTO wa_platform_settings (id, dashboard_url) VALUES (1, $1)
       ON CONFLICT (id) DO UPDATE SET dashboard_url = EXCLUDED.dashboard_url, updated_at = now()`,
      [url]
    );

    return Response.json({ ok: true, dashboard_url: url });
  } catch (e) {
    return errorResponse(e);
  }
}
