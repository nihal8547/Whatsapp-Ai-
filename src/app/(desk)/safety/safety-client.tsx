"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Field, inputClass, PageHead, Panel, Tag, Toast, useToast } from "@/components/ui";
import { fullStamp } from "@/lib/format";
import type { SafetySettings } from "@/lib/safety";

export type SafetyInstance = {
  status: string;
  disconnected_since: string | null;
  reconnected_at: string | null;
  proactive_paused_until: string | null;
  pause_reason: string | null;
};

export type SafetyEventItem = {
  id: number;
  kind: string;
  detail: string;
  created_at: string;
};

type Props = {
  initialInstance: SafetyInstance;
  initialSettings: SafetySettings;
  initialEvents: SafetyEventItem[];
  counts: { today: number; hour: number };
  timezone: string;
  platformProactiveEnabled: boolean;
  isOwner: boolean;
  role: string;
};

export default function SafetyClient({
  initialInstance,
  initialSettings,
  initialEvents,
  counts,
  timezone,
  platformProactiveEnabled,
  isOwner,
  role,
}: Props) {
  const { message, show } = useToast();

  const [instance] = useState<SafetyInstance>(initialInstance);
  const [settings, setSettings] = useState<SafetySettings>(initialSettings);
  const [events, setEvents] = useState<SafetyEventItem[]>(initialEvents);
  const [saving, setSaving] = useState(false);
  const [refreshingEvents, setRefreshingEvents] = useState(false);

  const isConnected = instance.status === "connected";

  // Check if paused
  const isPaused = Boolean(
    instance.proactive_paused_until &&
    new Date(instance.proactive_paused_until).getTime() > Date.now()
  );

  // Reconnected < 10 mins ago check
  const reconnectedAgoMinutes = instance.reconnected_at
    ? Math.floor((Date.now() - new Date(instance.reconnected_at).getTime()) / 60000)
    : null;
  const isRecentlyReconnected =
    reconnectedAgoMinutes !== null &&
    reconnectedAgoMinutes >= 0 &&
    reconnectedAgoMinutes < 10;
  const resumeMinutesLeft = Math.max(1, 10 - (reconnectedAgoMinutes ?? 0));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isOwner) {
      show("Only workspace owners can modify safety settings.");
      return;
    }

    // Client-side quick check
    if (settings.hourly_cap < 1 || settings.hourly_cap > 60) {
      show("Hourly cap must be between 1 and 60.");
      return;
    }
    if (settings.daily_cap < 1 || settings.daily_cap > 300) {
      show("Daily cap must be between 1 and 300.");
      return;
    }
    if (settings.window_start >= settings.window_end) {
      show("Sending window start time must be before end time.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/safety", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proactive_enabled: settings.proactive_enabled,
          hourly_cap: Number(settings.hourly_cap),
          daily_cap: Number(settings.daily_cap),
          window_start: settings.window_start,
          window_end: settings.window_end,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        show(data.message || data.error || "Failed to update safety settings.");
      } else {
        setSettings(data.settings);
        show("Safety settings updated successfully.");
      }
    } catch {
      show("Network error while updating settings.");
    } finally {
      setSaving(false);
    }
  }

  async function reloadEvents() {
    setRefreshingEvents(true);
    try {
      const res = await fetch("/api/safety/events");
      const data = await res.json();
      if (data.ok && Array.isArray(data.events)) {
        setEvents(data.events);
      }
    } catch {
      // ignore
    } finally {
      setRefreshingEvents(false);
    }
  }

  function getEventIcon(kind: string) {
    switch (kind) {
      case "disconnected":
        return (
          <div className="w-7 h-7 rounded-full bg-[#f8ebe9] text-brick flex items-center justify-center shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        );
      case "reconnected":
        return (
          <div className="w-7 h-7 rounded-full bg-pine-wash text-pine-deep flex items-center justify-center shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        );
      case "paused_optouts":
      case "paused_admin":
        return (
          <div className="w-7 h-7 rounded-full bg-amber-wash text-amber flex items-center justify-center shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
      case "reply_loop":
        return (
          <div className="w-7 h-7 rounded-full bg-amber-wash text-amber flex items-center justify-center shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
        );
      default:
        return (
          <div className="w-7 h-7 rounded-full bg-canvas text-ink-soft flex items-center justify-center shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
    }
  }

  function getEventTone(kind: string): "good" | "warn" | "bad" | "neutral" {
    switch (kind) {
      case "reconnected":
        return "good";
      case "paused_optouts":
      case "paused_admin":
      case "reply_loop":
        return "warn";
      case "disconnected":
        return "bad";
      default:
        return "neutral";
    }
  }

  return (
    <div className="p-6 max-w-5xl space-y-6">
      <PageHead
        title="WhatsApp Safety"
        lead="Protect your WhatsApp business number from spam flags and temporary bans. Settings are enforced automatically by our delivery engine."
      />

      {/* ── Pause banner ── */}
      {isPaused && (
        <div className="p-4 rounded-lg bg-amber-wash border border-amber/30 text-ink space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber shrink-0 animate-ping" />
            <h2 className="font-semibold text-amber text-base">
              Automatic messages are currently paused
            </h2>
          </div>
          <p className="text-sm">
            {instance.pause_reason || "Automated outbound triggers are paused for account protection."}
          </p>
          <p className="text-xs text-ink-soft">
            Resume time: <strong>{fullStamp(instance.proactive_paused_until!, timezone)}</strong> (in your workspace timezone).
          </p>
        </div>
      )}

      {/* ── Platform master switch warning ── */}
      {!platformProactiveEnabled && (
        <div className="p-3.5 rounded-lg bg-brick/10 border border-brick/30 text-brick text-sm flex items-center justify-between gap-3">
          <div>
            <strong>Notice:</strong> Automatic proactive messaging has been temporarily disabled by the platform administrator across all workspaces.
          </div>
          <Tag tone="bad">Platform Disabled</Tag>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* ── Connection card ── */}
          <Panel>
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="font-semibold text-base">Connection Status</h2>
                <p className="text-xs text-ink-soft mt-0.5">
                  Real-time status of your linked WhatsApp business number.
                </p>
              </div>
              <Tag tone={isConnected ? "good" : "bad"}>
                {isConnected ? "Connected" : "Disconnected"}
              </Tag>
            </div>

            <div className="space-y-3">
              {isConnected ? (
                <div className="flex items-center gap-2 text-sm text-pine-deep font-medium bg-pine-wash p-3 rounded-md">
                  <span className="w-2 h-2 rounded-full bg-pine shrink-0" />
                  <span>WhatsApp is linked and ready to receive and reply to customers.</span>
                </div>
              ) : (
                <div className="space-y-3 bg-[#f8ebe9] p-3.5 rounded-md text-sm text-brick">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">WhatsApp is currently disconnected</p>
                      {instance.disconnected_since && (
                        <p className="text-xs text-ink-soft mt-0.5">
                          Disconnected since {fullStamp(instance.disconnected_since, timezone)}
                        </p>
                      )}
                    </div>
                    <Link href="/whatsapp">
                      <Button variant="danger" className="text-xs py-1.5 px-3">
                        Go to WhatsApp page →
                      </Button>
                    </Link>
                  </div>
                  <p className="text-xs text-ink-soft">
                    Automated messages cannot be delivered while disconnected. Reconnect your session to resume.
                  </p>
                </div>
              )}

              {/* Recently reconnected notice */}
              {isRecentlyReconnected && (
                <div className="p-3 rounded-md bg-amber-wash border border-amber/20 text-xs text-amber font-medium flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber shrink-0" />
                  <span>
                    Recently reconnected, automatic messages resume in {resumeMinutesLeft} minute{resumeMinutesLeft === 1 ? "" : "s"}.
                  </span>
                </div>
              )}
            </div>
          </Panel>

          {/* ── Settings form ── */}
          <Panel>
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="font-semibold text-base">Safety Settings</h2>
                <p className="text-xs text-ink-soft mt-0.5">
                  Hourly and daily pacing controls for automated outbound messages.
                </p>
              </div>
              {!isOwner && (
                <Tag tone="neutral">Staff / Admin: Read-only</Tag>
              )}
            </div>

            {!isOwner && (
              <div className="mb-4 p-3 bg-canvas border border-line rounded text-xs text-ink-soft">
                Only the account owner can modify sending caps and active hours.
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Proactive Enabled toggle */}
              <div className="p-3.5 rounded-lg border border-line bg-canvas/40 flex items-start gap-3">
                <input
                  type="checkbox"
                  id="proactive_enabled"
                  className="mt-1 rounded text-pine focus:ring-pine disabled:cursor-not-allowed"
                  checked={settings.proactive_enabled}
                  disabled={!isOwner || saving}
                  onChange={e => setSettings({ ...settings, proactive_enabled: e.target.checked })}
                />
                <label htmlFor="proactive_enabled" className="text-sm cursor-pointer select-none">
                  <span className="font-medium text-ink block">Enable automatic outbound messages</span>
                  <span className="text-xs text-ink-soft block mt-0.5">
                    Controls automated follow-ups, appointment reminders, and broadcast deliveries. When disabled, the bot will only reply to customer-initiated messages.
                  </span>
                </label>
              </div>

              {/* Hourly Cap */}
              <Field
                label="Hourly Cap (1 - 60 msgs/hour)"
                hint="Maximum automated system messages allowed per rolling hour."
              >
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={1}
                    max={60}
                    className={`${inputClass} max-w-[140px] tabular`}
                    value={settings.hourly_cap}
                    disabled={!isOwner || saving}
                    onChange={e => setSettings({ ...settings, hourly_cap: parseInt(e.target.value) || 1 })}
                    required
                  />
                  <div className="flex items-center gap-1.5 text-xs text-ink-soft">
                    <span>This hour:</span>
                    <Tag tone={counts.hour >= settings.hourly_cap ? "warn" : "neutral"}>
                      {counts.hour} sent
                    </Tag>
                  </div>
                </div>
              </Field>

              {/* Daily Cap */}
              <Field
                label="Daily Cap (1 - 300 msgs/day)"
                hint="Maximum automated system messages allowed per calendar day."
              >
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={1}
                    max={300}
                    className={`${inputClass} max-w-[140px] tabular`}
                    value={settings.daily_cap}
                    disabled={!isOwner || saving}
                    onChange={e => setSettings({ ...settings, daily_cap: parseInt(e.target.value) || 1 })}
                    required
                  />
                  <div className="flex items-center gap-1.5 text-xs text-ink-soft">
                    <span>Today:</span>
                    <Tag tone={counts.today >= settings.daily_cap ? "warn" : "neutral"}>
                      {counts.today} sent
                    </Tag>
                  </div>
                </div>
              </Field>

              {/* Sending Window */}
              <Field
                label="Sending Window"
                hint={`Operating hours for proactive messages in your workspace timezone (${timezone}).`}
              >
                <div className="grid grid-cols-2 gap-3 max-w-sm">
                  <div>
                    <span className="text-xs text-ink-soft block mb-1">Start time</span>
                    <input
                      type="time"
                      className={inputClass}
                      value={settings.window_start}
                      disabled={!isOwner || saving}
                      onChange={e => setSettings({ ...settings, window_start: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <span className="text-xs text-ink-soft block mb-1">End time</span>
                    <input
                      type="time"
                      className={inputClass}
                      value={settings.window_end}
                      disabled={!isOwner || saving}
                      onChange={e => setSettings({ ...settings, window_end: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </Field>

              {isOwner && (
                <div className="pt-2">
                  <Button type="submit" disabled={saving}>
                    {saving ? "Saving…" : "Save safety settings"}
                  </Button>
                </div>
              )}
            </form>
          </Panel>
        </div>

        {/* ── Plain-language tips card ── */}
        <div className="space-y-6">
          <Panel className="bg-canvas/50">
            <h2 className="font-semibold text-base mb-3 flex items-center gap-2">
              <span>Plain-Language Safety Tips</span>
            </h2>
            <ul className="space-y-3.5 text-xs leading-relaxed text-ink-soft">
              <li className="flex items-start gap-2.5">
                <span className="text-pine shrink-0 font-bold">✓</span>
                <div>
                  <strong className="text-ink block">Send only to people who messaged or agreed</strong>
                  Never import cold contacts or send unsolicited promotional messages.
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-pine shrink-0 font-bold">✓</span>
                <div>
                  <strong className="text-ink block">Keep messages useful</strong>
                  Timely reminders, order confirmations, and requested info protect you from spam reports.
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-pine shrink-0 font-bold">✓</span>
                <div>
                  <strong className="text-ink block">Warm up newly connected numbers</strong>
                  New numbers should start with an hourly cap of 10 and daily cap of 40 before ramping up.
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-pine shrink-0 font-bold">✓</span>
                <div>
                  <strong className="text-ink block">STOP is honoured automatically</strong>
                  When any customer replies STOP or unsubscribe, they are instantly excluded from future broadcasts.
                </div>
              </li>
            </ul>
          </Panel>
        </div>
      </div>

      {/* ── Events list (latest 50) ── */}
      <Panel>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-base">Safety Events History</h2>
            <p className="text-xs text-ink-soft mt-0.5">
              Latest 50 safety incidents, disconnections, and rate-limiting triggers.
            </p>
          </div>
          <button
            onClick={reloadEvents}
            disabled={refreshingEvents}
            className="text-xs text-pine hover:underline font-medium"
          >
            {refreshingEvents ? "Refreshing…" : "Refresh events"}
          </button>
        </div>

        {events.length === 0 ? (
          <div className="p-8 text-center text-ink-soft text-sm bg-canvas/30 rounded-lg border border-dashed border-line">
            No safety events recorded yet. Everything is running smoothly.
          </div>
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs font-semibold text-ink-soft">
                  <th className="px-5 py-3">Event</th>
                  <th className="px-5 py-3">Details</th>
                  <th className="px-5 py-3 text-right">Time ({timezone})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {events.map(e => (
                  <tr key={e.id} className="hover:bg-canvas/40 transition-colors">
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        {getEventIcon(e.kind)}
                        <Tag tone={getEventTone(e.kind)}>
                          {e.kind.replace(/_/g, " ")}
                        </Tag>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-ink max-w-md">
                      {e.detail || "No details provided"}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-ink-soft text-right whitespace-nowrap">
                      {fullStamp(e.created_at, timezone)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Toast message={message} />
    </div>
  );
}
