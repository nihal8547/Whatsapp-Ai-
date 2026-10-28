"use client";

import { useState } from "react";
import Link from "next/link";
import { Panel, PageHead, Empty, Button, Tag, Toast, useToast } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import { INTENT_CONFIG, STAGE_CONFIG, ContactIntent, LeadStage } from "@/lib/followups";

export type FollowupItem = {
  phone: string;
  name: string;
  intent: ContactIntent;
  lead_stage: LeadStage;
  interest_topic: string;
  quote_summary?: string | null;
  last_message_at: string;
  intent_locked: boolean;
  template_type: "quote" | "enquiry";
  message_to_send: string;
  scheduled_at: string;
  is_due: boolean;
  delivery_window: string;
  window_note: string;
};

export default function FollowupsClient({
  initialFollowups,
  enabled,
  afterHours,
}: {
  initialFollowups: FollowupItem[];
  enabled: boolean;
  afterHours: number;
}) {
  const [items, setItems] = useState<FollowupItem[]>(initialFollowups);
  const [skippingPhone, setSkippingPhone] = useState<string | null>(null);
  const [filterStage, setFilterStage] = useState<string>("all");
  const { message, show } = useToast();

  async function skipPerson(phone: string, name: string) {
    setSkippingPhone(phone);
    try {
      const res = await fetch("/api/followups/skip", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      setSkippingPhone(null);

      if (data.ok) {
        setItems((prev) => prev.filter((it) => it.phone !== phone));
        show(`Skipped ${name || `+${phone}`}. Intent set to Other and locked.`);
      } else {
        show(data.message || data.error || "Failed to skip contact.");
      }
    } catch {
      setSkippingPhone(null);
      show("Network error while skipping.");
    }
  }

  const filteredItems = items.filter((item) => {
    if (filterStage === "all") return true;
    return item.lead_stage === filterStage;
  });

  const enquiryCount = items.filter((i) => i.lead_stage !== "quoted").length;
  const quoteCount = items.filter((i) => i.lead_stage === "quoted").length;

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <PageHead
        title="Next Follow-ups"
        lead="Quiet enquiries and prospective quotes ready for follow-up. Dispatched automatically between 09:00 and 21:00."
        action={
          <div className="flex items-center gap-2">
            <Link href="/contacts">
              <Button variant="quiet">View all contacts</Button>
            </Link>
            <Link href="/assistant">
              <Button variant="quiet">Settings & templates</Button>
            </Link>
          </div>
        }
      />

      {/* Overview Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Panel className="flex items-center justify-between p-4">
          <div>
            <p className="text-xs font-semibold text-ink-soft uppercase tracking-wider">
              Ready for Follow-up
            </p>
            <p className="text-2xl font-bold text-ink mt-1 tabular">{items.length}</p>
            <p className="text-[11px] text-ink-faint mt-0.5">
              {enquiryCount} enquiries · {quoteCount} quotes
            </p>
          </div>
          <span className="h-10 w-10 flex items-center justify-center rounded-lg bg-pine-wash text-pine text-lg">
            🎯
          </span>
        </Panel>

        <Panel className="flex items-center justify-between p-4">
          <div>
            <p className="text-xs font-semibold text-ink-soft uppercase tracking-wider">
              Dispatch Window
            </p>
            <p className="text-lg font-bold text-ink mt-1">09:00 – 21:00</p>
            <p className="text-[11px] text-ink-faint mt-0.5">Sent at most twice per quiet enquiry</p>
          </div>
          <span className="h-10 w-10 flex items-center justify-center rounded-lg bg-blue-50 text-blue-600 text-lg">
            ⏰
          </span>
        </Panel>

        <Panel className="flex items-center justify-between p-4">
          <div>
            <p className="text-xs font-semibold text-ink-soft uppercase tracking-wider">
              Automation Trigger
            </p>
            <p className="text-lg font-bold text-ink mt-1">
              {enabled ? (
                <span className="text-emerald-600 dark:text-emerald-400">Active ({afterHours}h wait)</span>
              ) : (
                <span className="text-amber-600 dark:text-amber-400">Paused</span>
              )}
            </p>
            <p className="text-[11px] text-ink-faint mt-0.5">
              {enabled ? "Dispatches when hours elapse" : "Turn on in Assistant settings"}
            </p>
          </div>
          <span className="h-10 w-10 flex items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 text-lg">
            ⚡
          </span>
        </Panel>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center bg-panel border border-line rounded-lg p-1 gap-1 text-xs font-medium">
          <button
            onClick={() => setFilterStage("all")}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              filterStage === "all"
                ? "bg-pine text-white"
                : "text-ink-soft hover:text-ink hover:bg-canvas"
            }`}
          >
            All Due ({items.length})
          </button>
          <button
            onClick={() => setFilterStage("enquiry")}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              filterStage === "enquiry"
                ? "bg-pine text-white"
                : "text-ink-soft hover:text-ink hover:bg-canvas"
            }`}
          >
            Enquiries
          </button>
          <button
            onClick={() => setFilterStage("quoted")}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              filterStage === "quoted"
                ? "bg-pine text-white"
                : "text-ink-soft hover:text-ink hover:bg-canvas"
            }`}
          >
            Quotes ({quoteCount})
          </button>
          <button
            onClick={() => setFilterStage("negotiating")}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              filterStage === "negotiating"
                ? "bg-pine text-white"
                : "text-ink-soft hover:text-ink hover:bg-canvas"
            }`}
          >
            Negotiating
          </button>
        </div>

        <p className="text-xs text-ink-soft hidden sm:block">
          Matches: intent enquiry, stage enquiry/quoted/negotiating, topic present, active within 14d, no booking
        </p>
      </div>

      {filteredItems.length === 0 ? (
        <Panel>
          <Empty title="No follow-ups due right now">
            {items.length === 0
              ? "All enquiries are either active, booked, opted out, or have already been followed up."
              : "No follow-up matches for the selected filter."}
          </Empty>
        </Panel>
      ) : (
        <div className="space-y-4">
          {filteredItems.map((item) => {
            const stageMeta = STAGE_CONFIG[item.lead_stage] || STAGE_CONFIG.enquiry;
            const isSkipping = skippingPhone === item.phone;
            const scheduledDate = new Date(item.scheduled_at);

            return (
              <Panel key={item.phone} className="p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/chats?phone=${item.phone}`}
                        className="font-semibold text-ink text-base hover:underline"
                      >
                        {item.name || "Customer"}
                      </Link>
                      <span className="text-sm text-ink-soft tabular font-mono">
                        +{item.phone}
                      </span>
                      <span
                        className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-md border ${stageMeta.bg} ${stageMeta.text} ${stageMeta.border}`}
                      >
                        Stage: {stageMeta.label}
                      </span>
                      <Tag tone="good">Intent: Enquiry</Tag>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs">
                      <span className="inline-flex items-center gap-1 text-slate-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-0.5">
                        <strong className="text-emerald-800 font-semibold">Interest Topic:</strong>{" "}
                        {item.interest_topic}
                      </span>
                      {item.quote_summary && (
                        <span className="inline-flex items-center gap-1 text-slate-700 bg-indigo-50 border border-indigo-200 rounded px-2 py-0.5">
                          <strong className="text-indigo-800 font-semibold">Quote:</strong>{" "}
                          {item.quote_summary}
                        </span>
                      )}
                      <span className="text-ink-soft">
                        Last message: <strong>{timeAgo(item.last_message_at)}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Timing Pill */}
                  <div className="sm:text-right shrink-0">
                    <div
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                        item.is_due
                          ? "bg-amber-50 text-amber-900 border-amber-200"
                          : "bg-slate-50 text-slate-700 border-slate-200"
                      }`}
                    >
                      <span>⏱</span>
                      <span>
                        {item.is_due
                          ? "Due now (09:00–21:00 window)"
                          : `Scheduled: ${scheduledDate.toLocaleDateString()} ${scheduledDate.toLocaleTimeString(
                              [],
                              { hour: "2-digit", minute: "2-digit" }
                            )}`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Message preview that would be sent */}
                <div className="bg-canvas border border-line rounded-lg p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
                    <span>
                      💬 Message to be sent ({item.template_type === "quote" ? "Quote Template" : "Enquiry Template"})
                    </span>
                    <span>WhatsApp dispatch window 09:00 - 21:00</span>
                  </div>
                  <div className="bg-[#DCF8C6] dark:bg-emerald-950/60 border border-emerald-200/60 dark:border-emerald-800/60 rounded-xl p-3 shadow-2xs text-xs text-slate-800 dark:text-emerald-100">
                    <p className="whitespace-pre-wrap leading-relaxed">{item.message_to_send}</p>
                    <div className="text-[10px] text-emerald-800/60 dark:text-emerald-400/60 text-right mt-1">
                      Automated Follow-up ✓✓
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between gap-3 pt-1 border-t border-line/60">
                  <p className="text-xs text-ink-faint">
                    Rule check: last msg &lt; 14 days · opted in · no future appointments booked
                  </p>
                  <div className="flex items-center gap-2">
                    <Link href={`/chats?phone=${item.phone}`}>
                      <Button variant="quiet" className="text-xs">
                        Open chat →
                      </Button>
                    </Link>
                    <button
                      type="button"
                      onClick={() => skipPerson(item.phone, item.name)}
                      disabled={isSkipping}
                      className="px-3 py-1.5 rounded-md text-xs font-medium text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors"
                      title="Sets intent to 'other' and locks it so follow-up is skipped"
                    >
                      {isSkipping ? "Skipping…" : "Skip this person"}
                    </button>
                  </div>
                </div>
              </Panel>
            );
          })}
        </div>
      )}

      <Toast message={message} />
    </div>
  );
}
