"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Panel, PageHead, Tag, Toast, useToast } from "@/components/ui";

type Tenant = {
  id: number;
  name: string;
  slug: string;
  status: string;
  plan: string;
  plan_id: number | null;
  wa_status: string;
  replies_month: string;
  contacts: string;
  bookings: string;
  trial_ends_at: string | null;
};
type Plan = { id: number; code: string; name: string; monthly_reply_limit: number | null };

export default function AdminTable({
  initialTenants,
  plans,
  hasOwnTenant,
}: {
  initialTenants: Tenant[];
  plans: Plan[];
  hasOwnTenant: boolean;
}) {
  const [tenants, setTenants] = useState(initialTenants);
  const router = useRouter();
  const { message, show } = useToast();

  async function update(id: number, patch: Record<string, unknown>) {
    const res = await fetch(`/api/admin/tenants/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (!data.ok) return show("Could not update that workspace.");
    const fresh = await (await fetch("/api/admin/tenants")).json();
    if (fresh.ok) setTenants(fresh.tenants);
    show("Workspace updated");
    router.refresh();
  }

  return (
    <div className="min-h-screen">
      <header className="bg-panel border-b border-line px-6 lg:px-8 py-4 flex items-center justify-between">
        <p className="font-semibold">Platform admin</p>
        <div className="flex items-center gap-4 text-sm">
          {hasOwnTenant && (
            <Link href="/desk" className="text-pine hover:underline">
              My workspace
            </Link>
          )}
          <button
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              router.push("/login");
            }}
            className="text-ink-soft hover:text-ink"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="p-6 lg:p-8">
        <PageHead
          title="Workspaces"
          lead="Every business on the platform, what they use, and whether they can keep using it."
        />

        <Panel pad={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-line">
                <tr className="text-left text-ink-soft">
                  <th className="px-5 py-3 font-medium">Workspace</th>
                  <th className="px-5 py-3 font-medium">WhatsApp</th>
                  <th className="px-5 py-3 font-medium">Replies</th>
                  <th className="px-5 py-3 font-medium">People</th>
                  <th className="px-5 py-3 font-medium">Bookings</th>
                  <th className="px-5 py-3 font-medium">Plan</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {tenants.map((t) => (
                  <tr key={t.id}>
                    <td className="px-5 py-3">
                      <Link href={`/desk?tenant=${t.id}`} className="font-medium hover:underline">
                        {t.name}
                      </Link>
                      <p className="text-xs text-ink-faint tabular">{t.slug}</p>
                    </td>
                    <td className="px-5 py-3">
                      <Tag tone={t.wa_status === "connected" ? "good" : "neutral"}>{t.wa_status}</Tag>
                    </td>
                    <td className="px-5 py-3 tabular">{t.replies_month}</td>
                    <td className="px-5 py-3 tabular">{t.contacts}</td>
                    <td className="px-5 py-3 tabular">{t.bookings}</td>
                    <td className="px-5 py-3">
                      <select
                        value={t.plan_id ?? ""}
                        onChange={(e) => update(t.id, { plan_id: Number(e.target.value) })}
                        className="rounded border border-line px-2 py-1 text-sm bg-panel"
                      >
                        {plans.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-5 py-3">
                      <select
                        value={t.status}
                        onChange={(e) => update(t.id, { status: e.target.value })}
                        className="rounded border border-line px-2 py-1 text-sm bg-panel"
                      >
                        {["trial", "active", "suspended", "cancelled"].map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
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
