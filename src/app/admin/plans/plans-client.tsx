"use client";

import { useState } from "react";
import { Button, Field, inputClass, Panel, PageHead, Tag, Toast, useToast } from "@/components/ui";

type Plan = {
  id: number;
  code: string;
  name: string;
  price_qar: string;
  monthly_reply_limit: number | null;
  active: boolean;
};

export default function PlansManager({ initialPlans }: { initialPlans: Plan[] }) {
  const { message, show } = useToast();
  const [plans, setPlans] = useState(initialPlans);
  const [planDraft, setPlanDraft] = useState({ code: "", name: "", price_qar: "", monthly_reply_limit: "" });
  const [editingPlan, setEditingPlan] = useState<number | null>(null);
  const [planEdit, setPlanEdit] = useState<Partial<Plan>>({});
  const [savingPlan, setSavingPlan] = useState(false);

  async function refreshPlans() {
    const res = await fetch("/api/admin/tenants");
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
      }),
    });
    setSavingPlan(false);
    const d = await res.json();
    if (!d.ok) return show("Could not create plan: " + (d.error ?? "error"));
    setPlanDraft({ code: "", name: "", price_qar: "", monthly_reply_limit: "" });
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
        <PageHead title="Plans & Pricing" lead="Configure subscription tiers, QAR pricing, and monthly reply limits." />
        <Panel>
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
                        <td className="px-5 py-2">
                          <input
                            className={`${inputClass} w-28`}
                            defaultValue={p.code}
                            onChange={e => setPlanEdit(x => ({ ...x, code: e.target.value }))}
                          />
                        </td>
                        <td className="px-5 py-2">
                          <input
                            className={`${inputClass} w-36`}
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
                          <Tag tone={p.active ? "good" : "neutral"}>{p.active ? "active" : "hidden"}</Tag>
                        </td>
                        <td className="px-5 py-2 flex gap-2">
                          <Button variant="primary" className="text-xs py-1 px-2.5" onClick={() => savePlanEdit(p.id)}>Save</Button>
                          <Button variant="quiet" className="text-xs py-1 px-2.5" onClick={() => { setEditingPlan(null); setPlanEdit({}); }}>Cancel</Button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-5 py-2 font-mono text-xs">{p.code}</td>
                        <td className="px-5 py-2 font-medium">{p.name}</td>
                        <td className="px-5 py-2 tabular">{p.price_qar}</td>
                        <td className="px-5 py-2 tabular">{p.monthly_reply_limit ?? "Unlimited"}</td>
                        <td className="px-5 py-2">
                          <Tag tone={p.active ? "good" : "neutral"}>{p.active ? "active" : "hidden"}</Tag>
                        </td>
                        <td className="px-5 py-2 flex gap-2">
                          <Button variant="quiet" className="text-xs py-1 px-2.5" onClick={() => { setEditingPlan(p.id); setPlanEdit({}); }}>Edit</Button>
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
            <Field label="Code">
              <input className={inputClass} required placeholder="starter"
                value={planDraft.code} onChange={e => setPlanDraft(d => ({ ...d, code: e.target.value }))} />
            </Field>
            <Field label="Name">
              <input className={inputClass} required placeholder="Starter Plan"
                value={planDraft.name} onChange={e => setPlanDraft(d => ({ ...d, name: e.target.value }))} />
            </Field>
            <Field label="Price (QAR)">
              <input className={`${inputClass} tabular`} type="number" step="0.01" placeholder="299"
                value={planDraft.price_qar} onChange={e => setPlanDraft(d => ({ ...d, price_qar: e.target.value }))} />
            </Field>
            <Field label="Reply limit" hint="Empty = unlimited">
              <input className={`${inputClass} tabular`} type="number" placeholder="1000"
                value={planDraft.monthly_reply_limit} onChange={e => setPlanDraft(d => ({ ...d, monthly_reply_limit: e.target.value }))} />
            </Field>
            <div className="sm:col-span-4">
              <Button type="submit" disabled={savingPlan}>{savingPlan ? "Creating…" : "Add plan"}</Button>
            </div>
          </form>
        </Panel>
      </div>
      <Toast message={message} />
    </div>
  );
}
