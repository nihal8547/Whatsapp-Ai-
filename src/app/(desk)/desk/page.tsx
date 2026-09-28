import Link from "next/link";
import { requireTenant } from "@/lib/auth";
import { q, one } from "@/lib/db";
import { Panel, Tag } from "@/components/ui";
import { fullStamp, timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DeskPage() {
  const { tenantId, session } = await requireTenant();

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

  const firstName = session.name.split(" ")[0];

  return (
    <div className="p-6 lg:p-8 max-w-6xl">
      <h1 className="text-2xl font-semibold tracking-tight">Hello {firstName}</h1>
      <p className="text-ink-soft mt-1 flex items-center flex-wrap gap-2">
        {settings?.bot_enabled
          ? "Your assistant is answering chats."
          : "Your assistant is paused — customers are waiting on your team."}
        <span className="text-ink-faint hidden sm:inline">·</span>
        <span className="bg-canvas border border-line px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap">
          {stats?.plan_name || "Free Trial"}: {stats?.ai_replies_month ?? 0} / {stats?.plan_limit ? stats.plan_limit : "Unlimited"} AI Replies
        </span>
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
        <Stat label="Messages today" value={stats?.msgs_today ?? 0} />
        <Stat label="People this week" value={stats?.people_week ?? 0} />
        <Stat label="Upcoming appointments" value={stats?.upcoming ?? 0} />
        <Stat label="Waiting for a person" value={stats?.waiting ?? 0} alert={Number(stats?.waiting) > 0} />
      </div>

      <div className="grid lg:grid-cols-2 gap-5 mt-5">
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

        <Panel pad={false}>
          <h2 className="font-semibold px-5 pt-5 pb-3">Next appointments</h2>
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
