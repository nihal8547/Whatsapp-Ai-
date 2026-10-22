import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { q } from "@/lib/db";
import { PageHead, Panel, Tag } from "@/components/ui";
import { fullStamp } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminSafetyPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.superAdmin) redirect("/desk");

  const events = await q<{
    id: number;
    tenant_id: number;
    tenant_name: string;
    kind: string;
    detail: string;
    created_at: string;
  }>(`
    SELECT se.id, se.tenant_id, COALESCE(t.name, 'Workspace #' || se.tenant_id) AS tenant_name,
           se.kind, se.detail,
           to_char(se.created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
      FROM wa_safety_events se
      LEFT JOIN wa_tenants t ON t.id = se.tenant_id
     ORDER BY se.created_at DESC, se.id DESC
     LIMIT 100
  `);

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      <div>
        <PageHead
          title="Safety & Audit Logs"
          lead="Platform-wide audit of bot rate limits, emergency pauses, and reply loops."
        />
        <Panel pad={false}>
          <div className="px-5 py-4 border-b border-line flex items-center justify-between">
            <h2 className="font-semibold text-sm">Recent Platform Safety Events ({events.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-line">
                <tr className="text-left text-ink-soft">
                  <th className="px-5 py-2.5 font-medium">Time</th>
                  <th className="px-5 py-2.5 font-medium">Workspace</th>
                  <th className="px-5 py-2.5 font-medium">Event Kind</th>
                  <th className="px-5 py-2.5 font-medium">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {events.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-6 text-center text-ink-soft">
                      No safety events logged. Everything is operating normally.
                    </td>
                  </tr>
                ) : (
                  events.map(ev => (
                    <tr key={ev.id} className="hover:bg-canvas">
                      <td className="px-5 py-2.5 text-xs text-ink-soft whitespace-nowrap">
                        {fullStamp(ev.created_at)}
                      </td>
                      <td className="px-5 py-2.5 font-medium text-ink">
                        {ev.tenant_name}
                      </td>
                      <td className="px-5 py-2.5">
                        <Tag tone={ev.kind.includes("pause") ? "warn" : ev.kind.includes("loop") ? "bad" : "neutral"}>
                          {ev.kind.replace(/_/g, " ")}
                        </Tag>
                      </td>
                      <td className="px-5 py-2.5 text-xs text-ink-soft">
                        {ev.detail || "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}
