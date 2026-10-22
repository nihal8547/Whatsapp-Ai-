"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Field, inputClass, Panel, Tag, Toast, useToast } from "@/components/ui";
import {
  ShoppingCartIcon,
  BookOpenIcon,
  CalendarIcon,
  TargetIcon,
  MegaphoneIcon,
  HelpCircleIcon,
  ImageIcon,
} from "@/components/icons";

import { fullStamp } from "@/lib/format";

type Tenant = {
  id: number; name: string; slug: string; status: string;
  trial_ends_at: string | Date | null; created_at: string | Date;
  business_type: string | null; pack_code?: string | null; admin_notes: string;
  plan: string; plan_id: number | null;
  timezone: string | null; admin_phone: string | null;
  modules?: string[] | null;
  broadcasts_enabled?: boolean;
  broadcast_daily_cap?: number;
  instance_name: string | null; wa_status: string;
  disconnected_since?: string | null;
  reconnected_at?: string | null;
  proactive_paused_until?: string | null;
  pause_reason?: string | null;
};
type UsageRow = { day: string; msg_received: number; ai_replies: number };
type Counts = Record<string, string | number>;
type TeamMember = { email: string; role: string };
type Plan = { id: number; code: string; name: string };
export type SafetyEvent = {
  id: number;
  kind: string;
  detail: string;
  created_at: string;
};

function toDateInputValue(val: unknown): string {
  if (!val) return "";
  try {
    const d = val instanceof Date ? val : new Date(String(val));
    return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

const STATUS_TONES: Record<string, "good" | "warn" | "bad" | "neutral"> = {
  active: "good", trial: "warn", suspended: "bad", cancelled: "neutral",
};

type Last30Days = {
  messages_in: number;
  new_contacts: number;
  bookings_created: number;
  ad_leads: number;
};

export default function TenantDetail({
  tenant: init, usage, counts, team, plans, last30Days, safetyEvents: initEvents = [],
}: {
  tenant: Tenant; usage: UsageRow[]; counts: Counts;
  team: TeamMember[]; plans: Plan[];
  last30Days?: Last30Days;
  safetyEvents?: SafetyEvent[];
}) {
  const router = useRouter();
  const { message, show } = useToast();

  const [tenant, setTenant] = useState(init);
  const [notes, setNotes] = useState(init.admin_notes ?? "");
  const [savingNotes, setSavingNotes] = useState(false);
  const [savingAction, setSavingAction] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [events, setEvents] = useState<SafetyEvent[]>(initEvents);
  const [pausing, setPausing] = useState(false);

  const isPaused = Boolean(
    tenant.proactive_paused_until &&
    new Date(tenant.proactive_paused_until).getTime() > Date.now()
  );

  const reconnectedAgoMinutes = tenant.reconnected_at
    ? Math.floor((Date.now() - new Date(tenant.reconnected_at).getTime()) / 60000)
    : null;
  const showResumeNotice = reconnectedAgoMinutes !== null && reconnectedAgoMinutes >= 0 && reconnectedAgoMinutes < 10;
  const resumeMinutesLeft = Math.max(1, 10 - (reconnectedAgoMinutes ?? 0));

  async function pause24h() {
    if (!confirm(`Pause all automatic outbound messages for "${tenant.name}" for 24 hours?`)) return;
    setPausing(true);
    const res = await fetch(`/api/admin/tenants/${tenant.id}/pause`, { method: "POST" });
    const data = await res.json();
    setPausing(false);
    if (!data.ok) {
      show("Could not pause automatic messages.");
      return;
    }
    setTenant(t => ({
      ...t,
      proactive_paused_until: data.instance?.proactive_paused_until,
      pause_reason: data.instance?.pause_reason,
    }));
    setEvents(prev => [
      {
        id: Date.now(),
        kind: "paused_optouts",
        detail: "Paused by platform administrator for 24 hours",
        created_at: new Date().toISOString(),
      },
      ...prev,
    ]);
    show("Automatic messages paused for 24 hours.");
  }

  async function unpause() {
    if (!confirm(`Resume automatic outbound messages for "${tenant.name}"?`)) return;
    setPausing(true);
    const res = await fetch(`/api/admin/tenants/${tenant.id}/pause`, { method: "DELETE" });
    const data = await res.json();
    setPausing(false);
    if (!data.ok) {
      show("Could not resume messages.");
      return;
    }
    setTenant(t => ({
      ...t,
      proactive_paused_until: null,
      pause_reason: null,
    }));
    setEvents(prev => [
      {
        id: Date.now(),
        kind: "reconnected",
        detail: "Pause cleared by platform administrator",
        created_at: new Date().toISOString(),
      },
      ...prev,
    ]);
    show("Automatic messages resumed.");
  }

  async function deleteWorkspace() {
    const promptMsg = `Are you absolutely sure you want to permanently delete "${tenant.name}"?\n\nThis will ERASE all contacts, messages, appointments, media files, and user accounts for this workspace.\n\nThis action CANNOT be undone.\n\nType the workspace slug "${tenant.slug}" to confirm:`;
    const input = prompt(promptMsg);
    if (input !== tenant.slug) {
      if (input !== null) alert("Workspace slug does not match. Deletion cancelled.");
      return;
    }

    setDeleting(true);
    const res = await fetch(`/api/admin/tenants/${tenant.id}`, { method: "DELETE" });
    const data = await res.json();
    setDeleting(false);
    if (!data.ok) {
      if (data.error === "cannot_delete_active_workspace") {
        show("Cannot delete your currently active workspace.");
      } else {
        show("Could not delete workspace.");
      }
      return;
    }
    show(`Workspace "${tenant.name}" was deleted.`);
    router.push("/admin");
    router.refresh();
  }

  async function patch(patch: Record<string, unknown>, confirmMsg?: string) {
    if (confirmMsg && !confirm(confirmMsg)) return;
    setSavingAction(true);
    const res = await fetch(`/api/admin/tenants/${tenant.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    setSavingAction(false);
    const d = await res.json();
    if (!d.ok) return show("Could not update workspace.");
    setTenant(t => ({ ...t, ...patch, status: d.status ?? t.status, plan_id: d.plan_id ?? t.plan_id }));
    show("Workspace updated.");
    router.refresh();
  }

  async function saveNotes() {
    setSavingNotes(true);
    const res = await fetch(`/api/admin/tenants/${tenant.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ admin_notes: notes }),
    });
    setSavingNotes(false);
    const d = await res.json();
    show(d.ok ? "Notes saved." : "Could not save notes.");
  }

  const planName = plans.find(p => p.id === tenant.plan_id)?.name ?? tenant.plan;

  const [switching, setSwitching] = useState(false);

  async function impersonateWorkspace() {
    setSwitching(true);
    const res = await fetch("/api/admin/impersonate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenantId: tenant.id }),
    });
    const d = await res.json();
    setSwitching(false);
    if (!d.ok) return show("Could not switch workspace context.");
    show(`Switched to ${tenant.name}`);
    router.push("/desk");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-canvas">
      {/* ── Header ── */}
      <header className="bg-panel border-b border-line px-6 lg:px-8 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-sm text-ink-soft hover:text-ink">← All workspaces</Link>
          <span className="text-ink-faint">/</span>
          <span className="font-semibold">{tenant.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            disabled={switching}
            onClick={impersonateWorkspace}
            className="text-xs py-1.5 px-3 flex items-center gap-1.5 font-medium"
          >
            <span>Login to Desk</span>
          </Button>
          <Link href={`/desk?tenant=${tenant.id}`}
            className="text-xs text-ink-soft hover:text-ink border border-line rounded px-2.5 py-1.5 hover:bg-canvas">
            Preview Link →
          </Link>
        </div>
      </header>

      <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">

        {/* ── Quick count cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Active services", value: counts.services ?? 0 },
            { label: "Upcoming appointments", value: counts.upcoming ?? 0 },
            { label: "Team members", value: counts.team ?? 0 },
            { label: "Contacts", value: counts.contacts ?? 0 },
          ].map(s => (
            <div key={s.label} className="bg-panel border border-line rounded-lg p-4">
              <p className="text-2xl font-semibold tabular">{s.value}</p>
              <p className="text-sm text-ink-soft mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* ── Last 30 days activity box ── */}
        {last30Days && (
          <div className="bg-panel border border-line rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-ink-soft uppercase tracking-wider">
                Activity (Last 30 days)
              </h3>
              <Link href={`/analytics?tenant=${tenant.id}`} className="text-xs text-pine hover:underline">
                View full analytics →
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-xs text-ink-soft">Messages received</p>
                <p className="text-xl font-semibold tabular mt-0.5">{last30Days.messages_in}</p>
              </div>
              <div>
                <p className="text-xs text-ink-soft">New contacts</p>
                <p className="text-xl font-semibold tabular mt-0.5">{last30Days.new_contacts}</p>
              </div>
              <div>
                <p className="text-xs text-ink-soft">Bookings</p>
                <p className="text-xl font-semibold tabular mt-0.5">{last30Days.bookings_created}</p>
              </div>
              <div>
                <p className="text-xs text-ink-soft">Ad leads</p>
                <p className="text-xl font-semibold tabular mt-0.5">{last30Days.ad_leads}</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-6">
          {/* ── Business info ── */}
          <Panel>
            <h2 className="font-semibold mb-3">Business info</h2>
            <dl className="space-y-2 text-sm">
              <InfoRow label="Name" value={tenant.name} />
              <InfoRow label="Slug" value={tenant.slug} mono />
              <InfoRow label="Business type" value={tenant.business_type ?? "—"} />
              <InfoRow label="Timezone" value={tenant.timezone ?? "—"} />
              <InfoRow label="Admin phone" value={tenant.admin_phone ?? "—"} />
              <InfoRow label="Created" value={new Date(tenant.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} />
            </dl>
          </Panel>

          {/* ── WhatsApp & Safety ── */}
          <Panel>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">WhatsApp & Safety</h2>
              <Tag tone={tenant.wa_status === "connected" ? "good" : "bad"}>
                {tenant.wa_status === "connected" ? "Connected" : "Disconnected"}
              </Tag>
            </div>
            <dl className="space-y-2.5 text-sm">
              <InfoRow label="Instance" value={tenant.instance_name ?? "—"} mono />

              {tenant.wa_status !== "connected" && tenant.disconnected_since && (
                <div className="flex justify-between text-xs text-brick">
                  <span>Disconnected since</span>
                  <span>{fullStamp(tenant.disconnected_since, tenant.timezone || undefined)}</span>
                </div>
              )}

              {showResumeNotice && (
                <div className="p-2.5 bg-amber-wash text-amber rounded text-xs font-medium">
                  Recently reconnected, automatic messages resume in {resumeMinutesLeft} minute{resumeMinutesLeft === 1 ? "" : "s"}.
                </div>
              )}

              <div className="pt-2 border-t border-line flex items-center justify-between">
                <div>
                  <dt className="text-ink-soft">Automatic messages</dt>
                  <dd className="text-xs mt-0.5">
                    {isPaused ? (
                      <span className="text-amber font-medium">
                        Paused until {fullStamp(tenant.proactive_paused_until!, tenant.timezone || undefined)}
                      </span>
                    ) : (
                      <span className="text-pine-deep font-medium">Active (Not paused)</span>
                    )}
                  </dd>
                </div>
                <div>
                  {isPaused ? (
                    <Button
                      variant="quiet"
                      disabled={pausing}
                      onClick={unpause}
                      className="text-xs py-1 px-2.5"
                    >
                      {pausing ? "Resuming…" : "Resume now"}
                    </Button>
                  ) : (
                    <Button
                      variant="quiet"
                      disabled={pausing}
                      onClick={pause24h}
                      className="text-xs py-1 px-2.5 text-amber hover:text-amber"
                    >
                      {pausing ? "Pausing…" : "Pause for 24 hours"}
                    </Button>
                  )}
                </div>
              </div>

              {isPaused && tenant.pause_reason && (
                <p className="text-xs text-ink-soft italic bg-canvas p-2 rounded">
                  Reason: {tenant.pause_reason}
                </p>
              )}
            </dl>

            {/* ── Safety Events ── */}
            <div className="mt-4 pt-4 border-t border-line">
              <h3 className="text-xs font-semibold text-ink-soft uppercase tracking-wider mb-2">
                Recent Safety Events ({events.length})
              </h3>
              {events.length === 0 ? (
                <p className="text-xs text-ink-soft italic">No safety events recorded yet.</p>
              ) : (
                <ul className="divide-y divide-line max-h-56 overflow-y-auto -mx-2 px-2 text-xs">
                  {events.map(e => (
                    <li key={e.id} className="py-2 flex items-start justify-between gap-3">
                      <div>
                        <span className="font-medium text-ink capitalize mr-2">
                          {e.kind.replace(/_/g, " ")}
                        </span>
                        <p className="text-ink-soft mt-0.5">{e.detail || "No details provided"}</p>
                      </div>
                      <span className="text-ink-faint whitespace-nowrap shrink-0">
                        {fullStamp(e.created_at, tenant.timezone || undefined)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Panel>
        </div>

        {/* ── Team ── */}
        <Panel>
          <h2 className="font-semibold mb-3">Team members <span className="text-ink-faint font-normal text-sm">(read-only — manage on tenant's /team page)</span></h2>
          {team.length === 0 ? (
            <p className="text-sm text-ink-soft">No team members yet.</p>
          ) : (
            <ul className="divide-y divide-line -mx-5">
              {team.map(m => (
                <li key={m.email} className="flex items-center justify-between px-5 py-2.5 text-sm">
                  <span>{m.email}</span>
                  <Tag tone="neutral">{m.role}</Tag>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* ── Last 30 days usage ── */}
        <Panel pad={false}>
          <div className="px-5 pt-5 pb-3">
            <h2 className="font-semibold">Usage — last 30 days</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-line">
                <tr className="text-left text-ink-soft">
                  <th className="px-5 py-2 font-medium">Day</th>
                  <th className="px-5 py-2 font-medium text-right">Messages in</th>
                  <th className="px-5 py-2 font-medium text-right">AI replies</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {usage.length === 0 ? (
                  <tr><td colSpan={3} className="px-5 py-4 text-ink-soft">No usage data yet.</td></tr>
                ) : usage.map(row => (
                  <tr key={row.day} className="hover:bg-canvas">
                    <td className="px-5 py-2 tabular">{row.day}</td>
                    <td className="px-5 py-2 tabular text-right">{row.msg_received}</td>
                    <td className="px-5 py-2 tabular text-right">{row.ai_replies}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        {/* ── Admin notes ── */}
        <Panel>
          <h2 className="font-semibold mb-2">Admin notes</h2>
          <p className="text-xs text-ink-soft mb-3">Private support history — never shown to the tenant.</p>
          <textarea
            className={`${inputClass} min-h-[120px] resize-y`}
            placeholder="Support history, call notes, special agreements…"
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
          <Button onClick={saveNotes} disabled={savingNotes} className="mt-3">
            {savingNotes ? "Saving…" : "Save notes"}
          </Button>
        </Panel>

        {/* ── Actions ── */}
        <Panel>
          <h2 className="font-semibold mb-4">Actions</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            <Field label="Status">
              <select
                className={inputClass}
                value={tenant.status}
                disabled={savingAction}
                onChange={e => {
                  const next = e.target.value;
                  patch(
                    { status: next },
                    `Change status to "${next}" for "${tenant.name}"? ${next === "suspended" ? "\n\nThis will immediately stop the bot from replying." : ""}`
                  );
                }}
              >
                {["trial", "active", "suspended", "cancelled"].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </Field>

            <Field label="Business Type" hint="Defines default modules and terminology">
              <select
                className={inputClass}
                value={tenant.business_type ?? "other"}
                disabled={savingAction}
                onChange={e => {
                  const next = e.target.value;
                  if (confirm(`Change business type to "${next}" for "${tenant.name}"? This will update the workspace's default business pack.`)) {
                    patch({ business_type: next });
                  }
                }}
              >
                {[
                  { id: "clinic", label: "Clinic / Hospital" },
                  { id: "travels", label: "Travels & Tours" },
                  { id: "hotel", label: "Hostel / Hotel" },
                  { id: "realestate", label: "Real Estate" },
                  { id: "grocery", label: "Grocery / Supermarket" },
                  { id: "tech", label: "IT Agency / Tech Company" },
                  { id: "restaurant", label: "Restaurant / Cafe" },
                  { id: "education", label: "Education / Coaching" },
                  { id: "retail", label: "Retail / E-commerce" },
                  { id: "salon", label: "Salons / Spas" },
                  { id: "other", label: "General Business / Other" },
                ].map(bt => (
                  <option key={bt.id} value={bt.id}>{bt.label}</option>
                ))}
              </select>
            </Field>

            <Field label="Plan">
              <select
                className={inputClass}
                value={tenant.plan_id ?? ""}
                disabled={savingAction}
                onChange={e => patch({ plan_id: Number(e.target.value) })}
              >
                <option value="">— no plan —</option>
                {plans.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </Field>

            <Field label="Trial end date" hint="Only meaningful while status is 'trial'.">
              <input
                type="date"
                className={inputClass}
                defaultValue={toDateInputValue(tenant.trial_ends_at)}
                disabled={savingAction}
                onBlur={e => { if (e.target.value) patch({ trial_ends_at: e.target.value }); }}
              />
            </Field>

            <Field label="Daily broadcast limit" hint="Max recipients/day">
              <input
                type="number"
                min={1}
                className={inputClass}
                defaultValue={tenant.broadcast_daily_cap ?? 100}
                disabled={savingAction}
                onBlur={e => {
                  const val = Number(e.target.value);
                  if (val > 0) patch({ broadcast_daily_cap: val });
                }}
              />
            </Field>

            <div className="pt-2 sm:col-span-3 border-t border-line">
              <label className="flex items-center gap-2.5 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="rounded text-pine focus:ring-pine"
                  checked={tenant.broadcasts_enabled !== false}
                  disabled={savingAction}
                  onChange={e => patch({ broadcasts_enabled: e.target.checked })}
                />
                <span className="font-medium text-ink">Broadcasts enabled for this workspace</span>
              </label>
              <p className="text-xs text-ink-soft ml-6 mt-0.5">
                Disable to restrict this tenant from launching any broadcast campaigns.
              </p>
            </div>
          </div>
        </Panel>

        {/* ── Feature Modules Management ── */}
        <Panel>
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="font-semibold">Feature Modules</h2>
              <p className="text-xs text-ink-soft mt-0.5">
                Enable or disable specific business features for this workspace.
              </p>
            </div>
            {tenant.modules && (
              <Button
                variant="quiet"
                className="text-xs py-1 px-2.5"
                disabled={savingAction}
                onClick={() => {
                  if (confirm("Reset this workspace to use default modules from its business pack?")) {
                    patch({ modules: null });
                  }
                }}
              >
                Reset to Pack Defaults
              </Button>
            )}
          </div>

          <div className="mt-4 grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { code: "orders", name: "Orders & Cart", icon: ShoppingCartIcon },
              { code: "catalog", name: "Catalog / Menu", icon: BookOpenIcon },
              { code: "appointments", name: "Appointments & Bookings", icon: CalendarIcon },
              { code: "leads", name: "Leads & Enquiries", icon: TargetIcon },
              { code: "ads", name: "Ad Playbooks", icon: MegaphoneIcon },
              { code: "faq", name: "FAQ Knowledge Base", icon: HelpCircleIcon },
              { code: "media", name: "Media Library", icon: ImageIcon },
            ].map(mod => {
              // Active if in tenant.modules, or if tenant.modules is null/unset then check standard active default
              const isEnabled = Array.isArray(tenant.modules)
                ? tenant.modules.includes(mod.code)
                : ["orders", "catalog", "appointments", "leads", "ads", "faq", "media"].includes(mod.code);

              const ModIcon = mod.icon;

              return (
                <div
                  key={mod.code}
                  className={`p-3 rounded-lg border transition-all ${
                    isEnabled
                      ? "bg-pine-wash/20 border-pine/30"
                      : "bg-canvas/50 border-line opacity-75"
                  }`}
                >
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-0.5 rounded text-pine focus:ring-pine"
                      checked={isEnabled}
                      disabled={savingAction}
                      onChange={e => {
                        const current = Array.isArray(tenant.modules)
                          ? [...tenant.modules]
                          : ["orders", "catalog", "appointments", "leads", "ads", "faq", "media"];
                        let next: string[];
                        if (e.target.checked) {
                          next = Array.from(new Set([...current, mod.code]));
                        } else {
                          next = current.filter(m => m !== mod.code);
                        }
                        patch({ modules: next });
                      }}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink flex items-center gap-1.5">
                        <ModIcon className="w-4 h-4 text-pine shrink-0" />
                        <span>{mod.name}</span>
                      </p>
                      <p className="text-[11px] text-ink-soft mt-0.5">
                        {isEnabled ? "Active for workspace" : "Disabled"}
                      </p>
                    </div>
                  </label>
                </div>
              );
            })}
          </div>
        </Panel>

        {/* ── Danger zone ── */}
        <Panel className="border-brick/30 bg-brick/5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="font-semibold text-brick">Delete workspace</h2>
              <p className="text-sm text-ink-soft mt-0.5">
                Permanently removes this workspace and all associated chats, contacts, appointments, media, and team accounts.
              </p>
            </div>
            <Button
              variant="danger"
              disabled={deleting}
              onClick={deleteWorkspace}
              className="shrink-0"
            >
              {deleting ? "Deleting…" : "Delete workspace"}
            </Button>
          </div>
        </Panel>
      </div>
      <Toast message={message} />
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-ink-soft shrink-0">{label}</dt>
      <dd className={`text-right truncate ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  );
}
