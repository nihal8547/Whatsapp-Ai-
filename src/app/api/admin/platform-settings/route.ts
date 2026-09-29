import { requireSession, AuthError, errorResponse } from "@/lib/auth";
import { one } from "@/lib/db";

export async function GET() {
  try {
    const s = await requireSession();
    if (!s.superAdmin) throw new AuthError("forbidden", 403);

    const row = await one(
      `SELECT dashboard_url, alert_phone, alert_instance,
              webhook_secret_enforced, evolution_url, webhook_url
         FROM wa_platform_settings WHERE id = 1`
    );
    return Response.json({ ok: true, settings: row ?? {} });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PUT(req: Request) {
  try {
    const s = await requireSession();
    if (!s.superAdmin) throw new AuthError("forbidden", 403);

    const b = await req.json();

    // Never touch api_key_hash, webhook_secret, or evolution_url from this endpoint.
    const row = await one(
      `INSERT INTO wa_platform_settings (id, dashboard_url, alert_phone, alert_instance, webhook_secret_enforced)
       VALUES (1, $1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET
         dashboard_url            = EXCLUDED.dashboard_url,
         alert_phone              = EXCLUDED.alert_phone,
         alert_instance           = EXCLUDED.alert_instance,
         webhook_secret_enforced  = EXCLUDED.webhook_secret_enforced,
         updated_at               = now()
       RETURNING dashboard_url, alert_phone, alert_instance, webhook_secret_enforced`,
      [
        String(b.dashboard_url ?? "").trim().replace(/\/$/, ""),
        String(b.alert_phone ?? "").trim(),
        String(b.alert_instance ?? "").trim(),
        Boolean(b.webhook_secret_enforced),
      ]
    );
    return Response.json({ ok: true, settings: row });
  } catch (e) {
    return errorResponse(e);
  }
}
