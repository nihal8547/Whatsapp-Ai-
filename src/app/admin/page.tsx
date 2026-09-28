import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { q } from "@/lib/db";
import AdminTable from "./table";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.superAdmin) redirect("/desk");

  const tenants = await q(
    `SELECT t.id, t.name, t.slug, t.status, t.trial_ends_at, t.created_at,
            COALESCE(p.name,'No plan') AS plan, p.id AS plan_id,
            COALESCE(i.status,'none') AS wa_status,
            COALESCE((SELECT SUM(ai_replies) FROM wa_usage_daily u
                       WHERE u.tenant_id = t.id AND u.day >= date_trunc('month', now())::date),0) AS replies_month,
            (SELECT count(*) FROM wa_contacts c WHERE c.tenant_id = t.id) AS contacts,
            (SELECT count(*) FROM wa_appointments a
              WHERE a.tenant_id = t.id AND a.status = 'confirmed') AS bookings
       FROM wa_tenants t
       LEFT JOIN wa_plans p ON p.id = t.plan_id
       LEFT JOIN wa_instances i ON i.tenant_id = t.id
      ORDER BY t.id`
  );
  const plans = await q(
    `SELECT id, code, name, price_qar, monthly_reply_limit FROM wa_plans WHERE active ORDER BY id`
  );

  return <AdminTable initialTenants={tenants} plans={plans} hasOwnTenant={!!session.tenantId} />;
}
