"use client";

import { useState } from "react";
import Link from "next/link";
import { Tag, Toast, useToast } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import {
  INTENT_VALUES,
  STAGE_VALUES,
  INTENT_CONFIG,
  STAGE_CONFIG,
  ContactIntent,
  LeadStage,
} from "@/lib/followups";

export type ContactItem = {
  phone: string;
  name: string;
  needs_human: boolean;
  bot_enabled: boolean;
  last_message_at: string | null;
  summary: string;
  lead_source?: string;
  first_ad_title?: string;
  consent_status?: string;
  consent_source?: string;
  attributes?: Record<string, any>;
  bookings?: number | string;
  intent: ContactIntent;
  lead_stage: LeadStage;
  interest_topic?: string | null;
  quote_summary?: string | null;
  intent_locked: boolean;
  intent_updated_at?: string | null;
};

export default function ContactsList({ initialContacts }: { initialContacts: ContactItem[] }) {
  const [contacts, setContacts] = useState<ContactItem[]>(initialContacts);
  const [editingPhone, setEditingPhone] = useState<string | null>(null);
  const [editIntent, setEditIntent] = useState<ContactIntent>("unknown");
  const [editStage, setEditStage] = useState<LeadStage>("none");
  const [editTopic, setEditTopic] = useState("");
  const [editQuote, setEditQuote] = useState("");
  const [saving, setSaving] = useState(false);
  const { message, show } = useToast();

  function startEdit(c: ContactItem, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setEditingPhone(c.phone);
    setEditIntent(c.intent || "unknown");
    setEditStage(c.lead_stage || "none");
    setEditTopic(c.interest_topic || "");
    setEditQuote(c.quote_summary || "");
  }

  function cancelEdit(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setEditingPhone(null);
  }

  async function saveContact(phone: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setSaving(true);

    try {
      const res = await fetch(`/api/contacts/${phone}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          intent: editIntent,
          lead_stage: editStage,
          interest_topic: editTopic,
          quote_summary: editQuote,
        }),
      });
      const data = await res.json();
      setSaving(false);

      if (data.ok && data.contact) {
        setContacts((prev) =>
          prev.map((c) =>
            c.phone === phone
              ? {
                  ...c,
                  intent: data.contact.intent,
                  lead_stage: data.contact.lead_stage,
                  interest_topic: data.contact.interest_topic,
                  quote_summary: data.contact.quote_summary,
                  intent_locked: true,
                }
              : c
          )
        );
        setEditingPhone(null);
        show("Saved! Contact locked with staff classification.");
      } else {
        show(data.message || data.error || "Failed to update contact.");
      }
    } catch {
      setSaving(false);
      show("Network error while updating contact.");
    }
  }

  async function resetAi(phone: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setSaving(true);

    try {
      const res = await fetch(`/api/contacts/${phone}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reset_ai: true }),
      });
      const data = await res.json();
      setSaving(false);

      if (data.ok && data.contact) {
        setContacts((prev) =>
          prev.map((c) =>
            c.phone === phone
              ? {
                  ...c,
                  intent: data.contact.intent,
                  lead_stage: data.contact.lead_stage,
                  intent_locked: false,
                }
              : c
          )
        );
        setEditingPhone(null);
        show("Unlocked: AI classifier will decide intent on next chat.");
      } else {
        show(data.message || data.error || "Failed to reset AI classification.");
      }
    } catch {
      setSaving(false);
      show("Network error while resetting.");
    }
  }

  return (
    <>
      <ul className="divide-y divide-line">
        {contacts.map((c) => {
          const consentTone =
            c.consent_status === "opted_in"
              ? "good"
              : c.consent_status === "opted_out"
              ? "bad"
              : "neutral";

          const consentLabel =
            c.consent_status === "opted_in"
              ? "Opted in"
              : c.consent_status === "opted_out"
              ? "Opted out"
              : "Unknown";

          const intentMeta = INTENT_CONFIG[c.intent] || INTENT_CONFIG.unknown;
          const stageMeta = STAGE_CONFIG[c.lead_stage] || STAGE_CONFIG.none;
          const isEditing = editingPhone === c.phone;

          return (
            <li key={c.phone} className="hover:bg-canvas/50 transition-colors">
              <div className="px-5 py-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/chats?phone=${c.phone}`}
                        className="font-medium text-ink hover:underline"
                      >
                        {c.name || "Unknown"}
                      </Link>

                      {/* Intent Badge */}
                      <span
                        className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-md border ${intentMeta.bg} ${intentMeta.text} ${intentMeta.border}`}
                      >
                        Intent: {intentMeta.label}
                      </span>

                      {/* Stage Badge */}
                      {c.lead_stage && c.lead_stage !== "none" && (
                        <span
                          className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-md border ${stageMeta.bg} ${stageMeta.text} ${stageMeta.border}`}
                        >
                          Stage: {stageMeta.label}
                        </span>
                      )}

                      {/* Intent Locked Badge */}
                      {c.intent_locked ? (
                        <span
                          title="Locked: staff set this intent; AI classifier skips it"
                          className="inline-flex items-center gap-1 text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200 rounded px-1.5 py-0.5"
                        >
                          🔒 Staff Locked
                        </span>
                      ) : (
                        <span
                          title="Unlocked: AI will classify"
                          className="inline-flex items-center gap-1 text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200 rounded px-1.5 py-0.5"
                        >
                          🤖 AI Managed
                        </span>
                      )}

                      <Tag tone={consentTone}>{consentLabel}</Tag>
                      {c.lead_source === "ad" && (
                        <Tag tone="good">From ad: {c.first_ad_title || "Ad"}</Tag>
                      )}
                      {c.needs_human && <Tag tone="warn">Wants a person</Tag>}
                      {!c.bot_enabled && !c.needs_human && (
                        <Tag tone="neutral">Assistant off</Tag>
                      )}
                    </div>

                    <p className="text-sm text-ink-soft tabular mt-0.5">+{c.phone}</p>

                    {/* Interest Topic & Quote Summary */}
                    {(c.interest_topic || c.quote_summary) && (
                      <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs">
                        {c.interest_topic && (
                          <span className="inline-flex items-center gap-1 text-slate-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-0.5">
                            <strong className="text-emerald-800 font-semibold">Topic:</strong>{" "}
                            {c.interest_topic}
                          </span>
                        )}
                        {c.quote_summary && (
                          <span className="inline-flex items-center gap-1 text-slate-700 bg-indigo-50 border border-indigo-200 rounded px-2 py-0.5">
                            <strong className="text-indigo-800 font-semibold">Quote:</strong>{" "}
                            {c.quote_summary}
                          </span>
                        )}
                      </div>
                    )}

                    {c.summary && (
                      <p className="text-sm text-ink-soft mt-1 line-clamp-2">{c.summary}</p>
                    )}

                    {/* Quick Staff Editor Drawer / Form */}
                    {isEditing && (
                      <div className="mt-3 p-3.5 bg-panel border border-pine/30 rounded-lg shadow-sm space-y-3">
                        <div className="text-xs font-semibold text-pine uppercase tracking-wider">
                          Staff Classification Controls
                        </div>
                        <div className="grid sm:grid-cols-2 gap-3 text-xs">
                          <div>
                            <label className="block font-medium text-ink mb-1">Intent</label>
                            <select
                              value={editIntent}
                              onChange={(e) => setEditIntent(e.target.value as ContactIntent)}
                              className="w-full rounded border border-line bg-canvas px-2.5 py-1.5 text-xs focus:border-pine focus:outline-none"
                            >
                              {INTENT_VALUES.map((v) => (
                                <option key={v} value={v}>
                                  {INTENT_CONFIG[v].label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block font-medium text-ink mb-1">Lead Stage</label>
                            <select
                              value={editStage}
                              onChange={(e) => setEditStage(e.target.value as LeadStage)}
                              className="w-full rounded border border-line bg-canvas px-2.5 py-1.5 text-xs focus:border-pine focus:outline-none"
                            >
                              {STAGE_VALUES.map((v) => (
                                <option key={v} value={v}>
                                  {STAGE_CONFIG[v].label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block font-medium text-ink mb-1">Interest Topic</label>
                            <input
                              value={editTopic}
                              onChange={(e) => setEditTopic(e.target.value)}
                              placeholder="e.g. Full Body Detailing"
                              className="w-full rounded border border-line bg-canvas px-2.5 py-1.5 text-xs focus:border-pine focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block font-medium text-ink mb-1">Quote Summary</label>
                            <input
                              value={editQuote}
                              onChange={(e) => setEditQuote(e.target.value)}
                              placeholder="e.g. QAR 1,200 for 2 cars"
                              className="w-full rounded border border-line bg-canvas px-2.5 py-1.5 text-xs focus:border-pine focus:outline-none"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-line/60">
                          <button
                            type="button"
                            onClick={(e) => resetAi(c.phone, e)}
                            disabled={saving}
                            className="text-xs text-ink-soft hover:text-ink font-medium px-2 py-1 rounded hover:bg-canvas border border-dashed border-line"
                            title="Resets intent to unknown and removes staff lock"
                          >
                            🤖 Let AI decide again
                          </button>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={cancelEdit}
                              disabled={saving}
                              className="text-xs text-ink-soft hover:text-ink px-2.5 py-1 rounded"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={(e) => saveContact(c.phone, e)}
                              disabled={saving}
                              className="text-xs bg-pine text-white hover:bg-pine-deep px-3 py-1 rounded font-medium"
                            >
                              {saving ? "Saving…" : "Save (Locks to Staff)"}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between shrink-0 gap-2">
                    <p className="text-xs text-ink-faint tabular">{timeAgo(c.last_message_at)}</p>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/chats?phone=${c.phone}`}
                        className="text-xs text-pine hover:underline font-medium"
                      >
                        Open chat →
                      </Link>
                      {!isEditing && (
                        <button
                          type="button"
                          onClick={(e) => startEdit(c, e)}
                          className="text-xs bg-canvas hover:bg-panel border border-line rounded px-2 py-1 text-ink-soft hover:text-ink"
                        >
                          Edit Intent
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <Toast message={message} />
    </>
  );
}
