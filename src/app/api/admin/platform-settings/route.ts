import { requireSuperAdmin, errorResponse } from "@/lib/auth";
import { one } from "@/lib/db";

export async function GET() {
  try {
    const s = await requireSuperAdmin();

    const row = await one(
      `SELECT dashboard_url, alert_phone, alert_instance,
              webhook_secret_enforced, evolution_url, webhook_url,
              COALESCE(broadcast_daily_max, 200) AS broadcast_daily_max,
              COALESCE(proactive_enabled, true) AS proactive_enabled
         FROM wa_platform_settings WHERE id = 1`
    );
    return Response.json({ ok: true, settings: row ?? {} });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PUT(req: Request) {
  try {
    const s = await requireSuperAdmin();

    const b = await req.json();

    const proactiveEnabled = b.proactive_enabled !== undefined ? Boolean(b.proactive_enabled) : true;

    // Never touch api_key_hash, webhook_secret, or evolution_url from this endpoint.
    const row = await one(
      `INSERT INTO wa_platform_settings (id, dashboard_url, alert_phone, alert_instance, webhook_secret_enforced, broadcast_daily_max, proactive_enabled)
       VALUES (1, $1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         dashboard_url            = EXCLUDED.dashboard_url,
         alert_phone              = EXCLUDED.alert_phone,
         alert_instance           = EXCLUDED.alert_instance,
         webhook_secret_enforced  = EXCLUDED.webhook_secret_enforced,
         broadcast_daily_max      = EXCLUDED.broadcast_daily_max,
         proactive_enabled        = EXCLUDED.proactive_enabled
       RETURNING dashboard_url, alert_phone, alert_instance, webhook_secret_enforced, broadcast_daily_max, proactive_enabled`,
      [
        String(b.dashboard_url ?? "").trim().replace(/\/$/, ""),
        String(b.alert_phone ?? "").trim(),
        String(b.alert_instance ?? "").trim(),
        Boolean(b.webhook_secret_enforced),
        b.broadcast_daily_max ? Math.max(1, Number(b.broadcast_daily_max)) : 200,
        proactiveEnabled,
      ]
    );
    return Response.json({ ok: true, settings: row });
  } catch (e) {
    return errorResponse(e);
  }
}
