import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { q, one } from "@/lib/db";
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
      `SELECT
         COALESCE(c.source_id, c.ad_title)          AS group_key,
         MAX(c.source_id)                            AS source_id,
         MAX(c.ad_title)                             AS ad_title,
         MAX(c.ad_body)                              AS ad_body,
         COUNT(*)::int                               AS clicks,
         COUNT(DISTINCT c.phone)::int                AS people,
         to_char(MAX(c.created_at), 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS last_seen,
         COALESCE(MAX(p.bookings_created), 0)::int   AS bookings,
         COALESCE(MAX(p.bookings_completed), 0)::int AS completed,
         MAX(pb.id)                                  AS playbook_id,
         MAX(pb.name)                                AS playbook_name
       FROM wa_ad_clicks c
       LEFT JOIN wa_v_ad_performance p
              ON p.tenant_id = c.tenant_id
             AND COALESCE(p.source_id, p.ad_title) = COALESCE(c.source_id, c.ad_title)
       LEFT JOIN wa_ad_playbooks pb
              ON pb.tenant_id = c.tenant_id
             AND pb.active = true
             AND (
               (pb.match_type = 'source_id' AND c.source_id IS NOT NULL AND pb.match_value = c.source_id)
               OR (pb.match_type = 'title_contains' AND c.ad_title ILIKE '%' || pb.match_value || '%')
               OR pb.match_type = 'any'
             )
      WHERE c.tenant_id = $1
      GROUP BY COALESCE(c.source_id, c.ad_title)
      ORDER BY MAX(c.created_at) DESC`,
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
