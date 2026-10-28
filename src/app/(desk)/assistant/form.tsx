"use client";

import { useState } from "react";
import { Button, Field, inputClass, Panel, PageHead, Toast, useToast } from "@/components/ui";
import {
  validateFollowupTemplate,
  validateFollowupHours,
  renderFollowupMessage,
  ENQUIRY_ALLOWED_VARS,
  QUOTED_ALLOWED_VARS,
} from "@/lib/followups";

const ZONES = ["Asia/Qatar", "Asia/Dubai", "Asia/Riyadh", "Asia/Kuwait", "Asia/Kolkata", "Europe/London"];

export default function AssistantForm({ initial, readOnly }: { initial: any; readOnly: boolean }) {
  const [f, setF] = useState({
    business_name: initial?.business_name ?? "",
    bot_name: initial?.bot_name ?? "",
    persona_prompt: initial?.persona_prompt ?? "",
    business_info: initial?.business_info ?? "",
    timezone: initial?.timezone ?? "Asia/Qatar",
    slot_interval_min: initial?.slot_interval_min ?? 30,
    admin_phone: initial?.admin_phone ?? "",
    bot_enabled: initial?.bot_enabled ?? true,
    reminder_24h_template: initial?.reminder_24h_template ?? "",
    reminder_1h_template: initial?.reminder_1h_template ?? "",
    followup_enabled: initial?.followup_enabled ?? true,
    followup_after_hours: initial?.followup_after_hours ?? 72,
    followup_template: initial?.followup_template ?? "",
    followup_template_enquiry:
      initial?.followup_template_enquiry ||
      "Hi {name}, just checking in regarding {topic} — let us know if you have any questions!",
    followup_template_quoted:
      initial?.followup_template_quoted ||
      "Hi {name}, following up on your quote for {topic} ({quote}) — let us know if you would like to proceed!",
    review_enabled: initial?.review_enabled ?? true,
    review_delay_hours: initial?.review_delay_hours ?? 2,
    review_link: initial?.review_link ?? "",
    review_template: initial?.review_template ?? "",
  });
  const [busy, setBusy] = useState(false);
  const { message, show } = useToast();

  async function save(e: React.FormEvent) {
    e.preventDefault();

    // Validate hours (24 to 168)
    const hoursVal = validateFollowupHours(f.followup_after_hours);
    if (!hoursVal.ok) {
      show(hoursVal.error || "Hours must be between 24 and 168.");
      return;
    }

    // Validate enquiry template
    const enqVal = validateFollowupTemplate(
      f.followup_template_enquiry,
      ENQUIRY_ALLOWED_VARS,
      "Enquiry follow-up template"
    );
    if (!enqVal.ok) {
      show(enqVal.error || "Invalid enquiry follow-up template.");
      return;
    }

    // Validate quoted template
    const quotVal = validateFollowupTemplate(
      f.followup_template_quoted,
      QUOTED_ALLOWED_VARS,
      "Quote follow-up template"
    );
    if (!quotVal.ok) {
      show(quotVal.error || "Invalid quote follow-up template.");
      return;
    }

    setBusy(true);
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(f),
    });
    const data = await res.json();
    setBusy(false);
    if (data.ok) {
      show("Saved. The assistant uses this from its next reply.");
    } else {
      show(data.message || data.error || "Could not save.");
    }
  }

  const enqValidation = validateFollowupTemplate(
    f.followup_template_enquiry,
    ENQUIRY_ALLOWED_VARS,
    "Enquiry template"
  );
  const quoteValidation = validateFollowupTemplate(
    f.followup_template_quoted,
    QUOTED_ALLOWED_VARS,
    "Quote template"
  );

  return (
    <div className="p-6 lg:p-8 max-w-3xl">
      <PageHead
        title="Assistant"
        lead="How your AI colleague introduces itself, what it knows, and when it stays quiet."
      />

      <form onSubmit={save} className="space-y-5">
        <Panel>
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1"
              disabled={readOnly}
              checked={f.bot_enabled}
              onChange={(e) => setF({ ...f, bot_enabled: e.target.checked })}
            />
            <span>
              <span className="font-medium">Answer new messages automatically</span>
              <span className="block text-sm text-ink-soft">
                Turn this off and every chat waits for your team instead.
              </span>
            </span>
          </label>
        </Panel>

        <Panel className="space-y-4">
          <h2 className="font-semibold">Who it is</h2>
          <Field label="Business name">
            <input
              className={inputClass}
              disabled={readOnly}
              value={f.business_name}
              onChange={(e) => setF({ ...f, business_name: e.target.value })}
            />
          </Field>
          <Field label="Name it answers by" hint="Customers see this name in chat.">
            <input
              className={inputClass}
              disabled={readOnly}
              value={f.bot_name}
              onChange={(e) => setF({ ...f, bot_name: e.target.value })}
            />
          </Field>
          <Field
            label="How it should behave"
            hint="Plain instructions: tone, what to ask, how to handle prices."
          >
            <textarea
              rows={8}
              className={inputClass}
              disabled={readOnly}
              value={f.persona_prompt}
              onChange={(e) => setF({ ...f, persona_prompt: e.target.value })}
            />
          </Field>
          <Field
            label="Facts it may state"
            hint="Address, parking, payment, policies. It will not invent anything outside this."
          >
            <textarea
              rows={5}
              className={inputClass}
              disabled={readOnly}
              value={f.business_info}
              onChange={(e) => setF({ ...f, business_info: e.target.value })}
            />
          </Field>
        </Panel>

        <Panel className="space-y-4">
          <h2 className="font-semibold">Booking and alerts</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Time zone">
              <select
                className={inputClass}
                disabled={readOnly}
                value={f.timezone}
                onChange={(e) => setF({ ...f, timezone: e.target.value })}
              >
                {ZONES.map((z) => (
                  <option key={z}>{z}</option>
                ))}
              </select>
            </Field>
            <Field label="Slot spacing in minutes">
              <input
                className={`${inputClass} tabular`}
                type="number"
                min={5}
                step={5}
                disabled={readOnly}
                value={f.slot_interval_min}
                onChange={(e) => setF({ ...f, slot_interval_min: Number(e.target.value) })}
              />
            </Field>
          </div>
          <Field
            label="Alert number"
            hint="Gets a WhatsApp ping when a customer wants a person. Digits only."
          >
            <input
              className={`${inputClass} tabular`}
              disabled={readOnly}
              value={f.admin_phone}
              onChange={(e) => setF({ ...f, admin_phone: e.target.value })}
            />
          </Field>
        </Panel>

        <Panel className="space-y-4">
          <h2 className="font-semibold">Reminder messages</h2>
          <p className="text-sm text-ink-soft">
            Use {"{name}"}, {"{service}"} and {"{time}"} — they are filled in for each customer.
          </p>
          <Field label="Sent a day before">
            <textarea
              rows={2}
              className={inputClass}
              disabled={readOnly}
              value={f.reminder_24h_template}
              onChange={(e) => setF({ ...f, reminder_24h_template: e.target.value })}
            />
          </Field>
          <Field label="Sent an hour before">
            <textarea
              rows={2}
              className={inputClass}
              disabled={readOnly}
              value={f.reminder_1h_template}
              onChange={(e) => setF({ ...f, reminder_1h_template: e.target.value })}
            />
          </Field>
        </Panel>

        <Panel className="space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold text-ink">Follow-up Controls for Real Enquiries</h2>
              <p className="text-xs text-ink-soft mt-0.5">
                Automatically follow up with quiet enquiries and prospective quotes.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                disabled={readOnly}
                checked={f.followup_enabled}
                onChange={(e) => setF({ ...f, followup_enabled: e.target.checked })}
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pine"></div>
            </label>
          </div>

          {/* Short note required by spec */}
          <div className="rounded-lg border border-blue-200/80 bg-blue-50/60 p-3 text-xs text-blue-900 flex items-start gap-2.5">
            <span className="text-blue-600 font-bold text-sm shrink-0 mt-[-1px]">ℹ</span>
            <span>
              <strong>Follow-up delivery rule:</strong> Sent at most twice, only to people who made a real enquiry and went quiet, between 09:00 and 21:00.
            </span>
          </div>

          <Field
            label="After how many hours (24 to 168)"
            hint="Minimum 24 hours (1 day), maximum 168 hours (7 days) of silence."
          >
            <div className="flex items-center gap-2 max-w-xs">
              <input
                className={`${inputClass} tabular`}
                type="number"
                min={24}
                max={168}
                step={1}
                disabled={readOnly}
                value={f.followup_after_hours}
                onChange={(e) => setF({ ...f, followup_after_hours: Number(e.target.value) })}
              />
              <span className="text-xs font-medium text-ink-soft shrink-0">hours</span>
            </div>
          </Field>

          {/* Template 1: Enquiry follow-up */}
          <div className="space-y-3 pt-3 border-t border-line">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-ink">1. Enquiry follow-up</h3>
                <p className="text-xs text-ink-soft">
                  Sent to contacts with intent <em>enquiry</em> and stage <em>enquiry</em> or <em>negotiating</em>.
                </p>
              </div>
              <span
                className={`text-xs font-mono tabular ${
                  f.followup_template_enquiry.length > 300
                    ? "text-rose-600 font-bold"
                    : "text-ink-faint"
                }`}
              >
                {f.followup_template_enquiry.length}/300 chars
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-ink-faint">Available variables:</span>
              <button
                type="button"
                disabled={readOnly}
                onClick={() =>
                  setF({
                    ...f,
                    followup_template_enquiry: f.followup_template_enquiry + " {name}",
                  })
                }
                className="px-2 py-0.5 rounded bg-pine-wash text-pine hover:bg-pine/20 font-mono text-[11px]"
              >
                +&#123;name&#125;
              </button>
              <button
                type="button"
                disabled={readOnly}
                onClick={() =>
                  setF({
                    ...f,
                    followup_template_enquiry: f.followup_template_enquiry + " {topic}",
                  })
                }
                className="px-2 py-0.5 rounded bg-pine-wash text-pine hover:bg-pine/20 font-mono text-[11px]"
              >
                +&#123;topic&#125;
              </button>
            </div>

            <textarea
              rows={3}
              maxLength={350}
              className={`${inputClass} ${!enqValidation.ok ? "border-rose-400 focus:border-rose-500" : ""}`}
              disabled={readOnly}
              value={f.followup_template_enquiry}
              onChange={(e) => setF({ ...f, followup_template_enquiry: e.target.value })}
            />

            {!enqValidation.ok && (
              <p className="text-xs text-rose-600 font-medium">⚠️ {enqValidation.error}</p>
            )}

            {/* Live Preview */}
            <div className="rounded-lg border border-line bg-canvas/60 p-3 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
                <span>💬 Live Preview (WhatsApp)</span>
                <span className="text-[10px] lowercase text-ink-faint">sample: name=Sarah, topic=Ceramic Coating</span>
              </div>
              <div className="bg-[#DCF8C6] dark:bg-emerald-950/60 border border-emerald-200/60 dark:border-emerald-800/60 rounded-xl p-3 shadow-2xs text-xs text-slate-800 dark:text-emerald-100 max-w-md">
                {renderFollowupMessage(f.followup_template_enquiry, {
                  name: "Sarah",
                  topic: "Ceramic Coating",
                }) || <span className="text-ink-faint italic">Empty message</span>}
                <div className="text-[10px] text-emerald-800/60 dark:text-emerald-400/60 text-right mt-1">
                  10:30 AM ✓✓
                </div>
              </div>
            </div>
          </div>

          {/* Template 2: Quote follow-up */}
          <div className="space-y-3 pt-3 border-t border-line">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-ink">2. Quote follow-up</h3>
                <p className="text-xs text-ink-soft">
                  Sent to contacts who received a pricing quotation (stage: <em>quoted</em>).
                </p>
              </div>
              <span
                className={`text-xs font-mono tabular ${
                  f.followup_template_quoted.length > 300
                    ? "text-rose-600 font-bold"
                    : "text-ink-faint"
                }`}
              >
                {f.followup_template_quoted.length}/300 chars
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-ink-faint">Available variables:</span>
              <button
                type="button"
                disabled={readOnly}
                onClick={() =>
                  setF({
                    ...f,
                    followup_template_quoted: f.followup_template_quoted + " {name}",
                  })
                }
                className="px-2 py-0.5 rounded bg-pine-wash text-pine hover:bg-pine/20 font-mono text-[11px]"
              >
                +&#123;name&#125;
              </button>
              <button
                type="button"
                disabled={readOnly}
                onClick={() =>
                  setF({
                    ...f,
                    followup_template_quoted: f.followup_template_quoted + " {topic}",
                  })
                }
                className="px-2 py-0.5 rounded bg-pine-wash text-pine hover:bg-pine/20 font-mono text-[11px]"
              >
                +&#123;topic&#125;
              </button>
              <button
                type="button"
                disabled={readOnly}
                onClick={() =>
                  setF({
                    ...f,
                    followup_template_quoted: f.followup_template_quoted + " {quote}",
                  })
                }
                className="px-2 py-0.5 rounded bg-pine-wash text-pine hover:bg-pine/20 font-mono text-[11px]"
              >
                +&#123;quote&#125;
              </button>
            </div>

            <textarea
              rows={3}
              maxLength={350}
              className={`${inputClass} ${!quoteValidation.ok ? "border-rose-400 focus:border-rose-500" : ""}`}
              disabled={readOnly}
              value={f.followup_template_quoted}
              onChange={(e) => setF({ ...f, followup_template_quoted: e.target.value })}
            />

            {!quoteValidation.ok && (
              <p className="text-xs text-rose-600 font-medium">⚠️ {quoteValidation.error}</p>
            )}

            {/* Live Preview */}
            <div className="rounded-lg border border-line bg-canvas/60 p-3 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
                <span>💬 Live Preview (WhatsApp)</span>
                <span className="text-[10px] lowercase text-ink-faint">sample: name=Sarah, topic=Ceramic Coating, quote=QAR 1,500</span>
              </div>
              <div className="bg-[#DCF8C6] dark:bg-emerald-950/60 border border-emerald-200/60 dark:border-emerald-800/60 rounded-xl p-3 shadow-2xs text-xs text-slate-800 dark:text-emerald-100 max-w-md">
                {renderFollowupMessage(f.followup_template_quoted, {
                  name: "Sarah",
                  topic: "Ceramic Coating",
                  quote: "QAR 1,500",
                }) || <span className="text-ink-faint italic">Empty message</span>}
                <div className="text-[10px] text-emerald-800/60 dark:text-emerald-400/60 text-right mt-1">
                  10:30 AM ✓✓
                </div>
              </div>
            </div>
          </div>
        </Panel>

        <Panel className="space-y-4">
          <h2 className="font-semibold">Review requests</h2>
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1"
              disabled={readOnly}
              checked={f.review_enabled}
              onChange={(e) => setF({ ...f, review_enabled: e.target.checked })}
            />
            <span>
              <span className="font-medium">Ask for a review after a completed appointment</span>
              <span className="block text-sm text-ink-soft">
                Sent automatically once you mark an appointment as done.
              </span>
            </span>
          </label>
          <Field label="Wait this many hours after completion">
            <input
              className={`${inputClass} tabular`}
              type="number"
              min={1}
              disabled={readOnly}
              value={f.review_delay_hours}
              onChange={(e) => setF({ ...f, review_delay_hours: Number(e.target.value) })}
            />
          </Field>
          <Field
            label="Review link"
            hint="Your Google review link or any link you want customers to open."
          >
            <input
              className={inputClass}
              disabled={readOnly}
              value={f.review_link}
              onChange={(e) => setF({ ...f, review_link: e.target.value })}
            />
          </Field>
          <Field
            label="Review request message"
            hint="Use {name}, {service} and {link} — all filled in automatically."
          >
            <textarea
              rows={3}
              className={inputClass}
              disabled={readOnly}
              value={f.review_template}
              onChange={(e) => setF({ ...f, review_template: e.target.value })}
            />
          </Field>
        </Panel>

        {!readOnly && (
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
          </Button>
        )}
      </form>
      <Toast message={message} />
    </div>
  );
}
