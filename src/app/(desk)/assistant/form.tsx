"use client";

import { useState } from "react";
import { Button, Field, inputClass, Panel, PageHead, Toast, useToast } from "@/components/ui";

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
    review_enabled: initial?.review_enabled ?? true,
    review_delay_hours: initial?.review_delay_hours ?? 2,
    review_link: initial?.review_link ?? "",
    review_template: initial?.review_template ?? "",
  });
  const [busy, setBusy] = useState(false);
  const { message, show } = useToast();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(f),
    });
    const data = await res.json();
    setBusy(false);
    show(data.ok ? "Saved. The assistant uses this from its next reply." : "Could not save.");
  }

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

        <Panel className="space-y-4">
          <h2 className="font-semibold">Follow-up messages</h2>
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1"
              disabled={readOnly}
              checked={f.followup_enabled}
              onChange={(e) => setF({ ...f, followup_enabled: e.target.checked })}
            />
            <span>
              <span className="font-medium">Message customers who go quiet</span>
              <span className="block text-sm text-ink-soft">
                Sends one gentle check-in if a customer stops replying, unless they already have a booking or are talking to your team.
              </span>
            </span>
          </label>
          <Field label="Wait this many hours before following up">
            <input
              className={`${inputClass} tabular`}
              type="number"
              min={1}
              disabled={readOnly}
              value={f.followup_after_hours}
              onChange={(e) => setF({ ...f, followup_after_hours: Number(e.target.value) })}
            />
          </Field>
          <Field
            label="Follow-up message"
            hint="Use {name} — it's filled in for each customer."
          >
            <textarea
              rows={3}
              className={inputClass}
              disabled={readOnly}
              value={f.followup_template}
              onChange={(e) => setF({ ...f, followup_template: e.target.value })}
            />
          </Field>
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
