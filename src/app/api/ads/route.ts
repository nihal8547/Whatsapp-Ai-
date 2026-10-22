import { requireTenant, errorResponse } from "@/lib/auth";
import { q } from "@/lib/db";

/** GET /api/ads — grouped ad performance for the tenant */
export async function GET(req: Request) {
  try {
    const { tenantId } = await requireTenant(req);

    // Group clicks by COALESCE(source_id, ad_title) and join with performance view
    const ads = await q(
      `SELECT
         COALESCE(c.source_id, c.ad_title)          AS group_key,
         MAX(c.source_id)                            AS source_id,
         MAX(c.ad_title)                             AS ad_title,
         MAX(c.ad_body)                              AS ad_body,
         COUNT(*)::int                               AS clicks,
         COUNT(DISTINCT c.phone)::int                AS people,
         MAX(to_char(c.created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')) AS last_seen,
         COALESCE(SUM(p.bookings_created), 0)::int   AS bookings,
         COALESCE(SUM(p.bookings_completed), 0)::int AS completed,
         pb.id                                       AS playbook_id,
         pb.name                                     AS playbook_name
       FROM wa_ad_clicks c
       LEFT JOIN wa_v_ad_performance p
              ON p.tenant_id = c.tenant_id
             AND COALESCE(p.source_id, p.ad_title) = COALESCE(c.source_id, c.ad_title)
       LEFT JOIN wa_ad_playbooks pb
              ON pb.tenant_id = c.tenant_id
             AND pb.active = true
             AND (
               (pb.match_type = 'source_id'       AND c.source_id IS NOT NULL AND pb.match_value = c.source_id)
               OR (pb.match_type = 'title_contains' AND c.ad_title ILIKE '%' || pb.match_value || '%')
               OR pb.match_type = 'any'
             )
      WHERE c.tenant_id = $1
      GROUP BY COALESCE(c.source_id, c.ad_title), pb.id, pb.name
      ORDER BY MAX(c.created_at) DESC`,
      [tenantId]
    );

    return Response.json({ ok: true, ads });
  } catch (e) {
    return errorResponse(e);
  }
}
