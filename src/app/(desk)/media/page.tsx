import { requireTenant } from "@/lib/auth";
import { q, one } from "@/lib/db";
import MediaEditor from "@/app/(desk)/media/editor";

export const dynamic = "force-dynamic";

export default async function MediaPage() {
  const { tenantId, session } = await requireTenant();

  const ps = await one<{ dashboard_url: string }>(
    `SELECT dashboard_url FROM wa_platform_settings WHERE id = 1`
  );
  const baseUrl = (ps?.dashboard_url ?? "").replace(/\/$/, "");

  const rows = await q(
    `SELECT id, title, category, keywords, COALESCE(caption,'') AS caption,
            service_id, mime_type, active, created_at, public_token
       FROM wa_media
      WHERE tenant_id = $1
      ORDER BY active DESC, created_at DESC`,
    [tenantId]
  );

  const media = rows.map((r) => ({
    ...r,
    url: `${baseUrl}/media/${r.public_token}`,
  }));

  const services = await q(
    `SELECT id, name FROM wa_services WHERE tenant_id = $1 AND active ORDER BY name`,
    [tenantId]
  );

  return (
    <MediaEditor
      initialMedia={media}
      services={services}
      readOnly={session.role === "staff" && !session.superAdmin}
    />
  );
}
