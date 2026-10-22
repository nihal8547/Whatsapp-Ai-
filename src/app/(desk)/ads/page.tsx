import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { q } from "@/lib/db";
import AdsClient from "./ads-client";

export const dynamic = "force-dynamic";

export default async function AdsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.tenantId && session.superAdmin) redirect("/admin");
  if (!session.tenantId) redirect("/login");

  const tenantId = session.tenantId;

  const [ads, playbooks, media] = await Promise.all([
    // Grouped ad performance
    q(
      `WITH grouped_ads AS (
         SELECT
           COALESCE(c.source_id, c.ad_title)          AS group_key,
           MAX(c.source_id)                            AS source_id,
           MAX(c.ad_title)                             AS ad_title,
           MAX(c.ad_body)                              AS ad_body,
           COUNT(*)::int                               AS clicks,
           COUNT(DISTINCT c.phone)::int                AS people,
           to_char(MAX(c.created_at), 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS last_seen
         FROM wa_ad_clicks c
        WHERE c.tenant_id = $1
        GROUP BY COALESCE(c.source_id, c.ad_title)
       )
       SELECT
         g.*,
         COALESCE(p.booked, 0)::int    AS bookings,
         COALESCE(p.completed, 0)::int AS completed,
         pb.id                         AS playbook_id,
         pb.name                       AS playbook_name
       FROM grouped_ads g
       LEFT JOIN wa_v_ad_performance p
              ON p.tenant_id = $1
             AND p.ad_key = g.group_key
       LEFT JOIN LATERAL (
         SELECT pb.id, pb.name
           FROM wa_ad_playbooks pb
          WHERE pb.tenant_id = $1
            AND pb.active = true
            AND (
              (pb.match_type = 'source_id'       AND g.source_id IS NOT NULL AND pb.match_value = g.source_id)
              OR (pb.match_type = 'title_contains' AND g.ad_title ILIKE '%' || pb.match_value || '%')
              OR pb.match_type = 'any'
            )
          ORDER BY
            CASE pb.match_type
              WHEN 'source_id' THEN 1
              WHEN 'title_contains' THEN 2
              ELSE 3
            END,
            pb.sort_order ASC,
            pb.id ASC
          LIMIT 1
       ) pb ON true
       ORDER BY g.last_seen DESC`,
      [tenantId]
    ),
    // All playbooks for this tenant
    q(
      `SELECT pb.id, pb.name, pb.match_type, pb.match_value, pb.instructions,
              pb.media_id, pb.active, pb.sort_order,
              m.title AS media_title, m.public_token AS media_token
         FROM wa_ad_playbooks pb
         LEFT JOIN wa_media m ON m.id = pb.media_id AND m.tenant_id = pb.tenant_id
        WHERE pb.tenant_id = $1
        ORDER BY pb.sort_order ASC, pb.id ASC`,
      [tenantId]
    ),
    // Active media items available for the picker
    q(
      `SELECT id, title, category, public_token, mime_type
         FROM wa_media
        WHERE tenant_id = $1 AND active = true
        ORDER BY title ASC`,
      [tenantId]
    ),
  ]);

  const isOwner = session.role === "owner" || session.superAdmin;

  return (
    <AdsClient
      initialAds={ads}
      initialPlaybooks={playbooks}
      mediaItems={media}
      isOwner={isOwner}
      role={session.role}
    />
  );
}
