"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Field, inputClass, Panel, PageHead, Tag, Toast, useToast } from "@/components/ui";

type Tenant = {
  id: number;
  name: string;
  slug: string;
  status: string;
  plan: string;
  broadcasts_enabled: boolean;
  broadcast_daily_cap: number;
  active_broadcasts: number;
  sent_broadcasts: number;
};

type PlatformSettings = {
  broadcast_daily_max: number;
  proactive_enabled: boolean;
};

export default function BroadcastsManager({
  initialTenants,
  platformSettings: initPS,
}: {
  initialTenants: Tenant[];
  platformSettings: PlatformSettings;
}) {
  const { message, show } = useToast();
  const [tenants, setTenants] = useState<Tenant[]>(initialTenants);
  const [ps, setPs] = useState<PlatformSettings>(initPS);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [savingPs, setSavingPs] = useState(false);
  const [search, setSearch] = useState("");

  async function toggleTenantBroadcast(t: Tenant) {
    const nextVal = !t.broadcasts_enabled;
    setSavingId(t.id);
    const res = await fetch(`/api/admin/tenants/${t.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ broadcasts_enabled: nextVal }),
    });
    setSavingId(null);
    const d = await res.json();
    if (!d.ok) return show("Could not update broadcast permission.");
    setTenants(prev => prev.map(item => item.id === t.id ? { ...item, broadcasts_enabled: nextVal } : item));
    show(nextVal ? `Broadcasts enabled for ${t.name}` : `Broadcasts disabled for ${t.name}`);
  }

  async function updateDailyCap(t: Tenant, newCap: number) {
    if (!newCap || newCap < 1) return;
    setSavingId(t.id);
    const res = await fetch(`/api/admin/tenants/${t.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ broadcast_daily_cap: newCap }),
    });
    setSavingId(null);
    const d = await res.json();
    if (!d.ok) return show("Could not update broadcast cap.");
    setTenants(prev => prev.map(item => item.id === t.id ? { ...item, broadcast_daily_cap: newCap } : item));
    show(`Daily cap updated to ${newCap} for ${t.name}`);
  }

  async function savePlatformMax() {
    setSavingPs(true);
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ broadcast_daily_max: ps.broadcast_daily_max }),
    });
    setSavingPs(false);
    const d = await res.json();
    show(d.ok ? "Global platform broadcast cap saved." : "Could not save platform cap.");
  }

  const filtered = tenants.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.slug.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      <div>
        <PageHead
          title="Broadcast Controls & Governance"
          lead="Manage which workspaces can send bulk WhatsApp campaigns and set safety limits."
        />

        {/* ── Global Broadcast Safety Bar ── */}
        <Panel className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="font-semibold text-sm">Platform-wide Broadcast Safety</h2>
              <p className="text-xs text-ink-soft mt-0.5">
                Hard ceiling for daily campaign messages across all workspaces to prevent carrier spam bans.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-ink-soft whitespace-nowrap">Global Max / Workspace:</span>
              <input
                type="number"
                min={1}
                className={`${inputClass} w-24 tabular py-1 px-2 text-xs`}
                value={ps.broadcast_daily_max}
                onChange={e => setPs({ ...ps, broadcast_daily_max: Number(e.target.value) })}
              />
              <Button
                variant="primary"
                disabled={savingPs}
                onClick={savePlatformMax}
                className="text-xs py-1 px-3 shrink-0"
              >
                {savingPs ? "Saving…" : "Save Global Max"}
              </Button>
            </div>
          </div>
        </Panel>

        {/* ── Workspaces Broadcast Permissions Table ── */}
        <Panel pad={false}>
          <div className="p-5 border-b border-line flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="font-semibold">Workspace Permissions ({tenants.length})</h2>
              <p className="text-xs text-ink-soft mt-0.5">
                Toggle bulk messaging on or off per client and set custom daily caps.
              </p>
            </div>
            <div>
              <input
                type="search"
                placeholder="Search workspaces…"
                className={`${inputClass} w-64 text-xs py-1.5`}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-line">
                <tr className="text-left text-ink-soft">
                  <th className="px-5 py-3 font-medium">Workspace</th>
                  <th className="px-5 py-3 font-medium">Plan</th>
                  <th className="px-5 py-3 font-medium">Broadcast Status</th>
                  <th className="px-5 py-3 font-medium">Daily Recipient Cap</th>
                  <th className="px-5 py-3 font-medium">Active / Sent</th>
                  <th className="px-5 py-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map(t => (
                  <tr key={t.id} className="hover:bg-canvas">
                    <td className="px-5 py-3">
                      <Link href={`/admin/tenants/${t.id}`} className="font-medium hover:underline text-pine-deep">
                        {t.name}
                      </Link>
                      <p className="text-xs text-ink-faint">{t.slug}</p>
                    </td>
                    <td className="px-5 py-3 text-xs">
                      <Tag tone="neutral">{t.plan}</Tag>
                    </td>
                    <td className="px-5 py-3">
                      <Tag tone={t.broadcasts_enabled ? "good" : "bad"}>
                        {t.broadcasts_enabled ? "Allowed" : "Blocked"}
                      </Tag>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={1}
                          className={`${inputClass} w-20 py-1 px-2 text-xs tabular`}
                          defaultValue={t.broadcast_daily_cap}
                          disabled={savingId === t.id}
                          onBlur={e => updateDailyCap(t, Number(e.target.value))}
                        />
                        <span className="text-xs text-ink-faint">/ day</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-xs tabular text-ink-soft">
                      <span className="font-semibold text-ink">{t.active_broadcasts}</span> active · {t.sent_broadcasts} completed
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Button
                        variant={t.broadcasts_enabled ? "quiet" : "primary"}
                        disabled={savingId === t.id}
                        onClick={() => toggleTenantBroadcast(t)}
                        className="text-xs py-1 px-2.5"
                      >
                        {savingId === t.id ? "…" : t.broadcasts_enabled ? "Revoke Access" : "Grant Access"}
                      </Button>
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
