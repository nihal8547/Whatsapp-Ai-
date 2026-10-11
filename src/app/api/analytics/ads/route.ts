import { requireTenant, errorResponse } from "@/lib/auth";
import { q } from "@/lib/db";
import { parseRange, getDateRanges } from "@/lib/analytics";
import { getTenantToday } from "@/lib/analytics-server";

export async function GET(req: Request) {
  try {
    const { tenantId } = await requireTenant(req);
    const sp = new URL(req.url).searchParams;
    const range = parseRange(sp.get("range"));
    if (!range) {
      return Response.json({ ok: false, error: "invalid_range" }, { status: 400 });
    }

    const todayStr = await getTenantToday(tenantId);
    const { current } = getDateRanges(todayStr, range);

    const ads = await q<{
      ad_key: string;
      ad_title: string;
      ad_body: string;
      leads: number;
      engaged: number;
      booked: number;
      completed: number;
      booking_rate_pct: number;
    }>(
      `SELECT COALESCE(NULLIF(ad_key, ''), 'Unknown ad') AS ad_key,
              COALESCE(NULLIF(ad_title, ''), 'Unknown ad') AS ad_title,
              COALESCE(ad_body, '') AS ad_body,
              leads::int AS leads,
              engaged::int AS engaged,
              booked::int AS booked,
              completed::int AS completed,
              COALESCE(booking_rate_pct, 0)::float AS booking_rate_pct
         FROM wa_v_ad_performance
        WHERE tenant_id = $1
          AND (last_lead_at AT TIME ZONE COALESCE((SELECT timezone FROM wa_bot_settings WHERE tenant_id = $1), 'Asia/Qatar'))::date >= $2::date
          AND (last_lead_at AT TIME ZONE COALESCE((SELECT timezone FROM wa_bot_settings WHERE tenant_id = $1), 'Asia/Qatar'))::date <= $3::date
        ORDER BY leads DESC, booking_rate_pct DESC`,
      [tenantId, current.start, current.end]
    );

    return Response.json({
      ok: true,
      range,
      ads: ads.map((a) => ({
        ad_key: a.ad_key,
        ad_title: a.ad_title,
        ad_body: a.ad_body,
        leads: Number(a.leads) || 0,
        engaged: Number(a.engaged) || 0,
        booked: Number(a.booked) || 0,
        completed: Number(a.completed) || 0,
        booking_rate_pct: Number(a.booking_rate_pct) || 0,
      })),
    });
  } catch (e) {
    return errorResponse(e);
  }
}
