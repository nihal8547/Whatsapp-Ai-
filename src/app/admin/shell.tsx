"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, inputClass, Panel, PageHead, Tag, Toast, useToast } from "@/components/ui";

type Tenant = {
  id: number;
  name: string;
  slug: string;
  status: string;
  business_type: string | null;
  plan: string;
  plan_id: number | null;
  wa_status: string;
  replies_month: string;
  trial_ends_at: string | null;
};

const STATUS_TONES: Record<string, "good" | "warn" | "bad" | "neutral"> = {
  active: "good",
  trial: "warn",
  suspended: "bad",
  cancelled: "neutral",
};

const WA_TONES: Record<string, "good" | "neutral"> = {
  connected: "good",
};

export default function AdminShell({
  initialTenants,
}: {
  initialTenants: Tenant[];
  allPlans?: any;
  hasOwnTenant?: boolean;
  platformSettings?: any;
  overview?: any;
  platform30Days?: any;
}) {
  const router = useRouter();
  const { message, show } = useToast();
  const [tenants, setTenants] = useState<Tenant[]>(initialTenants);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [switchingId, setSwitchingId] = useState<number | null>(null);

  async function impersonate(id: number, name: string) {
    setSwitchingId(id);
    const res = await fetch("/api/admin/impersonate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenantId: id }),
    });
    setSwitchingId(null);
    const d = await res.json();
    if (!d.ok) return show("Could not switch workspace context.");
    show(`Switched to ${name}`);
    router.push("/desk");
    router.refresh();
  }

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

  const filtered = tenants.filter(t => {
    const matchesSearch =
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.slug.toLowerCase().includes(search.toLowerCase()) ||
      (t.business_type && t.business_type.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === "all" || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHead
          title="Client Workspaces"
          lead="Manage all tenant instances, modules, WhatsApp connections, and subscription statuses."
        />
        <div className="flex items-center gap-2">
          <Link
            href="/admin/overview"
            className="text-xs text-ink-soft hover:text-ink border border-line rounded px-3 py-1.5 hover:bg-canvas"
          >
            📊 View Stats
          </Link>
          <Link
            href="/admin/broadcasts"
            className="text-xs text-ink-soft hover:text-ink border border-line rounded px-3 py-1.5 hover:bg-canvas"
          >
            📢 Broadcast Governance
          </Link>
        </div>
      </div>

      <Panel pad={false}>
        <div className="p-5 border-b border-line flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <input
              type="search"
              placeholder="Search workspaces by name or slug…"
              className={`${inputClass} w-64 text-xs py-1.5`}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <select
              className={`${inputClass} w-36 text-xs py-1.5`}
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="trial">Trial</option>
              <option value="suspended">Suspended</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <span className="text-xs text-ink-soft">
            Showing <strong className="text-ink">{filtered.length}</strong> of {tenants.length} workspaces
          </span>
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
                <th className="px-5 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-ink-soft">
                    No workspaces match your filters.
                  </td>
                </tr>
              ) : (
                filtered.map(t => (
                  <tr key={t.id} className="hover:bg-canvas">
                    <td className="px-5 py-3">
                      <Link href={`/admin/tenants/${t.id}`} className="font-medium hover:underline text-pine-deep">
                        {t.name}
                      </Link>
                      <p className="text-xs text-ink-faint">
                        {t.slug}
                        {t.business_type ? ` · ${t.business_type}` : ""}
                      </p>
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
                        <Button
                          variant="quiet"
                          disabled={switchingId === t.id}
                          onClick={() => impersonate(t.id, t.name)}
                          className="text-xs py-1 px-2 text-pine hover:bg-pine-wash/40"
                          title="Instant switch into workspace desk"
                        >
                          {switchingId === t.id ? "…" : "⚡ Login"}
                        </Button>
                        <Link
                          href={`/admin/tenants/${t.id}`}
                          className="text-xs text-ink-soft hover:text-ink border border-line rounded px-2.5 py-1 hover:bg-canvas transition-colors"
                        >
                          Manage Modules & Details →
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <Toast message={message} />
    </div>
  );
}
