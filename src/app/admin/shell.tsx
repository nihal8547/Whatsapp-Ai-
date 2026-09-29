"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Field, inputClass, Panel, PageHead, Tag, Toast, useToast } from "@/components/ui";

/* ─── Types ─────────────────────────────────────────────── */
type Tenant = {
  id: number; name: string; slug: string; status: string;
  business_type: string | null; plan: string; plan_id: number | null;
  wa_status: string; replies_month: string; trial_ends_at: string | null;
};
type Plan = {
  id: number; code: string; name: string;
  price_qar: string; monthly_reply_limit: number | null; active: boolean;
};
type PlatformSettings = {
  dashboard_url: string; alert_phone: string; alert_instance: string;
  webhook_secret_enforced: boolean; evolution_url: string; webhook_url: string;
};
type Overview = Record<string, string | number>;

const STATUS_TONES: Record<string, "good" | "warn" | "bad" | "neutral"> = {
  active: "good", trial: "warn", suspended: "bad", cancelled: "neutral",
};
const WA_TONES: Record<string, "good" | "neutral"> = {
  connected: "good",
};

/* ─── Stat card (same pattern as /desk) ─────────────────── */
function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-panel border border-line rounded-lg p-4">
      <p className="text-3xl font-semibold tabular">{value}</p>
      <p className="text-sm mt-1 text-ink-soft">{label}</p>
      {sub && <p className="text-xs text-ink-faint mt-0.5">{sub}</p>}
    </div>
  );
}

/* ─── Main shell ─────────────────────────────────────────── */
export default function AdminShell({
  initialTenants, allPlans, hasOwnTenant, platformSettings: initPS, overview,
}: {
  initialTenants: Tenant[];
  allPlans: Plan[];
  hasOwnTenant: boolean;
  platformSettings: PlatformSettings;
  overview: Overview;
}) {
  const router = useRouter();
  const { message, show } = useToast();

  /* tenants */
  const [tenants, setTenants] = useState(initialTenants);

  /* platform settings */
  const [ps, setPs] = useState(initPS);
  const [savingPs, setSavingPs] = useState(false);

  /* plans */
  const [plans, setPlans] = useState(allPlans);
  const [planDraft, setPlanDraft] = useState({ code: "", name: "", price_qar: "", monthly_reply_limit: "" });
  const [editingPlan, setEditingPlan] = useState<number | null>(null);
  const [planEdit, setPlanEdit] = useState<Partial<Plan>>({});
  const [savingPlan, setSavingPlan] = useState(false);

  /* ── helpers ── */
  async function refreshTenants() {
    const d = await (await fetch("/api/admin/tenants")).json();
    if (d.ok) setTenants(d.tenants);
  }
  async function refreshPlans() {
    const d = await (await fetch("/api/admin/plans")).json();
    if (d.ok) setPlans(d.plans);
  }

  /* ── platform settings save ── */
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
    show(d.ok ? "Platform settings saved." : "Could not save settings.");
    if (d.ok) router.refresh();
  }

  /* ── add plan ── */
  async function addPlan(e: React.FormEvent) {
    e.preventDefault();
    setSavingPlan(true);
    const res = await fetch("/api/admin/plans", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...planDraft,
        monthly_reply_limit: planDraft.monthly_reply_limit ? Number(planDraft.monthly_reply_limit) : null,
      }),
    });
    setSavingPlan(false);
    const d = await res.json();
    if (!d.ok) return show("Could not create plan.");
    setPlanDraft({ code: "", name: "", price_qar: "", monthly_reply_limit: "" });
    await refreshPlans();
    show("Plan created.");
  }

  /* ── save plan edit ── */
  async function savePlanEdit(id: number) {
    const patch: Record<string, unknown> = { ...planEdit };
    if (planEdit.monthly_reply_limit === null) patch.monthly_reply_limit = null;
    else if (planEdit.monthly_reply_limit !== undefined)
      patch.monthly_reply_limit = Number(planEdit.monthly_reply_limit);
    await fetch(`/api/admin/plans/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    setEditingPlan(null);
    setPlanEdit({});
    await refreshPlans();
    show("Plan updated.");
  }

  /* ── toggle plan active ── */
  async function togglePlan(p: Plan) {
    await fetch(`/api/admin/plans/${p.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ active: !p.active }),
    });
    await refreshPlans();
    show(p.active ? "Plan hidden." : "Plan active.");
  }

  /* ── delete workspace ── */
  async function deleteWorkspace(id: number, name: string) {
    if (
      !confirm(
        `Are you sure you want to permanently delete workspace "${name}"?\n\nThis will ERASE all chats, appointments, services, media, and team accounts linked to it. This action cannot be undone.`
      )
    ) {
      return;
    }
    const res = await fetch(`/api/admin/tenants/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!data.ok) {
      if (data.error === "cannot_delete_active_workspace") {
        show("Cannot delete your currently active workspace.");
      } else {
        show("Could not delete workspace.");
      }
      return;
    }
    setTenants((prev) => prev.filter((t) => t.id !== id));
    show(`Workspace "${name}" was permanently deleted.`);
    router.refresh();
  }

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      {/* ── Overview stats ── */}
      <div id="overview" className="scroll-mt-6">
        <PageHead title="Platform overview" lead="Live numbers across the whole platform." />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <Stat label="Total workspaces" value={overview.total_workspaces ?? 0}
            sub={`${overview.active_count ?? 0} active · ${overview.trial_count ?? 0} trial · ${overview.suspended_count ?? 0} suspended`} />
          <Stat label="Messages today" value={overview.msgs_today ?? 0} />
          <Stat label="AI replies this month" value={overview.ai_replies_month ?? 0} />
          <Stat label="Est. MRR (QAR)" value={Number(overview.mrr_qar ?? 0).toFixed(0)} />
        </div>
      </div>

      {/* ── Platform settings ── */}
      <div id="settings" className="scroll-mt-6">
        <Panel>
          <h2 className="font-semibold mb-4">Platform settings</h2>
          <form onSubmit={savePlatformSettings} className="grid sm:grid-cols-2 gap-4">
            <Field label="Dashboard public URL" hint="Used to build every media image URL the bot sends.">
              <input className={inputClass} type="url" placeholder="https://ai.webbea.qa"
                value={ps.dashboard_url} onChange={e => setPs({ ...ps, dashboard_url: e.target.value })} />
            </Field>
            <Field label="Alert WhatsApp number" hint="The platform admin gets error alerts here.">
              <input className={inputClass} placeholder="+974xxxxxxxx"
                value={ps.alert_phone} onChange={e => setPs({ ...ps, alert_phone: e.target.value })} />
            </Field>
            <Field label="Alert WhatsApp instance" hint="Which Evolution instance sends the alerts.">
              <input className={inputClass} placeholder="instance-name"
                value={ps.alert_instance} onChange={e => setPs({ ...ps, alert_instance: e.target.value })} />
            </Field>
            <Field label="Read-only: Evolution URL">
              <input className={`${inputClass} opacity-60 cursor-not-allowed`} readOnly
                value={ps.evolution_url} />
            </Field>
            <Field label="Read-only: Webhook URL">
              <input className={`${inputClass} opacity-60 cursor-not-allowed`} readOnly
                value={ps.webhook_url} />
            </Field>
            <div className="sm:col-span-2 flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" className="rounded"
                  checked={!!ps.webhook_secret_enforced}
                  onChange={e => setPs({ ...ps, webhook_secret_enforced: e.target.checked })} />
                Enforce webhook secret header
              </label>
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={savingPs}>{savingPs ? "Saving…" : "Save settings"}</Button>
            </div>
          </form>
        </Panel>
      </div>

      {/* ── §4 Plans management ── */}
        <div id="plans" className="scroll-mt-6">
          <Panel>
            <h2 className="font-semibold mb-4">Plans</h2>
            <div className="overflow-x-auto -mx-5 mb-5">
              <table className="w-full text-sm">
                <thead className="border-b border-line">
                  <tr className="text-left text-ink-soft">
                    <th className="px-5 py-2 font-medium">Code</th>
                    <th className="px-5 py-2 font-medium">Name</th>
                    <th className="px-5 py-2 font-medium">Price (QAR)</th>
                    <th className="px-5 py-2 font-medium">Reply limit</th>
                    <th className="px-5 py-2 font-medium">Status</th>
                    <th className="px-5 py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {plans.map(p => (
                    <tr key={p.id}>
                      {editingPlan === p.id ? (
                        <>
                          <td className="px-5 py-2"><input className={`${inputClass} w-28`} defaultValue={p.code}
                            onChange={e => setPlanEdit(x => ({ ...x, code: e.target.value }))} /></td>
                          <td className="px-5 py-2"><input className={`${inputClass} w-36`} defaultValue={p.name}
                            onChange={e => setPlanEdit(x => ({ ...x, name: e.target.value }))} /></td>
                          <td className="px-5 py-2"><input className={`${inputClass} w-24 tabular`} type="number" defaultValue={p.price_qar}
                            onChange={e => setPlanEdit(x => ({ ...x, price_qar: e.target.value as any }))} /></td>
                          <td className="px-5 py-2"><input className={`${inputClass} w-28 tabular`} type="number" placeholder="unlimited"
                            defaultValue={p.monthly_reply_limit ?? ""}
                            onChange={e => setPlanEdit(x => ({ ...x, monthly_reply_limit: e.target.value === "" ? null : Number(e.target.value) as any }))} /></td>
                          <td className="px-5 py-2"><Tag tone={p.active ? "good" : "neutral"}>{p.active ? "active" : "hidden"}</Tag></td>
                          <td className="px-5 py-2 flex gap-2">
                            <Button variant="primary" className="text-xs py-1 px-2.5" onClick={() => savePlanEdit(p.id)}>Save</Button>
                            <Button variant="quiet" className="text-xs py-1 px-2.5" onClick={() => { setEditingPlan(null); setPlanEdit({}); }}>Cancel</Button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-5 py-2 font-mono text-xs">{p.code}</td>
                          <td className="px-5 py-2">{p.name}</td>
                          <td className="px-5 py-2 tabular">{p.price_qar}</td>
                          <td className="px-5 py-2 tabular">{p.monthly_reply_limit ?? "Unlimited"}</td>
                          <td className="px-5 py-2"><Tag tone={p.active ? "good" : "neutral"}>{p.active ? "active" : "hidden"}</Tag></td>
                          <td className="px-5 py-2 flex gap-2">
                            <Button variant="quiet" className="text-xs py-1 px-2.5"
                              onClick={() => { setEditingPlan(p.id); setPlanEdit({}); }}>Edit</Button>
                            <Button variant="quiet" className="text-xs py-1 px-2.5" onClick={() => togglePlan(p)}>
                              {p.active ? "Hide" : "Show"}
                            </Button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <form onSubmit={addPlan} className="grid sm:grid-cols-4 gap-3 border-t border-line pt-4">
              <Field label="Code"><input className={inputClass} required placeholder="starter"
                value={planDraft.code} onChange={e => setPlanDraft(d => ({ ...d, code: e.target.value }))} /></Field>
              <Field label="Name"><input className={inputClass} required placeholder="Starter"
                value={planDraft.name} onChange={e => setPlanDraft(d => ({ ...d, name: e.target.value }))} /></Field>
              <Field label="Price (QAR)"><input className={`${inputClass} tabular`} type="number" step="0.01" placeholder="0"
                value={planDraft.price_qar} onChange={e => setPlanDraft(d => ({ ...d, price_qar: e.target.value }))} /></Field>
              <Field label="Reply limit" hint="Empty = unlimited"><input className={`${inputClass} tabular`} type="number" placeholder="1000"
                value={planDraft.monthly_reply_limit} onChange={e => setPlanDraft(d => ({ ...d, monthly_reply_limit: e.target.value }))} /></Field>
              <div className="sm:col-span-4">
                <Button type="submit" disabled={savingPlan}>{savingPlan ? "Creating…" : "Add plan"}</Button>
              </div>
            </form>
          </Panel>
        </div>

        {/* ── §5 Workspaces table ── */}
        <div id="tenants" className="scroll-mt-6">
          <Panel pad={false}>
          <div className="px-5 pt-5 pb-3">
            <h2 className="font-semibold">Workspaces</h2>
            <p className="text-sm text-ink-soft mt-0.5">Click a workspace to view its detail page.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-line">
                <tr className="text-left text-ink-soft">
                  <th className="px-5 py-3 font-medium">Workspace</th>
                  <th className="px-5 py-3 font-medium">WhatsApp</th>
                  <th className="px-5 py-3 font-medium">Replies/mo</th>
                  <th className="px-5 py-3 font-medium">Plan</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {tenants.map(t => (
                  <tr key={t.id} className="hover:bg-canvas">
                    <td className="px-5 py-3">
                      <Link href={`/admin/tenants/${t.id}`} className="font-medium hover:underline text-pine-deep">
                        {t.name}
                      </Link>
                      <p className="text-xs text-ink-faint">{t.slug}{t.business_type ? ` · ${t.business_type}` : ""}</p>
                    </td>
                    <td className="px-5 py-3">
                      <Tag tone={WA_TONES[t.wa_status] ?? "neutral"}>{t.wa_status}</Tag>
                    </td>
                    <td className="px-5 py-3 tabular">{t.replies_month}</td>
                    <td className="px-5 py-3">{t.plan}</td>
                    <td className="px-5 py-3">
                      <Tag tone={STATUS_TONES[t.status] ?? "neutral"}>{t.status}</Tag>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/admin/tenants/${t.id}`}
                          className="text-xs text-ink-soft hover:text-ink border border-line rounded px-2.5 py-1 hover:bg-canvas transition-colors"
                        >
                          Detail →
                        </Link>
                        <button
                          onClick={() => deleteWorkspace(t.id, t.name)}
                          className="text-xs text-brick hover:bg-brick/10 border border-brick/30 rounded px-2.5 py-1 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <Toast message={message} />
    </div>
  );
}
