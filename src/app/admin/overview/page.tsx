import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { one } from "@/lib/db";
import { PageHead, Panel } from "@/components/ui";

export const dynamic = "force-dynamic";

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-panel border border-line rounded-lg p-4">
      <p className="text-3xl font-semibold tabular">{value}</p>
      <p className="text-sm mt-1 text-ink-soft">{label}</p>
      {sub && <p className="text-xs text-ink-faint mt-0.5">{sub}</p>}
    </div>
  );
}

export default async function AdminOverviewPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.superAdmin) redirect("/desk");

  const [overview, platform30Days] = await Promise.all([
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

  const ov: any = overview ?? {};
  const p30 = platform30Days ?? { messages_in: 0, bot_replies: 0, new_contacts: 0, bookings_created: 0, ad_leads: 0 };

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      <div>
        <PageHead title="Platform Overview & KPIs" lead="System performance, MRR, and platform metrics across all workspaces." />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <Stat
            label="Total Workspaces"
            value={ov.total_workspaces ?? 0}
            sub={`${ov.active_count ?? 0} active · ${ov.trial_count ?? 0} trial · ${ov.suspended_count ?? 0} suspended`}
          />
          <Stat label="Messages Today" value={ov.msgs_today ?? 0} />
          <Stat label="AI Replies This Month" value={ov.ai_replies_month ?? 0} />
          <Stat label="Est. MRR (QAR)" value={Number(ov.mrr_qar ?? 0).toFixed(0)} />
        </div>

        <Panel>
          <h2 className="text-sm font-semibold text-ink-soft uppercase tracking-wider mb-4">
            Platform Activity (Last 30 Days)
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div className="p-3 bg-canvas rounded-lg border border-line">
              <p className="text-xs text-ink-soft">Messages Received</p>
              <p className="text-2xl font-semibold tabular mt-1">{p30.messages_in}</p>
            </div>
            <div className="p-3 bg-canvas rounded-lg border border-line">
              <p className="text-xs text-ink-soft">Bot Replies</p>
              <p className="text-2xl font-semibold tabular mt-1 text-pine">{p30.bot_replies}</p>
            </div>
            <div className="p-3 bg-canvas rounded-lg border border-line">
              <p className="text-xs text-ink-soft">New Contacts</p>
              <p className="text-2xl font-semibold tabular mt-1">{p30.new_contacts}</p>
            </div>
            <div className="p-3 bg-canvas rounded-lg border border-line">
              <p className="text-xs text-ink-soft">Bookings Created</p>
              <p className="text-2xl font-semibold tabular mt-1">{p30.bookings_created}</p>
            </div>
            <div className="p-3 bg-canvas rounded-lg border border-line">
              <p className="text-xs text-ink-soft">Ad Leads Captured</p>
              <p className="text-2xl font-semibold tabular mt-1">{p30.ad_leads}</p>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
