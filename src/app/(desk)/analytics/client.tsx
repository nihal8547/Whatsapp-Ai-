"use client";

import { useEffect, useState, useMemo } from "react";
import { Panel, PageHead, Tag, Empty, Button } from "@/components/ui";
import { formatDuration, formatTimeAgo, type RangeDays } from "@/lib/analytics";

type DailyRow = {
  day: string;
  messages_in: number;
  bot_replies: number;
  staff_replies: number;
  new_contacts: number;
  ad_leads: number;
  bookings_created: number;
  bookings_by_bot: number;
};

type Totals = {
  messages_in: number;
  bot_replies: number;
  staff_replies: number;
  new_contacts: number;
  ad_leads: number;
  bookings_created: number;
  bookings_by_bot: number;
};

type PreviousTotals = Totals & {
  avg_seconds_to_reply: number | null;
  replied_pct: number;
};

type FunnelData = {
  contacts: number;
  engaged: number;
  booked: number;
  completed: number;
  by_source: {
    organic: { contacts: number; engaged: number; booked: number; completed: number };
    ad: { contacts: number; engaged: number; booked: number; completed: number };
  };
};

type AdRow = {
  ad_key: string;
  ad_title: string;
  ad_body: string;
  leads: number;
  engaged: number;
  booked: number;
  completed: number;
  booking_rate_pct: number;
};

type InsightTopic = {
  topic: string;
  count: number;
  example: string;
  suggestion: string;
};

type InsightData = {
  data: { topics?: InsightTopic[] };
  generated_at: string;
} | null;

export default function AnalyticsClient() {
  const [range, setRange] = useState<RangeDays>(30);
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<{
    daily: DailyRow[];
    totals: Totals;
    previous: PreviousTotals;
    response: {
      avg_seconds_to_reply: number | null;
      median_seconds_to_reply: number | null;
      replied_pct: number;
    };
    funnel: FunnelData;
    human: number;
  } | null>(null);

  const [ads, setAds] = useState<AdRow[]>([]);
  const [insights, setInsights] = useState<InsightData>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  useEffect(() => {
    let ignore = false;
    setLoading(true);

    async function loadData() {
      try {
        const [resOver, resAds, resIns] = await Promise.all([
          fetch(`/api/analytics/overview?range=${range}`).then((r) => r.json()),
          fetch(`/api/analytics/ads?range=${range}`).then((r) => r.json()),
          fetch(`/api/analytics/insights`).then((r) => r.json()),
        ]);

        if (!ignore) {
          if (resOver.ok) setOverview(resOver);
          if (resAds.ok) setAds(resAds.ads ?? []);
          if (resIns.ok) setInsights(resIns.insights);
          setLoading(false);
        }
      } catch (err) {
        if (!ignore) setLoading(false);
      }
    }

    loadData();
    return () => {
      ignore = true;
    };
  }, [range]);

  function renderChange(current: number, previous: number) {
    if (!previous || previous === 0) {
      return <span className="text-xs text-ink-faint">n/a</span>;
    }
    const diff = current - previous;
    const pct = Math.round((diff / previous) * 100);
    if (pct > 0) {
      return (
        <span className="text-xs text-pine font-medium inline-flex items-center gap-0.5">
          <svg className="w-3 h-3 fill-current" viewBox="0 0 16 16">
            <path d="M8 3.5l5 6H3l5-6z" />
          </svg>
          +{pct}%
        </span>
      );
    }
    if (pct < 0) {
      return (
        <span className="text-xs text-brick font-medium inline-flex items-center gap-0.5">
          <svg className="w-3 h-3 fill-current" viewBox="0 0 16 16">
            <path d="M8 12.5l-5-6h10l-5 6z" />
          </svg>
          {pct}%
        </span>
      );
    }
    return <span className="text-xs text-ink-soft font-medium">0%</span>;
  }

  // Best booking rate for ads
  const bestAdKey = useMemo(() => {
    if (!ads.length) return null;
    let maxRate = -1;
    let bestKey: string | null = null;
    for (const a of ads) {
      if (a.booking_rate_pct > maxRate && a.leads > 0) {
        maxRate = a.booking_rate_pct;
        bestKey = a.ad_key;
      }
    }
    return maxRate > 0 ? bestKey : null;
  }, [ads]);

  const daily = overview?.daily ?? [];
  const totals = overview?.totals;
  const previous = overview?.previous;
  const resp = overview?.response;
  const funnel = overview?.funnel;

  // Max value for bar chart
  const maxMessages = useMemo(() => {
    if (!daily.length) return 10;
    const max = Math.max(...daily.map((d) => d.messages_in));
    return max > 0 ? Math.ceil(max * 1.15) : 10;
  }, [daily]);

  const maxContacts = useMemo(() => {
    if (!daily.length) return 10;
    const max = Math.max(...daily.map((d) => d.new_contacts));
    return max > 0 ? max : 10;
  }, [daily]);

  return (
    <div className="p-6 lg:p-8 max-w-6xl space-y-8">
      {/* 1. Header with Range Switch and Export CSV menu */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
          <p className="text-sm text-ink-soft mt-1">
            Performance, conversation activity, ad ROI, and customer trends.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Range Selector */}
          <div className="inline-flex rounded-md border border-line bg-panel p-0.5">
            {([7, 30, 90] as RangeDays[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  range === r
                    ? "bg-pine text-white"
                    : "text-ink-soft hover:text-ink hover:bg-canvas"
                }`}
              >
                Last {r}d
              </button>
            ))}
          </div>

          {/* Export Menu */}
          <div className="relative">
            <Button
              variant="quiet"
              className="text-xs py-1.5 px-3 flex items-center gap-1.5"
              onClick={() => setExportOpen((prev) => !prev)}
            >
              <span>Export CSV</span>
              <svg className="w-3 h-3 text-ink-faint" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4 6l4 4 4-4H4z" />
              </svg>
            </Button>
            {exportOpen && (
              <div
                className="absolute right-0 mt-1 w-44 rounded-md border border-line bg-panel shadow-lg py-1 z-20"
                onClick={() => setExportOpen(false)}
              >
                <a
                  href={`/api/analytics/export?type=daily&range=${range}`}
                  download
                  className="block px-3 py-2 text-xs text-ink hover:bg-canvas"
                >
                  Daily Activity CSV
                </a>
                <a
                  href={`/api/analytics/export?type=ads&range=${range}`}
                  download
                  className="block px-3 py-2 text-xs text-ink hover:bg-canvas"
                >
                  Ad Performance CSV
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. KPI Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Messages received */}
        <Panel className="p-4 flex flex-col justify-between">
          <div>
            <p className="text-xs text-ink-soft font-medium">Messages in</p>
            <p className="text-2xl font-semibold tabular mt-1">
              {loading ? "…" : (totals?.messages_in ?? 0).toLocaleString()}
            </p>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-line/60 pt-2">
            <span className="text-[11px] text-ink-faint">vs prev</span>
            {loading || !previous ? (
              <span className="text-xs text-ink-faint">—</span>
            ) : (
              renderChange(totals?.messages_in ?? 0, previous.messages_in)
            )}
          </div>
        </Panel>

        {/* Bot replies */}
        <Panel className="p-4 flex flex-col justify-between">
          <div>
            <p className="text-xs text-ink-soft font-medium">Bot replies</p>
            <p className="text-2xl font-semibold tabular mt-1">
              {loading ? "…" : (totals?.bot_replies ?? 0).toLocaleString()}
            </p>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-line/60 pt-2">
            <span className="text-[11px] text-ink-faint">vs prev</span>
            {loading || !previous ? (
              <span className="text-xs text-ink-faint">—</span>
            ) : (
              renderChange(totals?.bot_replies ?? 0, previous.bot_replies)
            )}
          </div>
        </Panel>

        {/* New contacts */}
        <Panel className="p-4 flex flex-col justify-between">
          <div>
            <p className="text-xs text-ink-soft font-medium">New contacts</p>
            <p className="text-2xl font-semibold tabular mt-1">
              {loading ? "…" : (totals?.new_contacts ?? 0).toLocaleString()}
            </p>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-line/60 pt-2">
            <span className="text-[11px] text-ink-faint">vs prev</span>
            {loading || !previous ? (
              <span className="text-xs text-ink-faint">—</span>
            ) : (
              renderChange(totals?.new_contacts ?? 0, previous.new_contacts)
            )}
          </div>
        </Panel>

        {/* Bookings */}
        <Panel className="p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-ink-soft font-medium">Bookings</p>
              {totals && totals.bookings_by_bot > 0 && (
                <Tag tone="good">
                  <span className="text-[10px] tabular">{totals.bookings_by_bot} bot</span>
                </Tag>
              )}
            </div>
            <p className="text-2xl font-semibold tabular mt-1">
              {loading ? "…" : (totals?.bookings_created ?? 0).toLocaleString()}
            </p>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-line/60 pt-2">
            <span className="text-[11px] text-ink-faint">vs prev</span>
            {loading || !previous ? (
              <span className="text-xs text-ink-faint">—</span>
            ) : (
              renderChange(totals?.bookings_created ?? 0, previous.bookings_created)
            )}
          </div>
        </Panel>

        {/* Average reply time */}
        <Panel className="p-4 flex flex-col justify-between">
          <div>
            <p className="text-xs text-ink-soft font-medium">Avg reply time</p>
            <p className="text-2xl font-semibold tabular mt-1">
              {loading ? "…" : formatDuration(resp?.avg_seconds_to_reply)}
            </p>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-line/60 pt-2">
            <span className="text-[11px] text-ink-faint">vs prev</span>
            {loading || !previous || previous.avg_seconds_to_reply == null ? (
              <span className="text-xs text-ink-faint">n/a</span>
            ) : (
              renderChange(resp?.avg_seconds_to_reply ?? 0, previous.avg_seconds_to_reply)
            )}
          </div>
        </Panel>

        {/* Replied % */}
        <Panel className="p-4 flex flex-col justify-between">
          <div>
            <p className="text-xs text-ink-soft font-medium">Replied %</p>
            <p className="text-2xl font-semibold tabular mt-1">
              {loading ? "…" : `${resp?.replied_pct ?? 0}%`}
            </p>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-line/60 pt-2">
            <span className="text-[11px] text-ink-faint">vs prev</span>
            {loading || !previous ? (
              <span className="text-xs text-ink-faint">—</span>
            ) : (
              renderChange(resp?.replied_pct ?? 0, previous.replied_pct)
            )}
          </div>
        </Panel>
      </div>

      {/* 3. "Conversations per day" - Inline SVG Bar Chart */}
      <Panel>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-base font-semibold">Conversations per day</h2>
            <p className="text-xs text-ink-soft mt-0.5">
              Daily incoming messages (bars) and new contacts (trend line).
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-ink-soft">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-pine" />
              <span>Inbound messages</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-amber" />
              <span>New contacts</span>
            </div>
          </div>
        </div>

        {daily.length === 0 ? (
          <Empty title="No activity recorded" />
        ) : (
          <div className="relative pt-6 pb-2">
            {/* Tooltip */}
            {hoveredIndex !== null && daily[hoveredIndex] && (
              <div
                className="absolute top-0 z-10 -translate-x-1/2 pointer-events-none bg-ink text-white text-xs rounded py-1 px-2.5 shadow-md tabular transition-all"
                style={{
                  left: `${((hoveredIndex + 0.5) / daily.length) * 100}%`,
                }}
              >
                <div className="font-semibold text-white/90">{daily[hoveredIndex].day}</div>
                <div className="text-white/75 mt-0.5 flex gap-2">
                  <span>In: {daily[hoveredIndex].messages_in}</span>
                  <span>Bot: {daily[hoveredIndex].bot_replies}</span>
                  <span>Staff: {daily[hoveredIndex].staff_replies}</span>
                  <span>New: {daily[hoveredIndex].new_contacts}</span>
                </div>
              </div>
            )}

            <div className="h-56 w-full">
              <svg
                className="w-full h-full overflow-visible"
                viewBox={`0 0 ${daily.length * 24} 160`}
                preserveAspectRatio="none"
              >
                {/* Horizontal grid lines */}
                <line x1="0" y1="40" x2={daily.length * 24} y2="40" stroke="#e6ece8" strokeDasharray="2,2" />
                <line x1="0" y1="80" x2={daily.length * 24} y2="80" stroke="#e6ece8" strokeDasharray="2,2" />
                <line x1="0" y1="120" x2={daily.length * 24} y2="120" stroke="#e6ece8" strokeDasharray="2,2" />
                <line x1="0" y1="150" x2={daily.length * 24} y2="150" stroke="#dde3dc" strokeWidth="1" />

                {/* Bars for messages_in */}
                {daily.map((d, i) => {
                  const barHeight = (d.messages_in / maxMessages) * 130;
                  const x = i * 24 + 4;
                  const y = 150 - barHeight;
                  const isHovered = hoveredIndex === i;

                  return (
                    <g key={d.day}>
                      {/* Transparent hit area for hover */}
                      <rect
                        x={i * 24}
                        y={0}
                        width={24}
                        height={160}
                        fill="transparent"
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredIndex(i)}
                        onMouseLeave={() => setHoveredIndex(null)}
                      />
                      {/* Bar */}
                      <rect
                        x={x}
                        y={Math.max(20, y)}
                        width={16}
                        height={Math.max(2, barHeight)}
                        rx={2}
                        className={`transition-colors pointer-events-none ${
                          isHovered ? "fill-pine-deep" : "fill-pine"
                        }`}
                      />
                    </g>
                  );
                })}

                {/* Line for new_contacts */}
                {daily.length > 1 && (
                  <path
                    d={daily
                      .map((d, i) => {
                        const x = i * 24 + 12;
                        const y = 150 - (d.new_contacts / maxContacts) * 110;
                        return `${i === 0 ? "M" : "L"} ${x} ${Math.max(20, y)}`;
                      })
                      .join(" ")}
                    fill="none"
                    stroke="#b26b06"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="pointer-events-none"
                  />
                )}
              </svg>
            </div>

            {/* X-axis date labels */}
            <div className="flex justify-between text-[11px] text-ink-faint tabular mt-2 px-1">
              <span>{daily[0]?.day}</span>
              {daily.length > 14 && <span>{daily[Math.floor(daily.length / 2)]?.day}</span>}
              <span>{daily[daily.length - 1]?.day}</span>
            </div>
          </div>
        )}
      </Panel>

      {/* 4. "From chat to booking" Funnel */}
      <Panel>
        <div className="mb-5">
          <h2 className="text-base font-semibold">From chat to booking</h2>
          <p className="text-xs text-ink-soft mt-0.5">
            Conversion stages for contacts created during the selected period.
          </p>
        </div>

        {/* Funnel Steps */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {/* Step 1: Contacts */}
          <div className="border border-line rounded-lg p-3.5 bg-canvas/40">
            <div className="flex items-center justify-between">
              <span className="text-xs text-ink-soft font-medium">1. Contacts</span>
              <span className="text-[11px] text-ink-faint tabular">100%</span>
            </div>
            <p className="text-xl font-semibold tabular mt-1.5">{funnel?.contacts ?? 0}</p>
            <p className="text-[11px] text-ink-faint mt-1">Total new leads</p>
          </div>

          {/* Step 2: Engaged */}
          <div className="border border-line rounded-lg p-3.5 bg-canvas/40">
            <div className="flex items-center justify-between">
              <span className="text-xs text-ink-soft font-medium">2. Engaged</span>
              <span className="text-[11px] text-pine font-medium tabular">
                {funnel && funnel.contacts > 0
                  ? `${Math.round((funnel.engaged / funnel.contacts) * 100)}%`
                  : "0%"}
              </span>
            </div>
            <p className="text-xl font-semibold tabular mt-1.5">{funnel?.engaged ?? 0}</p>
            <p className="text-[11px] text-ink-faint mt-1">2+ inbound messages</p>
          </div>

          {/* Step 3: Booked */}
          <div className="border border-line rounded-lg p-3.5 bg-canvas/40">
            <div className="flex items-center justify-between">
              <span className="text-xs text-ink-soft font-medium">3. Booked</span>
              <span className="text-[11px] text-pine font-medium tabular">
                {funnel && funnel.engaged > 0
                  ? `${Math.round((funnel.booked / funnel.engaged) * 100)}%`
                  : funnel && funnel.contacts > 0
                  ? `${Math.round((funnel.booked / funnel.contacts) * 100)}%`
                  : "0%"}
              </span>
            </div>
            <p className="text-xl font-semibold tabular mt-1.5">{funnel?.booked ?? 0}</p>
            <p className="text-[11px] text-ink-faint mt-1">Created appointment</p>
          </div>

          {/* Step 4: Completed */}
          <div className="border border-line rounded-lg p-3.5 bg-canvas/40">
            <div className="flex items-center justify-between">
              <span className="text-xs text-ink-soft font-medium">4. Completed</span>
              <span className="text-[11px] text-pine font-medium tabular">
                {funnel && funnel.booked > 0
                  ? `${Math.round((funnel.completed / funnel.booked) * 100)}%`
                  : "0%"}
              </span>
            </div>
            <p className="text-xl font-semibold tabular mt-1.5">{funnel?.completed ?? 0}</p>
            <p className="text-[11px] text-ink-faint mt-1">Attended service</p>
          </div>
        </div>

        {/* Breakdown table: Organic vs Ads */}
        <div className="overflow-x-auto rounded-md border border-line">
          <table className="w-full text-left text-xs">
            <thead className="bg-canvas border-b border-line text-ink-soft">
              <tr>
                <th className="py-2.5 px-3 font-medium">Lead source</th>
                <th className="py-2.5 px-3 font-medium text-right">Contacts</th>
                <th className="py-2.5 px-3 font-medium text-right">Engaged (2+)</th>
                <th className="py-2.5 px-3 font-medium text-right">Booked</th>
                <th className="py-2.5 px-3 font-medium text-right">Completed</th>
                <th className="py-2.5 px-3 font-medium text-right">Booking Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(["organic", "ad"] as const).map((src) => {
                const s = funnel?.by_source?.[src] ?? {
                  contacts: 0,
                  engaged: 0,
                  booked: 0,
                  completed: 0,
                };
                const rate =
                  s.contacts > 0 ? (s.booked / s.contacts) * 100 : 0;
                return (
                  <tr key={src} className="hover:bg-canvas/50">
                    <td className="py-2.5 px-3 font-medium capitalize flex items-center gap-1.5">
                      {src === "ad" ? (
                        <span className="inline-block w-2 h-2 rounded-full bg-pine" />
                      ) : (
                        <span className="inline-block w-2 h-2 rounded-full bg-ink-faint" />
                      )}
                      <span>{src === "ad" ? "WhatsApp Ads" : "Organic / Direct"}</span>
                    </td>
                    <td className="py-2.5 px-3 tabular text-right">{s.contacts}</td>
                    <td className="py-2.5 px-3 tabular text-right">{s.engaged}</td>
                    <td className="py-2.5 px-3 tabular text-right">{s.booked}</td>
                    <td className="py-2.5 px-3 tabular text-right">{s.completed}</td>
                    <td className="py-2.5 px-3 tabular text-right font-medium">
                      {rate.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Human handoff stat */}
        <div className="mt-4 pt-3 border-t border-line/60 flex items-center justify-between text-xs text-ink-soft">
          <span>Needed a person: <strong className="tabular text-ink">{overview?.human ?? 0}</strong></span>
          <span className="text-ink-faint text-[11px]">
            Contacts that triggered staff handoff in this range
          </span>
        </div>
      </Panel>

      {/* 5. "Which ads bring customers" Table */}
      <Panel pad={false}>
        <div className="p-5 border-b border-line">
          <h2 className="text-base font-semibold">Which ads bring customers</h2>
          <p className="text-xs text-ink-soft mt-0.5">
            Click-to-WhatsApp ad campaigns sorted by total leads.
          </p>
        </div>

        {ads.length === 0 ? (
          <Empty title="No ad leads yet">
            Customers who tap a Click-to-WhatsApp ad show up here automatically.
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-canvas border-b border-line text-ink-soft">
                <tr>
                  <th className="py-3 px-4 font-medium">Ad Campaign</th>
                  <th className="py-3 px-4 font-medium text-right">Leads</th>
                  <th className="py-3 px-4 font-medium text-right">Engaged</th>
                  <th className="py-3 px-4 font-medium text-right">Booked</th>
                  <th className="py-3 px-4 font-medium text-right">Completed</th>
                  <th className="py-3 px-4 font-medium text-right">Booking Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {ads.map((a) => {
                  const isBest = bestAdKey === a.ad_key;
                  return (
                    <tr
                      key={a.ad_key}
                      className={`hover:bg-canvas/50 transition-colors ${
                        isBest ? "bg-pine-wash/40" : ""
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="font-medium text-ink flex items-center gap-2">
                          <span>{a.ad_title || a.ad_key}</span>
                          {isBest && <Tag tone="good">Best Rate</Tag>}
                        </div>
                        {a.ad_body && (
                          <p className="text-[11px] text-ink-soft mt-0.5 line-clamp-1">
                            {a.ad_body}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4 tabular text-right font-medium">{a.leads}</td>
                      <td className="py-3 px-4 tabular text-right">{a.engaged}</td>
                      <td className="py-3 px-4 tabular text-right">{a.booked}</td>
                      <td className="py-3 px-4 tabular text-right">{a.completed}</td>
                      <td className="py-3 px-4 tabular text-right font-semibold text-pine-deep">
                        {a.booking_rate_pct.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* 6. "What customers ask most" Cards */}
      <Panel>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-4">
          <div>
            <h2 className="text-base font-semibold">What customers ask most</h2>
            <p className="text-xs text-ink-soft mt-0.5">
              Common questions identified by AI from your customer chats.
            </p>
          </div>
          {insights?.generated_at && (
            <span className="text-xs text-ink-faint tabular">
              updated {formatTimeAgo(insights.generated_at)}
            </span>
          )}
        </div>

        {!insights || !insights.data?.topics || insights.data.topics.length === 0 ? (
          <Empty title="Not enough messages yet">
            Needs at least 10 in the last 7 days to generate top question insights.
          </Empty>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {insights.data.topics.map((t, idx) => (
              <div
                key={idx}
                className="border border-line rounded-lg p-4 bg-canvas/30 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-sm text-ink">{t.topic}</h3>
                    <Tag tone="neutral">
                      <span className="tabular">{t.count} asks</span>
                    </Tag>
                  </div>
                  {t.example && (
                    <p className="text-xs text-ink-soft italic mt-2.5 bg-panel border border-line/60 rounded px-2.5 py-1.5">
                      &ldquo;{t.example}&rdquo;
                    </p>
                  )}
                </div>
                {t.suggestion && (
                  <div className="mt-3 pt-2.5 border-t border-line/50 text-xs text-pine-deep">
                    <span className="font-medium text-ink">Suggestion: </span>
                    {t.suggestion}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
