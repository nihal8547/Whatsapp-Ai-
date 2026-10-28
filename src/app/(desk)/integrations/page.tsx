import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { q } from "@/lib/db";
import IntegrationsView from "./integrations-view";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage(props: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const searchParams = props.searchParams ? await props.searchParams : undefined;
  const initialTab = searchParams?.tab === "docs" ? "docs" : "keys";

  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.tenantId && session.superAdmin) redirect("/admin");
  if (!session.tenantId) redirect("/login");

  // Owner only access
  if (session.role === "staff" && !session.superAdmin) {
    redirect("/desk");
  }

  const tenantId = session.tenantId;

  // Preload initial keys, logs, and webhooks
  const [keysRows, logs, webhooksRows] = await Promise.all([
    q(
      `SELECT id, tenant_id, name, key_prefix, scopes, rate_limit_per_min,
              to_char(last_used_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS last_used_at,
              to_char(expires_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS expires_at,
              active,
              to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
         FROM wa_tenant_api_keys
        WHERE tenant_id = $1
        ORDER BY created_at DESC`,
      [tenantId]
    ),
    q(
      `SELECT l.id, l.tenant_id, l.key_id, l.method, l.path, l.status, l.ip,
              to_char(l.created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
              COALESCE(k.name, 'Unknown / Deleted key') AS key_name,
              k.key_prefix
         FROM wa_api_logs l
         LEFT JOIN wa_tenant_api_keys k ON k.id = l.key_id
        WHERE l.tenant_id = $1
        ORDER BY l.created_at DESC
        LIMIT 100`,
      [tenantId]
    ),
    q(
      `SELECT id, tenant_id, url, secret, events, active,
              to_char(last_triggered_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS last_triggered_at,
              fail_count,
              to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
         FROM wa_tenant_webhooks
        WHERE tenant_id = $1
        ORDER BY created_at DESC`,
      [tenantId]
    ),
  ]);

  const normalizeArray = (val: unknown): string[] => {
    if (Array.isArray(val)) return val.map(String);
    if (typeof val === "string") {
      const trimmed = val.trim();
      if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) return parsed.map(String);
        } catch {}
      }
      if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
        return trimmed
          .slice(1, -1)
          .split(",")
          .map((s) => s.replace(/^"|"$/g, "").trim())
          .filter(Boolean);
      }
      return trimmed.split(",").map((s) => s.trim()).filter(Boolean);
    }
    return [];
  };

  const initialKeys = keysRows.map((r) => ({
    ...r,
    scopes: normalizeArray(r.scopes),
  }));

  const initialWebhooks = webhooksRows.map((r) => ({
    ...r,
    events: normalizeArray(r.events),
  }));

  return (
    <IntegrationsView
      initialKeys={initialKeys}
      initialLogs={logs}
      initialWebhooks={initialWebhooks}
      initialTab={initialTab}
    />
  );
}
