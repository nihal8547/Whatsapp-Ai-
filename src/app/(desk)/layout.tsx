import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { one } from "@/lib/db";
import Sidebar from "@/components/sidebar";

export default async function DeskLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.tenantId && session.superAdmin) redirect("/admin");
  if (!session.tenantId) redirect("/login");

  const tenant = await one(
    `SELECT t.id, t.name, t.status, t.trial_ends_at,
            COALESCE(p.name, 'No plan') AS plan_name,
            p.monthly_reply_limit,
            COALESCE((SELECT SUM(ai_replies) FROM wa_usage_daily u
                       WHERE u.tenant_id = t.id AND u.day >= date_trunc('month', now())::date), 0) AS replies_used,
            (SELECT status FROM wa_instances i WHERE i.tenant_id = t.id) AS wa_status
       FROM wa_tenants t LEFT JOIN wa_plans p ON p.id = t.plan_id
      WHERE t.id = $1`,
    [session.tenantId]
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      <Sidebar
        session={{ name: session.name, email: session.email, superAdmin: session.superAdmin, role: session.role }}
        tenant={{
          name: tenant?.name ?? "Workspace",
          status: tenant?.status ?? "trial",
          plan: tenant?.plan_name ?? "",
          waStatus: tenant?.wa_status ?? null,
          repliesUsed: Number(tenant?.replies_used ?? 0),
          replyLimit: tenant?.monthly_reply_limit ? Number(tenant.monthly_reply_limit) : null,
          trialEndsAt: tenant?.trial_ends_at ? String(tenant.trial_ends_at) : null,
        }}
      />
      <main className="min-w-0">{children}</main>
    </div>
  );
}
