import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { q, one } from "@/lib/db";
import AdminShell from "@/app/admin/shell";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.superAdmin) redirect("/desk");

  const [tenants, plans, platformSettings, overview, platform30Days] = await Promise.all([
    q(
      `SELECT t.id, t.name, t.slug, t.status, t.trial_ends_at, t.created_at,
              t.business_type,
              COALESCE(p.name,'No plan') AS plan, p.id AS plan_id,
              COALESCE(i.status,'none') AS wa_status,
              COALESCE((SELECT SUM(ai_replies) FROM wa_usage_daily u
                         WHERE u.tenant_id = t.id AND u.day >= date_trunc('month', now())::date),0) AS replies_month
         FROM wa_tenants t
         LEFT JOIN wa_plans p ON p.id = t.plan_id
         LEFT JOIN wa_instances i ON i.tenant_id = t.id
        ORDER BY t.id`
    ),
    q(`SELECT id, code, name, price_qar, monthly_reply_limit, active FROM wa_plans ORDER BY active DESC, id`),
    one(
      `SELECT dashboard_url, COALESCE(alert_phone,'') AS alert_phone,
              COALESCE(alert_instance,'') AS alert_instance,
              COALESCE(webhook_secret_enforced, false) AS webhook_secret_enforced,
              COALESCE(evolution_url,'') AS evolution_url,
              COALESCE(webhook_url,'') AS webhook_url,
              COALESCE(broadcast_daily_max, 200) AS broadcast_daily_max
         FROM wa_platform_settings WHERE id = 1`
    ),
    one(`
      SELECT
        (SELECT count(*) FROM wa_tenants)                             AS total_workspaces,
        (SELECT count(*) FROM wa_tenants WHERE status = 'trial')      AS trial_count,
        (SELECT count(*) FROM wa_tenants WHERE status = 'active')     AS active_count,
        (SELECT count(*) FROM wa_tenants WHERE status = 'suspended')  AS suspended_count,
        (SELECT count(*) FROM wa_tenants WHERE status = 'cancelled')  AS cancelled_count,
        (SELECT COALESCE(SUM(messages_in),0) FROM wa_usage_daily WHERE day = CURRENT_DATE) AS msgs_today,
        (SELECT COALESCE(SUM(ai_replies),0) FROM wa_usage_daily
          WHERE day >= date_trunc('month', now())::date)               AS ai_replies_month,
        (SELECT COALESCE(SUM(p.price_qar),0)
           FROM wa_tenants t JOIN wa_plans p ON p.id = t.plan_id
          WHERE t.status = 'active')                                   AS mrr_qar
    `),
    one<{
      messages_in: number;
      bot_replies: number;
      new_contacts: number;
      bookings_created: number;
      ad_leads: number;
    }>(`
      SELECT
        COALESCE(SUM(messages_in), 0)::int AS messages_in,
        COALESCE(SUM(bot_replies), 0)::int AS bot_replies,
        COALESCE(SUM(new_contacts), 0)::int AS new_contacts,
        COALESCE(SUM(bookings_created), 0)::int AS bookings_created,
        COALESCE(SUM(ad_leads), 0)::int AS ad_leads
      FROM wa_v_daily_overview
      WHERE day >= (CURRENT_DATE - 29)
    `),
  ]);

  return (
    <AdminShell
      initialTenants={tenants}
      allPlans={plans}
      hasOwnTenant={!!session.tenantId}
      platformSettings={platformSettings ?? {
        dashboard_url: "", alert_phone: "", alert_instance: "",
        webhook_secret_enforced: false, evolution_url: "", webhook_url: "",
      }}
      overview={overview ?? {}}
      platform30Days={platform30Days ?? {
        messages_in: 0, bot_replies: 0, new_contacts: 0, bookings_created: 0, ad_leads: 0,
      }}
    />
  );
}
