import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { one, q } from "@/lib/db";
import TenantDetail from "@/app/admin/tenants/[id]/detail";

export const dynamic = "force-dynamic";

export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.superAdmin) redirect("/desk");

  const { id } = await params;

  const tenant = await one(
    `SELECT t.id, t.name, t.slug, t.status,
            to_char(t.trial_ends_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS trial_ends_at,
            to_char(t.created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
            t.business_type, t.admin_notes,
            COALESCE(p.name,'No plan') AS plan, p.id AS plan_id, p.price_qar,
            bs.timezone, bs.admin_phone,
            i.instance_name, COALESCE(i.status,'none') AS wa_status
       FROM wa_tenants t
       LEFT JOIN wa_plans p ON p.id = t.plan_id
       LEFT JOIN wa_bot_settings bs ON bs.tenant_id = t.id
       LEFT JOIN wa_instances i ON i.tenant_id = t.id
      WHERE t.id = $1::int`,
    [id]
  );
  if (!tenant) notFound();

  const [usage, counts, team, plans] = await Promise.all([
    q(
      `SELECT to_char(day,'YYYY-MM-DD') AS day, messages_in AS msg_received, ai_replies
         FROM wa_usage_daily WHERE tenant_id = $1 ORDER BY day DESC LIMIT 30`,
      [id]
    ),
    one(
      `SELECT
         (SELECT count(*) FROM wa_services     WHERE tenant_id = $1 AND active)          AS services,
         (SELECT count(*) FROM wa_appointments WHERE tenant_id = $1 AND status='confirmed'
            AND start_time > now())                                                        AS upcoming,
         (SELECT count(*) FROM wa_tenant_users WHERE tenant_id = $1)                      AS team,
         (SELECT count(*) FROM wa_contacts     WHERE tenant_id = $1)                      AS contacts`,
      [id]
    ),
    q(
      `SELECT email, role FROM wa_tenant_users WHERE tenant_id = $1 ORDER BY role, email`,
      [id]
    ),
    q(`SELECT id, code, name FROM wa_plans WHERE active ORDER BY id`),
  ]);

  return (
    <TenantDetail
      tenant={tenant}
      usage={usage}
      counts={counts ?? {}}
      team={team}
      plans={plans}
    />
  );
}
