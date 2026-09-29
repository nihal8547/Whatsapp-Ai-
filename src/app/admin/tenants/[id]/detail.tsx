"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Field, inputClass, Panel, Tag, Toast, useToast } from "@/components/ui";

type Tenant = {
  id: number; name: string; slug: string; status: string;
  trial_ends_at: string | Date | null; created_at: string | Date;
  business_type: string | null; admin_notes: string;
  plan: string; plan_id: number | null;
  timezone: string | null; admin_phone: string | null;
  instance_name: string | null; wa_status: string;
};
type UsageRow = { day: string; msg_received: number; ai_replies: number };
type Counts = Record<string, string | number>;
type TeamMember = { email: string; role: string };
type Plan = { id: number; code: string; name: string };

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

export default function TenantDetail({
  tenant: init, usage, counts, team, plans,
}: {
  tenant: Tenant; usage: UsageRow[]; counts: Counts;
  team: TeamMember[]; plans: Plan[];
}) {
  const router = useRouter();
  const { message, show } = useToast();

  const [tenant, setTenant] = useState(init);
  const [notes, setNotes] = useState(init.admin_notes ?? "");
  const [savingNotes, setSavingNotes] = useState(false);
  const [savingAction, setSavingAction] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  return (
    <div className="min-h-screen bg-canvas">
      {/* ── Header ── */}
      <header className="bg-panel border-b border-line px-6 lg:px-8 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-sm text-ink-soft hover:text-ink">← All workspaces</Link>
          <span className="text-ink-faint">/</span>
          <span className="font-semibold">{tenant.name}</span>
        </div>
        <Link href={`/desk?tenant=${tenant.id}`}
          className="text-sm text-pine hover:underline">
          View as this workspace →
        </Link>
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

          {/* ── WhatsApp ── */}
          <Panel>
            <h2 className="font-semibold mb-3">WhatsApp</h2>
            <dl className="space-y-2 text-sm">
              <InfoRow label="Instance" value={tenant.instance_name ?? "—"} mono />
              <div className="flex justify-between">
                <dt className="text-ink-soft">Connection</dt>
                <dd><Tag tone={tenant.wa_status === "connected" ? "good" : "neutral"}>{tenant.wa_status}</Tag></dd>
              </div>
            </dl>
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
