"use client";

import { useState } from "react";
import { Button, Field, inputClass, Panel, PageHead, Tag, Toast, useToast } from "@/components/ui";

type Plan = {
  id: number;
  code: string;
  name: string;
  price_qar: string;
  monthly_reply_limit: number | null;
  broadcast_limit?: number | null;
  is_popular?: boolean;
  features?: string[];
  active: boolean;
};

export default function PlansManager({ initialPlans }: { initialPlans: Plan[] }) {
  const { message, show } = useToast();
  const [plans, setPlans] = useState<Plan[]>(initialPlans);
  const [planDraft, setPlanDraft] = useState({
    code: "",
    name: "",
    price_qar: "",
    monthly_reply_limit: "",
    broadcast_limit: "100",
  });
  const [editingPlan, setEditingPlan] = useState<number | null>(null);
  const [planEdit, setPlanEdit] = useState<Partial<Plan>>({});
  const [savingPlan, setSavingPlan] = useState(false);

  async function refreshPlans() {
    const res = await fetch("/api/admin/plans");
    const d = await res.json();
    if (d.ok && d.plans) setPlans(d.plans);
  }

  async function addPlan(e: React.FormEvent) {
    e.preventDefault();
    setSavingPlan(true);
    const res = await fetch("/api/admin/plans", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...planDraft,
        price_qar: Number(planDraft.price_qar) || 0,
        monthly_reply_limit: planDraft.monthly_reply_limit ? Number(planDraft.monthly_reply_limit) : null,
        broadcast_limit: Number(planDraft.broadcast_limit) || 100,
      }),
    });
    setSavingPlan(false);
    const d = await res.json();
    if (!d.ok) return show("Could not create plan: " + (d.error ?? "error"));
    setPlanDraft({ code: "", name: "", price_qar: "", monthly_reply_limit: "", broadcast_limit: "100" });
    await refreshPlans();
    show("Plan created.");
  }

  async function savePlanEdit(id: number) {
    const res = await fetch(`/api/admin/plans/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(planEdit),
    });
    const d = await res.json();
    if (!d.ok) return show("Could not save plan.");
    setEditingPlan(null);
    setPlanEdit({});
    await refreshPlans();
    show("Plan updated.");
  }

  async function togglePlan(p: Plan) {
    await fetch(`/api/admin/plans/${p.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ active: !p.active }),
    });
    await refreshPlans();
    show(p.active ? "Plan hidden." : "Plan active.");
  }

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      <div>
        <PageHead
          title="Subscription Plans & Tiers"
          lead="Configure clear public tiers, QAR pricing, monthly bot reply allowances, and included features."
        />

        {/* ── Visual Plan Cards ── */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {plans.map(p => {
            const featList: string[] = Array.isArray(p.features) ? p.features : [];
            const isFree = Number(p.price_qar) === 0;

            return (
              <div
                key={p.id}
                className={`rounded-xl border p-5 flex flex-col justify-between transition-all ${
                  p.is_popular
                    ? "bg-panel border-pine shadow-sm ring-1 ring-pine"
                    : "bg-panel border-line hover:border-ink-soft/40"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs uppercase tracking-wider text-ink-faint">
                      {p.code}
                    </span>
                    {p.is_popular ? (
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-pine text-white px-2 py-0.5 rounded-full">
                        Popular
                      </span>
                    ) : (
                      <Tag tone={p.active ? "good" : "neutral"}>
                        {p.active ? "active" : "hidden"}
                      </Tag>
                    )}
                  </div>

                  <h3 className="text-lg font-bold text-ink">{p.name}</h3>

                  <div className="mt-3 mb-4">
                    <span className="text-3xl font-extrabold text-ink tabular">
                      {isFree ? "Free" : `${Number(p.price_qar).toFixed(0)}`}
                    </span>
                    {!isFree && <span className="text-xs text-ink-soft ml-1 font-medium">QAR / month</span>}
                  </div>

                  <div className="py-2.5 px-3 bg-canvas/70 rounded-lg border border-line text-xs space-y-1 mb-4">
                    <div className="flex justify-between">
                      <span className="text-ink-soft">AI Replies:</span>
                      <strong className="text-ink tabular">{p.monthly_reply_limit ? p.monthly_reply_limit.toLocaleString() : "Unlimited"}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-soft">Daily Broadcast:</span>
                      <strong className="text-ink tabular">{p.broadcast_limit ? `${p.broadcast_limit} msgs` : "100 msgs"}</strong>
                    </div>
                  </div>

                  <ul className="space-y-2 text-xs text-ink mb-6">
                    {featList.map((f, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-pine font-bold mt-0.5">✓</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-3 border-t border-line flex items-center justify-between gap-2">
                  <Button
                    variant="quiet"
                    className="text-xs py-1 px-3 w-full"
                    onClick={() => {
                      setEditingPlan(p.id);
                      setPlanEdit({
                        name: p.name,
                        price_qar: p.price_qar,
                        monthly_reply_limit: p.monthly_reply_limit,
                        broadcast_limit: p.broadcast_limit,
                      });
                    }}
                  >
                    Edit Tier
                  </Button>
                  <Button
                    variant="quiet"
                    className="text-xs py-1 px-2.5 shrink-0"
                    onClick={() => togglePlan(p)}
                  >
                    {p.active ? "Hide" : "Show"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Edit / Detailed Plans Table ── */}
        <Panel>
          <h2 className="font-semibold text-sm mb-3">All Subscription Tiers</h2>
          <div className="overflow-x-auto -mx-5 mb-5">
            <table className="w-full text-sm">
              <thead className="border-b border-line">
                <tr className="text-left text-ink-soft">
                  <th className="px-5 py-2 font-medium">Code</th>
                  <th className="px-5 py-2 font-medium">Name</th>
                  <th className="px-5 py-2 font-medium">Price (QAR)</th>
                  <th className="px-5 py-2 font-medium">AI Replies / mo</th>
                  <th className="px-5 py-2 font-medium">Daily Broadcast</th>
                  <th className="px-5 py-2 font-medium">Status</th>
                  <th className="px-5 py-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {plans.map(p => (
                  <tr key={p.id}>
                    {editingPlan === p.id ? (
                      <>
                        <td className="px-5 py-2 font-mono text-xs">{p.code}</td>
                        <td className="px-5 py-2">
                          <input
                            className={`${inputClass} w-44`}
                            defaultValue={p.name}
                            onChange={e => setPlanEdit(x => ({ ...x, name: e.target.value }))}
                          />
                        </td>
                        <td className="px-5 py-2">
                          <input
                            className={`${inputClass} w-24 tabular`}
                            type="number"
                            defaultValue={p.price_qar}
                            onChange={e => setPlanEdit(x => ({ ...x, price_qar: e.target.value as any }))}
                          />
                        </td>
                        <td className="px-5 py-2">
                          <input
                            className={`${inputClass} w-28 tabular`}
                            type="number"
                            placeholder="unlimited"
                            defaultValue={p.monthly_reply_limit ?? ""}
                            onChange={e => setPlanEdit(x => ({ ...x, monthly_reply_limit: e.target.value === "" ? null : Number(e.target.value) as any }))}
                          />
                        </td>
                        <td className="px-5 py-2">
                          <input
                            className={`${inputClass} w-24 tabular`}
                            type="number"
                            placeholder="100"
                            defaultValue={p.broadcast_limit ?? 100}
                            onChange={e => setPlanEdit(x => ({ ...x, broadcast_limit: Number(e.target.value) || 100 }))}
                          />
                        </td>
                        <td className="px-5 py-2">
                          <Tag tone={p.active ? "good" : "neutral"}>{p.active ? "active" : "hidden"}</Tag>
                        </td>
                        <td className="px-5 py-2 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="primary" className="text-xs py-1 px-2.5" onClick={() => savePlanEdit(p.id)}>Save</Button>
                            <Button variant="quiet" className="text-xs py-1 px-2.5" onClick={() => { setEditingPlan(null); setPlanEdit({}); }}>Cancel</Button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-5 py-2 font-mono text-xs">{p.code}</td>
                        <td className="px-5 py-2 font-semibold text-ink">{p.name}</td>
                        <td className="px-5 py-2 tabular font-medium">{Number(p.price_qar) === 0 ? "Free" : `${p.price_qar} QAR`}</td>
                        <td className="px-5 py-2 tabular">{p.monthly_reply_limit ? p.monthly_reply_limit.toLocaleString() : "Unlimited"}</td>
                        <td className="px-5 py-2 tabular">{p.broadcast_limit ?? 100} / day</td>
                        <td className="px-5 py-2">
                          <Tag tone={p.active ? "good" : "neutral"}>{p.active ? "active" : "hidden"}</Tag>
                        </td>
                        <td className="px-5 py-2 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="quiet" className="text-xs py-1 px-2.5" onClick={() => { setEditingPlan(p.id); setPlanEdit({}); }}>Edit</Button>
                            <Button variant="quiet" className="text-xs py-1 px-2.5" onClick={() => togglePlan(p)}>
                              {p.active ? "Hide" : "Show"}
                            </Button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <form onSubmit={addPlan} className="grid sm:grid-cols-5 gap-3 border-t border-line pt-4">
            <Field label="Code">
              <input className={inputClass} required placeholder="enterprise"
                value={planDraft.code} onChange={e => setPlanDraft(d => ({ ...d, code: e.target.value }))} />
            </Field>
            <Field label="Name">
              <input className={inputClass} required placeholder="Enterprise Suite"
                value={planDraft.name} onChange={e => setPlanDraft(d => ({ ...d, name: e.target.value }))} />
            </Field>
            <Field label="Price (QAR)">
              <input className={`${inputClass} tabular`} type="number" step="0.01" placeholder="499"
                value={planDraft.price_qar} onChange={e => setPlanDraft(d => ({ ...d, price_qar: e.target.value }))} />
            </Field>
            <Field label="Reply limit" hint="Empty = unlimited">
              <input className={`${inputClass} tabular`} type="number" placeholder="3000"
                value={planDraft.monthly_reply_limit} onChange={e => setPlanDraft(d => ({ ...d, monthly_reply_limit: e.target.value }))} />
            </Field>
            <Field label="Daily Broadcast Cap">
              <input className={`${inputClass} tabular`} type="number" placeholder="200"
                value={planDraft.broadcast_limit} onChange={e => setPlanDraft(d => ({ ...d, broadcast_limit: e.target.value }))} />
            </Field>
            <div className="sm:col-span-5">
              <Button type="submit" disabled={savingPlan}>{savingPlan ? "Creating…" : "Add plan tier"}</Button>
            </div>
          </form>
        </Panel>
      </div>
      <Toast message={message} />
    </div>
  );
}
