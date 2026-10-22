"use client";

import { useState } from "react";
import Link from "next/link";
import { Panel, PageHead, Button, Field, inputClass, Tag, Toast } from "@/components/ui";

export type DeliveryZone = {
  id: number;
  name: string;
  fee: number;
  min_order: number;
  active: boolean;
};

export type OrderSettings = {
  accepting_orders: boolean;
  closed_message: string;
  accept_mode: "manual" | "auto";
  pickup: boolean;
  delivery: boolean;
  payment_methods: string[];
  min_order: number;
  prep_minutes: number;
  status_messages: Record<string, string>;
};

const DEFAULT_MESSAGES: Record<string, { label: string; defaultText: string }> = {
  accepted: {
    label: "Accepted",
    defaultText:
      "Your order #{order_no} has been accepted! Total: {total}. Estimated preparation time is {minutes} minutes.",
  },
  preparing: {
    label: "Preparing",
    defaultText: "Your order #{order_no} is now being prepared in our kitchen/store.",
  },
  ready: {
    label: "Ready",
    defaultText: "Good news {name}! Your order #{order_no} is ready.",
  },
  out_for_delivery: {
    label: "Out for Delivery (Delivery orders)",
    defaultText: "Your order #{order_no} is on the way! Our driver will reach you shortly.",
  },
  completed: {
    label: "Completed",
    defaultText: "Thank you {name}! Your order #{order_no} is completed. Enjoy!",
  },
  cancelled: {
    label: "Cancelled",
    defaultText: "Your order #{order_no} has been cancelled. If you have questions, please let us know.",
  },
  rejected: {
    label: "Rejected",
    defaultText: "Sorry {name}, we are unable to accept order #{order_no} at this moment.",
  },
};

type Props = {
  tenantId: number;
  initialSettings: any;
  initialZones: DeliveryZone[];
};

export default function OrderSettingsClient({ tenantId, initialSettings, initialZones }: Props) {
  const [settings, setSettings] = useState<OrderSettings>({
    accepting_orders: initialSettings.accepting_orders !== undefined ? Boolean(initialSettings.accepting_orders) : true,
    closed_message:
      initialSettings.closed_message ||
      "We are currently not accepting new orders at this time. Please check back later!",
    accept_mode: initialSettings.accept_mode === "auto" ? "auto" : "manual",
    pickup: initialSettings.pickup !== undefined ? Boolean(initialSettings.pickup) : true,
    delivery: initialSettings.delivery !== undefined ? Boolean(initialSettings.delivery) : true,
    payment_methods: Array.isArray(initialSettings.payment_methods)
      ? initialSettings.payment_methods
      : ["cod"],
    min_order: initialSettings.min_order !== undefined ? Number(initialSettings.min_order) : 0,
    prep_minutes: initialSettings.prep_minutes !== undefined ? Number(initialSettings.prep_minutes) : 30,
    status_messages: {
      ...Object.fromEntries(Object.entries(DEFAULT_MESSAGES).map(([k, v]) => [k, v.defaultText])),
      ...(initialSettings.status_messages || {}),
    },
  });

  const [zones, setZones] = useState<DeliveryZone[]>(initialZones);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // New Zone Form
  const [newZone, setNewZone] = useState({ name: "", fee: "0", min_order: "0" });
  const [addingZone, setAddingZone] = useState(false);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  async function handleSaveSettings() {
    setSaving(true);
    try {
      const res = await fetch("/api/order-settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (data.ok) {
        showToast("Order settings saved successfully!");
      } else {
        showToast(data.message || data.error || "Failed to save settings.");
      }
    } catch {
      showToast("Error saving order settings.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddZone(e: React.FormEvent) {
    e.preventDefault();
    if (!newZone.name.trim()) return;
    try {
      const res = await fetch("/api/delivery-zones", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: newZone.name.trim(),
          fee: Number(newZone.fee || 0),
          min_order: Number(newZone.min_order || 0),
          active: true,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setZones((prev) => [...prev, data.zone]);
        setNewZone({ name: "", fee: "0", min_order: "0" });
        setAddingZone(false);
        showToast("Delivery zone added.");
      }
    } catch {
      showToast("Failed to add delivery zone.");
    }
  }

  async function toggleZoneActive(zone: DeliveryZone) {
    try {
      const res = await fetch(`/api/delivery-zones/${zone.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ active: !zone.active }),
      });
      const data = await res.json();
      if (data.ok) {
        setZones((prev) =>
          prev.map((z) => (z.id === zone.id ? { ...z, active: !zone.active } : z))
        );
        showToast(`Zone ${!zone.active ? "activated" : "deactivated"}.`);
      }
    } catch {
      showToast("Failed to update zone.");
    }
  }

  async function handleDeleteZone(id: number) {
    if (!confirm("Are you sure you want to remove this delivery zone?")) return;
    try {
      const res = await fetch(`/api/delivery-zones/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) {
        setZones((prev) => prev.filter((z) => z.id !== id));
        showToast("Zone deleted.");
      }
    } catch {
      showToast("Failed to delete zone.");
    }
  }

  function togglePaymentMethod(method: string) {
    setSettings((prev) => {
      const exists = prev.payment_methods.includes(method);
      const next = exists
        ? prev.payment_methods.filter((m) => m !== method)
        : [...prev.payment_methods, method];
      return { ...prev, payment_methods: next.length > 0 ? next : ["cod"] };
    });
  }

  return (
    <div className="p-6 lg:p-8 max-w-5xl space-y-6">
      <Toast message={toast} />

      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs text-ink-soft mb-1">
            <Link href="/orders" className="hover:underline">
              ← Orders Board
            </Link>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Order Settings</h1>
          <p className="text-sm text-ink-soft mt-1">
            Configure order acceptance, fulfillment modes, delivery zones, and customer WhatsApp templates.
          </p>
        </div>

        <Button variant="primary" onClick={handleSaveSettings} disabled={saving}>
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </div>

      {/* General & Acceptance */}
      <Panel>
        <h2 className="font-semibold text-base mb-4">Acceptance & Fulfillment</h2>

        <div className="space-y-4">
          <div className="p-4 bg-canvas/70 border border-line rounded-lg flex items-start justify-between gap-4">
            <div>
              <p className="font-medium text-sm text-ink">Accepting Orders</p>
              <p className="text-xs text-ink-soft mt-0.5">
                When switched off, the WhatsApp AI bot politely notifies customers that ordering is currently paused.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.accepting_orders}
                onChange={(e) => setSettings({ ...settings, accepting_orders: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-line peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-line after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pine"></div>
            </label>
          </div>

          {!settings.accepting_orders && (
            <Field label="Closed Message" hint="Message sent by bot when customer attempts to place an order while closed">
              <input
                type="text"
                value={settings.closed_message}
                onChange={(e) => setSettings({ ...settings, closed_message: e.target.value })}
                className={inputClass}
              />
            </Field>
          )}

          {/* Acceptance Mode Selection Cards */}
          <div className="pt-2 space-y-2">
            <label className="text-sm font-medium block">
              Order Acceptance Mode{" "}
              <span className="text-pine font-semibold">
                ({settings.accept_mode === "auto" ? "⚡ Auto-Accept" : "🛡️ Manual Review"})
              </span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSettings({ ...settings, accept_mode: "manual" })}
                className={`p-4 rounded-xl border text-left transition-all ${
                  settings.accept_mode === "manual"
                    ? "border-pine bg-pine/5 ring-2 ring-pine/20"
                    : "border-line bg-canvas hover:border-ink-soft/40"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🛡️</span>
                    <span className="font-semibold text-sm text-ink">Manual Review</span>
                  </div>
                  {settings.accept_mode === "manual" && (
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-pine text-white px-2 py-0.5 rounded-full">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-xs text-ink-soft mt-1 leading-relaxed">
                  Orders arrive as <strong className="text-ink">New / Pending</strong>. Staff manually verifies customer details and clicks &quot;Accept Order&quot; on the board.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setSettings({ ...settings, accept_mode: "auto" })}
                className={`p-4 rounded-xl border text-left transition-all ${
                  settings.accept_mode === "auto"
                    ? "border-pine bg-pine/5 ring-2 ring-pine/20"
                    : "border-line bg-canvas hover:border-ink-soft/40"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-base">⚡</span>
                    <span className="font-semibold text-sm text-ink">Auto-Accept</span>
                  </div>
                  {settings.accept_mode === "auto" && (
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-pine text-white px-2 py-0.5 rounded-full">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-xs text-ink-soft mt-1 leading-relaxed">
                  Orders are <strong className="text-ink">instantly Accepted</strong>. The bot immediately informs the customer of estimated delivery/prep time and alerts staff.
                </p>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <Field label="Default Preparation Time (Minutes)" hint="Estimated prep time sent to customer upon order acceptance">
              <input
                type="number"
                min="5"
                step="5"
                value={settings.prep_minutes}
                onChange={(e) => setSettings({ ...settings, prep_minutes: Number(e.target.value) })}
                className={inputClass}
              />
            </Field>

            <Field label="Minimum Order Value (QAR)" hint="Optional minimum total amount required to place an order (0 = no minimum)">
              <input
                type="number"
                min="0"
                step="1"
                value={settings.min_order}
                onChange={(e) => setSettings({ ...settings, min_order: Number(e.target.value) })}
                className={inputClass}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="text-sm font-medium block mb-2">Fulfillment Options</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={settings.pickup}
                    onChange={(e) => setSettings({ ...settings, pickup: e.target.checked })}
                    className="rounded text-pine"
                  />
                  <span>Allow Customer Pickup / Takeaway</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={settings.delivery}
                    onChange={(e) => setSettings({ ...settings, delivery: e.target.checked })}
                    className="rounded text-pine"
                  />
                  <span>Allow Home / Office Delivery</span>
                </label>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium block mb-2">Payment Methods</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={settings.payment_methods.includes("cod")}
                    onChange={() => togglePaymentMethod("cod")}
                    className="rounded text-pine"
                  />
                  <span>Cash on Delivery (COD)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={settings.payment_methods.includes("pay_at_pickup")}
                    onChange={() => togglePaymentMethod("pay_at_pickup")}
                    className="rounded text-pine"
                  />
                  <span>Pay at Pickup / Counter</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={settings.payment_methods.includes("bank_transfer")}
                    onChange={() => togglePaymentMethod("bank_transfer")}
                    className="rounded text-pine"
                  />
                  <span>Bank Transfer / Link</span>
                </label>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <Field label="Minimum Order Amount" hint="Orders below this subtotal will be rejected by the bot (0 = no minimum)">
              <input
                type="number"
                min="0"
                step="1"
                value={settings.min_order}
                onChange={(e) => setSettings({ ...settings, min_order: Number(e.target.value) })}
                className={`${inputClass} max-w-xs`}
              />
            </Field>
          </div>
        </div>
      </Panel>

      {/* Delivery Zones */}
      <Panel>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-base">Delivery Zones</h2>
            <p className="text-xs text-ink-soft mt-0.5">
              Specific zones with delivery fees and minimum orders.
            </p>
          </div>
          {!addingZone && (
            <Button variant="quiet" onClick={() => setAddingZone(true)}>
              + Add Zone
            </Button>
          )}
        </div>

        {addingZone && (
          <form onSubmit={handleAddZone} className="p-4 bg-canvas/60 border border-line rounded-lg mb-4 space-y-3 animate-in fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Zone / Area Name">
                <input
                  type="text"
                  required
                  placeholder="e.g. West Bay or Al Sadd"
                  value={newZone.name}
                  onChange={(e) => setNewZone({ ...newZone, name: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="Delivery Fee">
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={newZone.fee}
                  onChange={(e) => setNewZone({ ...newZone, fee: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="Zone Minimum Order">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={newZone.min_order}
                  onChange={(e) => setNewZone({ ...newZone, min_order: e.target.value })}
                  className={inputClass}
                />
              </Field>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="quiet" type="button" onClick={() => setAddingZone(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit">
                Save Zone
              </Button>
            </div>
          </form>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm divide-y divide-line">
            <thead className="bg-canvas/50 text-xs text-ink-soft">
              <tr>
                <th className="py-2.5 px-3">Zone Name</th>
                <th className="py-2.5 px-3">Delivery Fee</th>
                <th className="py-2.5 px-3">Min Order</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {zones.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-xs text-ink-soft">
                    No delivery zones configured.
                  </td>
                </tr>
              ) : (
                zones.map((z) => (
                  <tr key={z.id} className="hover:bg-canvas/40">
                    <td className="py-2.5 px-3 font-medium text-ink">{z.name}</td>
                    <td className="py-2.5 px-3 tabular">QAR {Number(z.fee).toFixed(2)}</td>
                    <td className="py-2.5 px-3 tabular">
                      {Number(z.min_order) > 0 ? `QAR ${Number(z.min_order).toFixed(2)}` : "None"}
                    </td>
                    <td className="py-2.5 px-3">
                      <Tag tone={z.active ? "good" : "neutral"}>
                        {z.active ? "Active" : "Inactive"}
                      </Tag>
                    </td>
                    <td className="py-2.5 px-3 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => toggleZoneActive(z)}
                        className="text-xs text-ink-soft hover:text-ink font-medium"
                      >
                        {z.active ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteZone(z.id)}
                        className="text-xs text-brick hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* WhatsApp Status Messages */}
      <Panel>
        <div className="mb-4">
          <h2 className="font-semibold text-base">WhatsApp Status Messages</h2>
          <p className="text-xs text-ink-soft mt-0.5">
            Auto-sent to the customer on status changes. Supported variables:{" "}
            <code className="text-pine font-mono font-semibold">{"{name}"}</code>,{" "}
            <code className="text-pine font-mono font-semibold">{"{order_no}"}</code>,{" "}
            <code className="text-pine font-mono font-semibold">{"{total}"}</code>,{" "}
            <code className="text-pine font-mono font-semibold">{"{minutes}"}</code>.
          </p>
        </div>

        <div className="space-y-4">
          {Object.entries(DEFAULT_MESSAGES).map(([statusKey, def]) => (
            <div key={statusKey} className="p-3 bg-canvas/50 border border-line rounded-lg">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-ink uppercase tracking-wide">
                  {def.label}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setSettings((prev) => ({
                      ...prev,
                      status_messages: {
                        ...prev.status_messages,
                        [statusKey]: def.defaultText,
                      },
                    }))
                  }
                  className="text-[11px] text-ink-soft hover:text-pine underline"
                >
                  Reset default
                </button>
              </div>
              <textarea
                rows={2}
                value={settings.status_messages[statusKey] ?? def.defaultText}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    status_messages: {
                      ...prev.status_messages,
                      [statusKey]: e.target.value,
                    },
                  }))
                }
                className={inputClass}
              />
            </div>
          ))}
        </div>
      </Panel>

      <div className="flex justify-end pt-2">
        <Button variant="primary" onClick={handleSaveSettings} disabled={saving}>
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}
