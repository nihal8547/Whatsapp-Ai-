import Link from "next/link";
import { requireTenant } from "@/lib/auth";
import { q, one } from "@/lib/db";
import { getTenantConfig } from "@/lib/packs";
import { Panel, Tag } from "@/components/ui";
import { fullStamp, timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DeskPage() {
  const { tenantId, session } = await requireTenant();
  const config = await getTenantConfig(tenantId);
  const { modules, labels } = config;

  const tenantRow = await one(
    `SELECT business_metadata FROM wa_tenants WHERE id = $1`,
    [tenantId]
  );
  const onboarding = tenantRow?.business_metadata?.onboarding;
  const showOnboardingBanner = !onboarding || !onboarding.completed;

  const settings = await one(
    `SELECT timezone, business_name, bot_enabled FROM wa_bot_settings WHERE tenant_id = $1`,
    [tenantId]
  );
  const tz = settings?.timezone || "Asia/Qatar";

  const stats = await one(
    `SELECT
       (SELECT sum(ai_replies) FROM wa_usage_daily u
         WHERE u.tenant_id = $1 AND date_trunc('month', u.day) = date_trunc('month', CURRENT_DATE)) AS ai_replies_month,
       (SELECT p.name FROM wa_tenants t LEFT JOIN wa_plans p ON t.plan_id = p.id WHERE t.id = $1) AS plan_name,
       (SELECT p.monthly_reply_limit FROM wa_tenants t LEFT JOIN wa_plans p ON t.plan_id = p.id WHERE t.id = $1) AS plan_limit,
       (SELECT count(*) FROM wa_messages m
         WHERE m.tenant_id = $1 AND m.direction = 'in'
           AND m.created_at >= date_trunc('day', now() AT TIME ZONE $2) AT TIME ZONE $2) AS msgs_today,
       (SELECT count(DISTINCT phone) FROM wa_messages m
         WHERE m.tenant_id = $1 AND m.created_at > now() - interval '7 days') AS people_week,
       (SELECT count(*) FROM wa_appointments a
         WHERE a.tenant_id = $1 AND a.status = 'confirmed' AND a.start_time > now()) AS upcoming,
       (SELECT count(*) FROM wa_contacts c WHERE c.tenant_id = $1 AND c.needs_human) AS waiting`,
    [tenantId, tz]
  );

  const waiting = await q(
    `SELECT phone, COALESCE(NULLIF(name,''), 'Unknown') AS name, COALESCE(handoff_reason,'') AS reason, last_message_at
       FROM wa_contacts WHERE tenant_id = $1 AND needs_human
      ORDER BY last_message_at DESC NULLS LAST LIMIT 6`,
    [tenantId]
  );

  const today = await q(
    `SELECT a.id, a.start_time, COALESCE(NULLIF(a.customer_name,''), c.name, 'Unknown') AS who,
            sv.name AS service, a.phone
       FROM wa_appointments a
       JOIN wa_services sv ON sv.id = a.service_id
       LEFT JOIN wa_contacts c ON c.tenant_id = a.tenant_id AND c.phone = a.phone
      WHERE a.tenant_id = $1 AND a.status = 'confirmed'
        AND a.start_time >= date_trunc('day', now() AT TIME ZONE $2) AT TIME ZONE $2
        AND a.start_time < (date_trunc('day', now() AT TIME ZONE $2) + interval '2 days') AT TIME ZONE $2
      ORDER BY a.start_time LIMIT 8`,
    [tenantId, tz]
  );

  const recent = await q(
    `SELECT c.phone, COALESCE(NULLIF(c.name,''), 'Unknown') AS name, c.last_message_at,
            (SELECT content FROM wa_messages m
              WHERE m.tenant_id = c.tenant_id AND m.phone = c.phone
              ORDER BY m.id DESC LIMIT 1) AS last_text
       FROM wa_contacts c
      WHERE c.tenant_id = $1 AND c.last_message_at IS NOT NULL
      ORDER BY c.last_message_at DESC LIMIT 6`,
    [tenantId]
  );

  const orderStats = modules.includes("orders")
    ? await one(
        `SELECT
           (SELECT count(*)::int FROM wa_orders WHERE tenant_id = $1 AND status = 'pending') AS new_orders_waiting,
           (SELECT count(*)::int FROM wa_orders WHERE tenant_id = $1
             AND (placed_at >= date_trunc('day', now() AT TIME ZONE $2) AT TIME ZONE $2
                  OR created_at >= date_trunc('day', now() AT TIME ZONE $2) AT TIME ZONE $2)) AS orders_today,
           (SELECT COALESCE(sum(total), 0)::numeric FROM wa_orders WHERE tenant_id = $1
             AND status = 'completed' AND payment_status = 'paid'
             AND updated_at >= date_trunc('day', now() AT TIME ZONE $2) AT TIME ZONE $2) AS revenue_today`,
        [tenantId, tz]
      )
    : null;

  const activeOrders = modules.includes("orders")
    ? await q(
        `SELECT o.id, o.order_no, o.status, o.total, o.currency, o.customer_name, o.phone, o.placed_at,
                (SELECT count(*)::int FROM wa_order_items oi WHERE oi.order_id = o.id AND oi.tenant_id = o.tenant_id) AS item_count
           FROM wa_orders o
          WHERE o.tenant_id = $1 AND o.status IN ('pending', 'accepted', 'preparing', 'ready', 'out_for_delivery')
          ORDER BY o.placed_at DESC NULLS LAST, o.created_at DESC
          LIMIT 6`,
        [tenantId]
      )
    : [];

  const leadStats = modules.includes("leads")
    ? await one(
        `SELECT
           (SELECT count(*)::int FROM wa_leads WHERE tenant_id = $1 AND created_at >= now() - interval '24 hours') AS new_leads_24h,
           (SELECT count(*)::int FROM wa_leads WHERE tenant_id = $1
             AND stage NOT IN ('won', 'lost')
             AND next_followup_at >= date_trunc('day', now() AT TIME ZONE $2) AT TIME ZONE $2
             AND next_followup_at < (date_trunc('day', now() AT TIME ZONE $2) + interval '1 day') AT TIME ZONE $2) AS followups_today,
           (SELECT count(*)::int FROM wa_leads WHERE tenant_id = $1
             AND stage NOT IN ('won', 'lost')
             AND assigned_to IS NULL
             AND ((details->>'urgency') = 'high' OR budget_min IS NOT NULL OR budget_max IS NOT NULL OR value IS NOT NULL)) AS hot_unassigned`,
        [tenantId, tz]
      )
    : null;

  const hotOrUpcomingLeads = modules.includes("leads")
    ? await q(
        `SELECT l.id, l.name, l.phone, l.stage, l.kind, l.summary, l.budget_min, l.budget_max, l.currency, l.value,
                l.next_followup_at, l.details,
                c.first_ad_title,
                u.full_name AS owner_name
           FROM wa_leads l
           LEFT JOIN wa_contacts c ON c.tenant_id = l.tenant_id AND c.phone = l.phone
           LEFT JOIN wa_tenant_users u ON u.tenant_id = l.tenant_id AND u.id = l.assigned_to
          WHERE l.tenant_id = $1 AND l.stage NOT IN ('won', 'lost')
          ORDER BY
            CASE WHEN ((l.details->>'urgency') = 'high' OR l.budget_min IS NOT NULL OR l.budget_max IS NOT NULL) AND l.assigned_to IS NULL THEN 0 ELSE 1 END,
            l.next_followup_at ASC NULLS LAST,
            l.created_at DESC
          LIMIT 6`,
        [tenantId]
      )
    : [];

  const firstName = session.name.split(" ")[0];
  const appointmentsLabel = labels.appointments || "appointments";
  const ordersLabel = labels.orders || "Orders";
  const leadsLabel = labels.leads || "Leads";

  return (
    <div className="p-6 lg:p-8 max-w-6xl">
      {/* Onboarding Banner */}
      {showOnboardingBanner && (
        <div className="mb-6 p-4 rounded-xl border border-pine/30 bg-pine-wash/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-full bg-pine text-white flex items-center justify-center text-sm font-bold shrink-0">
              🚀
            </span>
            <div>
              <h3 className="font-semibold text-sm text-ink">Finish setting up your workspace</h3>
              <p className="text-xs text-ink-soft">
                Complete the quick setup wizard ({onboarding?.step || 1} of 5) to link WhatsApp, review {labels.services?.toLowerCase() || "services"} and FAQs.
              </p>
            </div>
          </div>
          <Link
            href="/onboarding"
            className="px-4 py-2 rounded-md bg-pine text-white text-xs font-semibold hover:bg-pine-deep transition-colors whitespace-nowrap shadow-xs"
          >
            Continue setup →
          </Link>
        </div>
      )}

      <h1 className="text-2xl font-semibold tracking-tight">Hello {firstName}</h1>
      <p className="text-ink-soft mt-1 flex items-center flex-wrap gap-2">
        {settings?.bot_enabled
          ? "Your assistant is answering chats."
          : `Your assistant is paused — ${labels.customers?.toLowerCase() || "customers"} are waiting on your team.`}
        <span className="text-ink-faint hidden sm:inline">·</span>
        <span className="bg-canvas border border-line px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap">
          {stats?.plan_name || "Free Trial"}: {stats?.ai_replies_month ?? 0} / {stats?.plan_limit ? stats.plan_limit : "Unlimited"} AI Replies
        </span>
      </p>

      {/* Primary Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
        <Stat label="Messages today" value={stats?.msgs_today ?? 0} />
        <Stat label={`People this week`} value={stats?.people_week ?? 0} />
        {modules.includes("appointments") ? (
          <Stat label={`Upcoming ${appointmentsLabel}`} value={stats?.upcoming ?? 0} />
        ) : (
          <Stat label="Active conversations" value={stats?.people_week ?? 0} />
        )}
        <Stat label="Waiting for a person" value={stats?.waiting ?? 0} alert={Number(stats?.waiting) > 0} />
      </div>

      {/* Orders Widgets Row (when orders module is enabled) */}
      {modules.includes("orders") && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
          <Stat
            label="New orders waiting"
            value={orderStats?.new_orders_waiting ?? 0}
            alert={Number(orderStats?.new_orders_waiting || 0) > 0}
          />
          <Stat label="Orders placed today" value={orderStats?.orders_today ?? 0} />
          <Stat
            label="Revenue today (completed)"
            value={`QAR ${Number(orderStats?.revenue_today ?? 0).toFixed(2)}`}
          />
        </div>
      )}

      {/* Leads Widgets Row (when leads module is enabled) */}
      {modules.includes("leads") && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
          <Stat
            label={`New ${leadsLabel.toLowerCase()} (24h)`}
            value={leadStats?.new_leads_24h ?? 0}
          />
          <Stat
            label="Follow-ups due today"
            value={leadStats?.followups_today ?? 0}
            alert={Number(leadStats?.followups_today || 0) > 0}
          />
          <Stat
            label="Hot leads without owner"
            value={leadStats?.hot_unassigned ?? 0}
            alert={Number(leadStats?.hot_unassigned || 0) > 0}
          />
        </div>
      )}

      <div className={`grid ${modules.includes("appointments") || modules.includes("orders") || modules.includes("leads") ? "lg:grid-cols-2" : "grid-cols-1"} gap-5 mt-5`}>
        <Panel pad={false}>
          <h2 className="font-semibold px-5 pt-5 pb-3">Waiting for a person</h2>
          {waiting.length === 0 ? (
            <p className="text-sm text-ink-soft px-5 pb-5">
              Nobody is waiting. The assistant has every chat covered.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {waiting.map((w) => (
                <li key={w.phone}>
                  <Link href={`/chats?phone=${w.phone}`} className="flex gap-3 px-5 py-3 hover:bg-canvas">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{w.name}</p>
                      <p className="text-sm text-ink-soft truncate">{w.reason || "Asked for a person"}</p>
                    </div>
                    <span className="text-xs text-ink-faint tabular shrink-0">
                      {timeAgo(w.last_message_at)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {modules.includes("leads") && (
          <Panel pad={false}>
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h2 className="font-semibold">Hot & upcoming {leadsLabel.toLowerCase()}</h2>
              <Link href="/leads" className="text-xs text-pine font-medium hover:underline">
                View board →
              </Link>
            </div>
            {hotOrUpcomingLeads.length === 0 ? (
              <p className="text-sm text-ink-soft px-5 pb-5">No open {leadsLabel.toLowerCase()} right now.</p>
            ) : (
              <ul className="divide-y divide-line">
                {hotOrUpcomingLeads.map((l) => (
                  <li key={l.id}>
                    <Link href={`/leads?id=${l.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-canvas">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm text-ink truncate">{l.name || l.phone}</p>
                          {((l.details?.urgency) === "high" || l.budget_min !== null || l.budget_max !== null) && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-wash text-amber-deep">
                              🔥 Hot
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-ink-soft mt-0.5 truncate">
                          {l.summary || l.kind}
                          {l.owner_name ? ` · ${l.owner_name}` : " · Unassigned"}
                        </p>
                      </div>
                      <Tag tone={l.stage === "new" ? "warn" : l.stage === "won" ? "good" : "neutral"}>
                        {l.stage.toUpperCase()}
                      </Tag>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}

        {modules.includes("orders") && (
          <Panel pad={false}>
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h2 className="font-semibold">Active {ordersLabel}</h2>
              <Link href="/orders" className="text-xs text-pine font-medium hover:underline">
                View board →
              </Link>
            </div>
            {activeOrders.length === 0 ? (
              <p className="text-sm text-ink-soft px-5 pb-5">No active orders right now.</p>
            ) : (
              <ul className="divide-y divide-line">
                {activeOrders.map((o) => (
                  <li key={o.id}>
                    <Link href="/orders" className="flex items-center justify-between px-5 py-3 hover:bg-canvas">
                      <div>
                        <p className="text-sm font-semibold text-ink font-mono">
                          #{o.order_no}
                          <span className="ml-2 text-xs font-normal text-ink-soft font-sans">
                            {o.customer_name || "Unknown"}
                          </span>
                        </p>
                        <p className="text-xs text-ink-soft mt-0.5">
                          {o.item_count} items · {o.currency} {Number(o.total).toFixed(2)}
                        </p>
                      </div>
                      <Tag tone={o.status === "pending" ? "warn" : "neutral"}>
                        {o.status.toUpperCase()}
                      </Tag>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}

        {modules.includes("appointments") && (
          <Panel pad={false}>
            <h2 className="font-semibold px-5 pt-5 pb-3">Next {appointmentsLabel}</h2>
            {today.length === 0 ? (
              <p className="text-sm text-ink-soft px-5 pb-5">Nothing booked for today or tomorrow.</p>
            ) : (
              <ul className="divide-y divide-line">
                {today.map((a) => (
                  <li key={a.id} className="flex gap-3 px-5 py-3">
                    <span className="tabular text-sm w-28 shrink-0 text-ink-soft">
                      {fullStamp(a.start_time, tz)}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{a.who}</p>
                      <p className="text-sm text-ink-soft truncate">{a.service}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}
      </div>

      <Panel pad={false} className="mt-5">
        <h2 className="font-semibold px-5 pt-5 pb-3">Latest chats</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-ink-soft px-5 pb-5">
            No chats yet. Once your number is connected, conversations land here.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {recent.map((r) => (
              <li key={r.phone}>
                <Link href={`/chats?phone=${r.phone}`} className="flex gap-3 px-5 py-3 hover:bg-canvas">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{r.name}</p>
                    <p className="text-sm text-ink-soft truncate">{r.last_text}</p>
                  </div>
                  <span className="text-xs text-ink-faint tabular shrink-0">
                    {timeAgo(r.last_message_at)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function Stat({ label, value, alert }: { label: string; value: number | string; alert?: boolean }) {
  return (
    <div className="bg-panel border border-line rounded-lg p-4">
      <p className="text-3xl font-semibold tabular">{value}</p>
      <p className={`text-sm mt-1 ${alert ? "text-amber font-medium" : "text-ink-soft"}`}>{label}</p>
    </div>
  );
}
