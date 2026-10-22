"use client";

import { useState } from "react";
import { Button, Field, inputClass, Panel, PageHead, Toast, useToast } from "@/components/ui";

type PlatformSettings = {
  dashboard_url: string;
  alert_phone: string;
  alert_instance: string;
  webhook_secret_enforced: boolean;
  evolution_url: string;
  webhook_url: string;
  broadcast_daily_max?: number;
  proactive_enabled?: boolean;
};

export default function SettingsManager({ initialSettings }: { initialSettings: PlatformSettings }) {
  const { message, show } = useToast();
  const [ps, setPs] = useState(initialSettings);
  const [savingPs, setSavingPs] = useState(false);

  async function savePlatformSettings(e: React.FormEvent) {
    e.preventDefault();
    setSavingPs(true);
    const res = await fetch("/api/admin/platform-settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(ps),
    });
    setSavingPs(false);
    const d = await res.json();
    show(d.ok ? "Platform settings saved." : "Could not save platform settings.");
  }

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      <div>
        <PageHead title="Platform Settings" lead="Evolution API credentials, safety kill-switches, and broadcast caps." />
        <Panel>
          <form onSubmit={savePlatformSettings} className="grid sm:grid-cols-2 gap-4">
            <Field label="Dashboard Public URL" hint="Used to build media image links sent by the WhatsApp bot.">
              <input
                className={inputClass}
                type="url"
                placeholder="https://ai.webbea.qa"
                value={ps.dashboard_url}
                onChange={e => setPs({ ...ps, dashboard_url: e.target.value })}
              />
            </Field>

            <Field label="Alert WhatsApp Number" hint="Platform admin receives urgent system error alerts here.">
              <input
                className={inputClass}
                placeholder="+974xxxxxxxx"
                value={ps.alert_phone}
                onChange={e => setPs({ ...ps, alert_phone: e.target.value })}
              />
            </Field>

            <Field label="Alert WhatsApp Instance" hint="Which Evolution instance sends the system alerts.">
              <input
                className={inputClass}
                placeholder="instance-name"
                value={ps.alert_instance}
                onChange={e => setPs({ ...ps, alert_instance: e.target.value })}
              />
            </Field>

            <Field label="Broadcast Platform Daily Max" hint="Global maximum broadcast messages any tenant can send per day.">
              <input
                className={inputClass}
                type="number"
                min={1}
                placeholder="200"
                value={ps.broadcast_daily_max ?? 200}
                onChange={e => setPs({ ...ps, broadcast_daily_max: Number(e.target.value) })}
              />
            </Field>

            <Field label="Evolution API Host (Read-only)">
              <input className={`${inputClass} opacity-60 cursor-not-allowed`} readOnly value={ps.evolution_url} />
            </Field>

            <Field label="Inbound Webhook URL (Read-only)">
              <input className={`${inputClass} opacity-60 cursor-not-allowed`} readOnly value={ps.webhook_url} />
            </Field>

            <div className="sm:col-span-2 flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded text-pine focus:ring-pine"
                  checked={!!ps.webhook_secret_enforced}
                  onChange={e => setPs({ ...ps, webhook_secret_enforced: e.target.checked })}
                />
                <span className="font-medium text-ink">Enforce webhook secret header</span>
              </label>
            </div>

            <div className="sm:col-span-2 pt-3 border-t border-line">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 rounded text-pine focus:ring-pine"
                  checked={ps.proactive_enabled !== false}
                  onChange={e => {
                    const nextVal = e.target.checked;
                    const msg = nextVal
                      ? "Enable automatic proactive messages globally across all workspaces?"
                      : "Are you sure you want to DISABLE automatic proactive messages globally across all workspaces? This will pause all automated outbound bot/system triggers.";
                    if (confirm(msg)) {
                      setPs({ ...ps, proactive_enabled: nextVal });
                    }
                  }}
                />
                <div>
                  <span className="font-medium text-sm text-ink">
                    Global automatic proactive messages enabled
                  </span>
                  <p className="text-xs text-ink-soft mt-0.5">
                    Master kill-switch. When disabled, automatic proactive messages (broadcasts, follow-ups, review requests) are blocked for all workspaces.
                  </p>
                </div>
              </label>
            </div>

            <div className="sm:col-span-2 pt-2">
              <Button type="submit" disabled={savingPs}>
                {savingPs ? "Saving…" : "Save settings"}
              </Button>
            </div>
          </form>
        </Panel>
      </div>
      <Toast message={message} />
    </div>
  );
}
