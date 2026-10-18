import { redirect, notFound } from "next/navigation";
import { requireTenant } from "@/lib/auth";
import { q, one } from "@/lib/db";
import BroadcastDetailClient from "./detail-client";

export const dynamic = "force-dynamic";

export default async function BroadcastDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { tenantId, session } = await requireTenant();
  const isOwner = session.role === "owner" || session.superAdmin;
  if (!isOwner) {
    redirect("/contacts");
  }

  const { id } = await params;
  const broadcastId = Number(id);

  // 1. Fetch broadcast
  const broadcast = await one(
    `SELECT b.*,
            COALESCE(imp.filename, '') AS import_filename,
            COALESCE(u.full_name, u.email, '') AS creator_name
       FROM wa_broadcasts b
       LEFT JOIN wa_contact_imports imp ON imp.id = b.import_id
       LEFT JOIN wa_tenant_users u ON u.id = b.created_by
      WHERE b.id = $1 AND b.tenant_id = $2`,
    [broadcastId, tenantId]
  );

  if (!broadcast) notFound();

  // 2. Fetch counts
  const counts = await one<{
    total: string | number;
    queued: string | number;
    sending: string | number;
    sent: string | number;
    failed: string | number;
    skipped: string | number;
  }>(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE status = 'queued')::int AS queued,
       COUNT(*) FILTER (WHERE status = 'sending')::int AS sending,
       COUNT(*) FILTER (WHERE status = 'sent')::int AS sent,
       COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
       COUNT(*) FILTER (WHERE status = 'skipped')::int AS skipped
     FROM wa_broadcast_recipients
    WHERE broadcast_id = $1 AND tenant_id = $2`,
    [broadcastId, tenantId]
  );

  // 3. Replied count: inbound messages within 48 hours after sent_at
  const repliedRow = await one<{ replied_count: string | number }>(
    `SELECT COUNT(DISTINCT r.phone)::int AS replied_count
       FROM wa_broadcast_recipients r
       JOIN wa_messages m
         ON m.tenant_id = r.tenant_id
        AND m.phone = r.phone
        AND m.direction = 'inbound'
        AND m.created_at >= r.sent_at
        AND m.created_at <= r.sent_at + interval '48 hours'
      WHERE r.broadcast_id = $1 AND r.tenant_id = $2 AND r.status = 'sent'`,
    [broadcastId, tenantId]
  );

  // 4. Opt-outs after broadcast
  const optOutsRow = await one<{ optouts_count: string | number }>(
    `SELECT COUNT(DISTINCT r.phone)::int AS optouts_count
       FROM wa_broadcast_recipients r
       JOIN wa_contacts c
         ON c.tenant_id = r.tenant_id
        AND c.phone = r.phone
        AND c.consent_status = 'opted_out'
        AND c.opted_out_at >= r.sent_at
      WHERE r.broadcast_id = $1 AND r.tenant_id = $2 AND r.status = 'sent'`,
    [broadcastId, tenantId]
  );

  // 5. Recipients list (initial 200)
  const recipients = await q(
    `SELECT r.id, r.phone, r.status, r.skip_reason, r.error, r.sent_at, r.created_at,
            COALESCE(c.name, '') AS contact_name,
            EXISTS(
              SELECT 1 FROM wa_messages m
               WHERE m.tenant_id = r.tenant_id
                 AND m.phone = r.phone
                 AND m.direction = 'inbound'
                 AND m.created_at >= r.sent_at
                 AND m.created_at <= r.sent_at + interval '48 hours'
            ) AS has_replied
       FROM wa_broadcast_recipients r
       LEFT JOIN wa_contacts c ON c.tenant_id = r.tenant_id AND c.phone = r.phone
      WHERE r.broadcast_id = $1 AND r.tenant_id = $2
      ORDER BY r.id ASC LIMIT 200`,
    [broadcastId, tenantId]
  );

  // WhatsApp connection check
  const instance = await one<{ status: string }>(
    `SELECT status FROM wa_instances WHERE tenant_id = $1`,
    [tenantId]
  );

  const bot = await one<{ timezone: string }>(
    `SELECT timezone FROM wa_bot_settings WHERE tenant_id = $1`,
    [tenantId]
  );

  return (
    <BroadcastDetailClient
      broadcast={broadcast}
      counts={{
        total: Number(counts?.total ?? 0),
        queued: Number(counts?.queued ?? 0),
        sending: Number(counts?.sending ?? 0),
        sent: Number(counts?.sent ?? 0),
        failed: Number(counts?.failed ?? 0),
        skipped: Number(counts?.skipped ?? 0),
        replied: Number(repliedRow?.replied_count ?? 0),
        optOuts: Number(optOutsRow?.optouts_count ?? 0),
      }}
      initialRecipients={recipients}
      whatsappConnected={instance?.status === "connected"}
      timezone={bot?.timezone || "Asia/Qatar"}
    />
  );
}
