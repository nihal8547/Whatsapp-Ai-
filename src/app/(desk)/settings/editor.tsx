"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, inputClass, Panel, PageHead, Tag, Toast, useToast } from "@/components/ui";

type BusinessPackItem = {
  code: string;
  name: string;
  modules: string[];
  labels: Record<string, string>;
  persona_rules: string;
  version: number;
};

const ALL_MODULES = [
  { code: "appointments", name: "Appointments & Bookings", desc: "Manage client bookings, calendars, and working hours.", built: true },
  { code: "orders", name: "Orders & Cart", desc: "Take customer orders directly via WhatsApp.", built: true },
  { code: "catalog", name: "Catalog / Products", desc: "Browse products, room types, or menu items.", built: true },
  { code: "leads", name: "Leads & Enquiries", desc: "Track sales opportunities and follow up with hot prospects.", built: true },
  { code: "ads", name: "Ad Playbooks", desc: "Automate custom responses and media for ad campaign leads.", built: true },
  { code: "faq", name: "FAQ Knowledge Base", desc: "Answer recurring questions automatically from verified answers.", built: true },
  { code: "media", name: "Media Library", desc: "Share brochures, pricing PDFs, and photos with customers.", built: true },
  { code: "stays", name: "Stays & Hospitality", desc: "Hotel room check-in and reservation management.", built: false },
  { code: "resources", name: "Staff / Tables / Rooms", desc: "Assign stylists, tables, or doctors to bookings.", built: false },
  { code: "quotes", name: "Custom Quotes", desc: "Prepare bespoke price estimates for complex requests.", built: false },
  { code: "table_booking", name: "Table Booking", desc: "Accept restaurant dining reservations by party size.", built: false },
];

export default function SettingsEditor({
  isOwner,
  currentPack,
  activeModules,
  labels,
  availablePacks,
  broadcastSettings,
  platformDailyMax = 200,
}: {
  tenantId: number;
  isOwner: boolean;
  currentPack: { code: string; name: string; modules: string[]; labels: Record<string, string> };
  activeModules: string[];
  labels: Record<string, string>;
  availablePacks: BusinessPackItem[];
  broadcastSettings?: {
    enabled: boolean;
    daily_cap: number;
    hourly_cap: number;
    window_start: string;
    window_end: string;
  };
  platformDailyMax?: number;
}) {
  const router = useRouter();
  const [selectedPack, setSelectedPack] = useState(currentPack.code);
  const [modules, setModules] = useState<string[]>(activeModules);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [busyPack, setBusyPack] = useState(false);
  const [busyModules, setBusyModules] = useState(false);
  const { message, show } = useToast();

  const [bcSettings, setBcSettings] = useState(
    broadcastSettings ?? {
      enabled: true,
      daily_cap: 100,
      hourly_cap: 25,
      window_start: "09:00",
      window_end: "21:00",
    }
  );
  const [savingBc, setSavingBc] = useState(false);

  async function saveBroadcastSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!isOwner) return;
    if (bcSettings.daily_cap > platformDailyMax) {
      return show(`Daily cap cannot exceed platform limit of ${platformDailyMax} messages/day.`);
    }
    if (bcSettings.hourly_cap > 40) {
      return show("Hourly cap cannot exceed 40 messages/hour.");
    }
    setSavingBc(true);
    try {
      const res = await fetch("/api/settings/broadcast", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bcSettings),
      });
      const data = await res.json();
      if (!data.ok) {
        show(data.message || data.error || "Failed to save broadcast settings.");
      } else {
        show("Broadcast settings saved.");
      }
    } catch {
      show("Network error.");
    } finally {
      setSavingBc(false);
    }
  }

  function toggleModule(code: string) {
    if (!isOwner) return;
    if (modules.includes(code)) {
      setModules(modules.filter((m) => m !== code));
    } else {
      setModules([...modules, code]);
    }
  }

  async function saveModules() {
    if (!isOwner) return;
    setBusyModules(true);
    try {
      const res = await fetch("/api/settings/modules", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ modules }),
      });
      const data = await res.json();
      if (data.ok) {
        show("Modules updated successfully");
        router.refresh();
      } else {
        show(data.error || "Failed to update modules");
      }
    } catch {
      show("Network error saving modules");
    } finally {
      setBusyModules(false);
    }
  }

  async function resetModulesToPack() {
    if (!isOwner) return;
    setBusyModules(true);
    try {
      const res = await fetch("/api/settings/modules", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ modules: null }),
      });
      const data = await res.json();
      if (data.ok) {
        show("Modules reset to pack defaults");
        setModules(currentPack.modules || []);
        router.refresh();
      } else {
        show("Failed to reset modules");
      }
    } catch {
      show("Error resetting modules");
    } finally {
      setBusyModules(false);
    }
  }

  async function changeBusinessType() {
    if (!isOwner) return;
    setBusyPack(true);
    try {
      const res = await fetch("/api/settings/pack", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ packCode: selectedPack }),
      });
      const data = await res.json();
      if (data.ok) {
        show("Business type changed — nothing was deleted");
        setShowConfirmModal(false);
        router.refresh();
      } else {
        show(data.error || "Failed to change business type");
      }
    } catch {
      show("Error changing business type");
    } finally {
      setBusyPack(false);
    }
  }

  return (
    <div className="p-6 lg:p-8 max-w-5xl space-y-8">
      <Toast message={message} />

      <PageHead
        title="Workspace Settings"
        lead="Customize your business classification, active modules, and AI assistant settings."
      />

      {/* Business Type Card */}
      <Panel className="space-y-5">
        <div>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h3 className="font-semibold text-base text-ink">Business Type</h3>
            <Tag tone="good">{currentPack.name}</Tag>
          </div>
          <p className="text-xs text-ink-soft mt-1">
            Determines the default AI personality rules, starter services, and terminology ({labels.customer || "Customer"} / {labels.appointment || "Appointment"}).
          </p>
        </div>

        {isOwner ? (
          <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="w-full sm:w-80">
              <Field label="Select new business pack">
                <select
                  className={inputClass}
                  value={selectedPack}
                  onChange={(e) => setSelectedPack(e.target.value)}
                >
                  {availablePacks.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Button
              className="mt-6"
              variant="quiet"
              disabled={selectedPack === currentPack.code || busyPack}
              onClick={() => setShowConfirmModal(true)}
            >
              Change business type
            </Button>
          </div>
        ) : (
          <p className="text-xs text-ink-soft italic">
            Only the workspace owner can switch business types.
          </p>
        )}
      </Panel>

      {/* Broadcast Campaign Settings (Owner) */}
      <Panel className="space-y-5">
        <div>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h3 className="font-semibold text-base text-ink">Broadcast Campaign Settings</h3>
            <Tag tone={bcSettings.enabled ? "good" : "neutral"}>
              {bcSettings.enabled ? "Enabled" : "Disabled"}
            </Tag>
          </div>
          <p className="text-xs text-ink-soft mt-1">
            Configure sending limits and quiet hours for bulk outbound campaigns sent via n8n.
          </p>
        </div>

        {isOwner ? (
          <form onSubmit={saveBroadcastSettings} className="space-y-4">
            <div className="flex items-center gap-2.5">
              <input
                type="checkbox"
                id="bc-enabled"
                checked={bcSettings.enabled}
                onChange={(e) => setBcSettings({ ...bcSettings, enabled: e.target.checked })}
                className="rounded text-pine focus:ring-pine cursor-pointer"
              />
              <label htmlFor="bc-enabled" className="text-sm font-medium text-ink cursor-pointer select-none">
                Enable broadcast campaigns for this workspace
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
              <Field
                label="Daily Cap"
                hint={`Max allowed: ${platformDailyMax} msgs/day`}
              >
                <input
                  type="number"
                  min={1}
                  max={platformDailyMax}
                  value={bcSettings.daily_cap}
                  onChange={(e) => setBcSettings({ ...bcSettings, daily_cap: Number(e.target.value) })}
                  className={inputClass}
                  required
                />
              </Field>

              <Field
                label="Hourly Cap"
                hint="Max 40 messages/hour"
              >
                <input
                  type="number"
                  min={1}
                  max={40}
                  value={bcSettings.hourly_cap}
                  onChange={(e) => setBcSettings({ ...bcSettings, hourly_cap: Number(e.target.value) })}
                  className={inputClass}
                  required
                />
              </Field>

              <Field
                label="Sending Window Start"
                hint="Do not send before this time"
              >
                <input
                  type="time"
                  value={bcSettings.window_start}
                  onChange={(e) => setBcSettings({ ...bcSettings, window_start: e.target.value })}
                  className={inputClass}
                  required
                />
              </Field>

              <Field
                label="Sending Window End"
                hint="Do not send after this time"
              >
                <input
                  type="time"
                  value={bcSettings.window_end}
                  onChange={(e) => setBcSettings({ ...bcSettings, window_end: e.target.value })}
                  className={inputClass}
                  required
                />
              </Field>
            </div>

            <div className="pt-2 flex justify-end">
              <Button type="submit" disabled={savingBc}>
                {savingBc ? "Saving..." : "Save Broadcast Settings"}
              </Button>
            </div>
          </form>
        ) : (
          <p className="text-xs text-ink-soft italic">
            Only the workspace owner can update broadcast limits and quiet hours.
          </p>
        )}
      </Panel>

      {/* Modules Configuration */}
      <Panel className="space-y-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h3 className="font-semibold text-base text-ink">Active Modules</h3>
            <p className="text-xs text-ink-soft mt-1">
              Toggle dashboard features and navigation links for this workspace.
            </p>
          </div>
          {isOwner && (
            <div className="flex items-center gap-2">
              <Button className="py-1 px-2.5 text-xs" variant="quiet" onClick={resetModulesToPack} disabled={busyModules}>
                Reset to Pack Defaults
              </Button>
              <Button className="py-1 px-2.5 text-xs" onClick={saveModules} disabled={busyModules}>
                {busyModules ? "Saving..." : "Save Modules"}
              </Button>
            </div>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 pt-2">
          {ALL_MODULES.map((mod) => {
            const isEnabled = modules.includes(mod.code);

            return (
              <div
                key={mod.code}
                onClick={() => (mod.built ? toggleModule(mod.code) : null)}
                className={`p-4 rounded-lg border transition-all flex flex-col justify-between ${
                  !mod.built
                    ? "opacity-60 bg-canvas/60 border-line cursor-not-allowed"
                    : isEnabled
                    ? "bg-pine-wash/20 border-pine cursor-pointer hover:shadow-sm"
                    : "bg-panel border-line cursor-pointer hover:border-line-deep"
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-medium text-sm text-ink">{mod.name}</h4>
                    {!mod.built ? (
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-line/60 text-ink-soft">
                        Coming Soon
                      </span>
                    ) : isEnabled ? (
                      <Tag tone="good">Active</Tag>
                    ) : (
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-canvas text-ink-soft">
                        Disabled
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-ink-soft mt-1.5">{mod.desc}</p>
                </div>

                {mod.built && isOwner && (
                  <div className="pt-3 flex justify-end">
                    <span className="text-xs text-pine font-medium">
                      {isEnabled ? "Click to disable" : "Click to enable"}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Panel>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-xs">
          <Panel className="max-w-md w-full space-y-4 shadow-xl">
            <h3 className="font-semibold text-lg text-ink">Change Business Type?</h3>
            <div className="text-sm text-ink-soft space-y-2 leading-relaxed">
              <p>
                Switching to{" "}
                <strong className="text-ink">
                  {availablePacks.find((p) => p.code === selectedPack)?.name}
                </strong>{" "}
                will update your workspace terminology, active modules, and starter templates.
              </p>
              <div className="p-3 rounded-md bg-pine-wash/40 border border-pine/30 text-pine-deep text-xs">
                ✓ <strong>Nothing will be deleted:</strong> all of your existing services, operating hours, client contacts, chat logs, and custom prompts are safely kept.
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="quiet"
                disabled={busyPack}
                onClick={() => setShowConfirmModal(false)}
              >
                Cancel
              </Button>
              <Button disabled={busyPack} onClick={changeBusinessType}>
                {busyPack ? "Updating..." : "Yes, change business type"}
              </Button>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
