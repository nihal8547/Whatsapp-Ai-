import { requireSession, AuthError, errorResponse } from "@/lib/auth";
import { one } from "@/lib/db";

export async function GET() {
  try {
    const s = await requireSession();
    if (!s.superAdmin) throw new AuthError("forbidden", 403);

    const row = await one(`
      SELECT
        (SELECT count(*) FROM wa_tenants)                              AS total_workspaces,
        (SELECT count(*) FROM wa_tenants WHERE status = 'trial')       AS trial_count,
        (SELECT count(*) FROM wa_tenants WHERE status = 'active')      AS active_count,
        (SELECT count(*) FROM wa_tenants WHERE status = 'suspended')   AS suspended_count,
        (SELECT count(*) FROM wa_tenants WHERE status = 'cancelled')   AS cancelled_count,
        (SELECT COALESCE(SUM(msg_received),0) FROM wa_usage_daily
          WHERE day = CURRENT_DATE)                                     AS msgs_today,
        (SELECT COALESCE(SUM(ai_replies),0) FROM wa_usage_daily
          WHERE day >= date_trunc('month', now())::date)                AS ai_replies_month,
        (SELECT COALESCE(SUM(p.price_qar),0)
           FROM wa_tenants t
           JOIN wa_plans p ON p.id = t.plan_id
          WHERE t.status = 'active')                                    AS mrr_qar
    `);
    return Response.json({ ok: true, stats: row });
  } catch (e) {
    return errorResponse(e);
  }
}
