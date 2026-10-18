import { redirect } from "next/navigation";
import { requireTenant } from "@/lib/auth";
import { q, one } from "@/lib/db";
import { getEffectiveBroadcastCap } from "@/lib/broadcasts";
import BroadcastsClient from "./broadcasts-client";

export const dynamic = "force-dynamic";

export default async function BroadcastsPage() {
  const { tenantId, session } = await requireTenant();
  const isOwner = session.role === "owner" || session.superAdmin;
  if (!isOwner) {
    redirect("/contacts");
  }

  // 1. Fetch broadcasts
  const broadcasts = await q(
    `SELECT
       b.id, b.name, b.message, b.status, b.pause_reason,
       b.scheduled_at, b.started_at, b.finished_at, b.created_at,
       b.import_id,
       COALESCE(imp.filename, '') AS import_filename,
       COALESCE(u.full_name, u.email, '') AS creator_name,
       COUNT(r.id)::int AS total_recipients,
       COUNT(r.id) FILTER (WHERE r.status = 'queued')::int AS queued_count,
       COUNT(r.id) FILTER (WHERE r.status = 'sending')::int AS sending_count,
       COUNT(r.id) FILTER (WHERE r.status = 'sent')::int AS sent_count,
       COUNT(r.id) FILTER (WHERE r.status = 'failed')::int AS failed_count,
       COUNT(r.id) FILTER (WHERE r.status = 'skipped')::int AS skipped_count,
       COUNT(r.id) FILTER (WHERE r.status = 'skipped' AND r.skip_reason = 'cancelled')::int AS skipped_cancelled,
       COUNT(r.id) FILTER (WHERE r.status = 'skipped' AND r.skip_reason = 'opted_out')::int AS skipped_opted_out
     FROM wa_broadcasts b
     LEFT JOIN wa_contact_imports imp ON imp.id = b.import_id
     LEFT JOIN wa_tenant_users u ON u.id = b.created_by
     LEFT JOIN wa_broadcast_recipients r ON r.broadcast_id = b.id
    WHERE b.tenant_id = $1
    GROUP BY b.id, imp.filename, u.full_name, u.email
    ORDER BY b.created_at DESC`,
    [tenantId]
  );

  // 2. Fetch past import batches for audience dropdown
  const imports = await q(
    `SELECT id, filename, total_rows, valid_rows, created_at
       FROM wa_contact_imports
      WHERE tenant_id = $1
      ORDER BY created_at DESC LIMIT 30`,
    [tenantId]
  );

  // 3. Caps & WhatsApp status
  const [caps, instance, bot] = await Promise.all([
    getEffectiveBroadcastCap(tenantId),
    one<{ status: string }>(`SELECT status FROM wa_instances WHERE tenant_id = $1`, [tenantId]),
    one<{ business_name: string; timezone: string }>(
      `SELECT business_name, timezone FROM wa_bot_settings WHERE tenant_id = $1`,
      [tenantId]
    ),
  ]);

  return (
    <BroadcastsClient
      initialBroadcasts={broadcasts}
      imports={imports}
      caps={caps}
      whatsappConnected={instance?.status === "connected"}
      businessName={bot?.business_name || "My Business"}
      timezone={bot?.timezone || "Asia/Qatar"}
    />
  );
}
