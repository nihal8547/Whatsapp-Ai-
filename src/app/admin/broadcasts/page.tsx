import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { q, one } from "@/lib/db";
import BroadcastsManager from "@/app/admin/broadcasts/broadcasts-client";

export const dynamic = "force-dynamic";

export default async function AdminBroadcastsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.superAdmin) redirect("/desk");

  const [tenants, platformSettings] = await Promise.all([
    q<{
      id: number;
      name: string;
      slug: string;
      status: string;
      plan: string;
      broadcasts_enabled: boolean;
      broadcast_daily_cap: number;
      active_broadcasts: number;
      sent_broadcasts: number;
    }>(`
      SELECT t.id, t.name, t.slug, t.status,
             COALESCE(p.name, 'No plan') AS plan,
             COALESCE((bs.broadcast_settings->>'enabled')::boolean, true) AS broadcasts_enabled,
             COALESCE((bs.broadcast_settings->>'daily_cap')::int, 100) AS broadcast_daily_cap,
             (SELECT count(*) FROM wa_broadcasts b WHERE b.tenant_id = t.id AND b.status IN ('running', 'scheduled'))::int AS active_broadcasts,
             (SELECT count(*) FROM wa_broadcasts b WHERE b.tenant_id = t.id AND b.status = 'completed')::int AS sent_broadcasts
        FROM wa_tenants t
        LEFT JOIN wa_plans p ON p.id = t.plan_id
        LEFT JOIN wa_bot_settings bs ON bs.tenant_id = t.id
       ORDER BY t.id
    `),
    one<{
      broadcast_daily_max: number;
      proactive_enabled: boolean;
    }>(`
      SELECT COALESCE(broadcast_daily_max, 200) AS broadcast_daily_max,
             COALESCE(proactive_enabled, true) AS proactive_enabled
        FROM wa_platform_settings WHERE id = 1
    `),
  ]);

  return (
    <BroadcastsManager
      initialTenants={tenants}
      platformSettings={platformSettings ?? { broadcast_daily_max: 200, proactive_enabled: true }}
    />
  );
}
