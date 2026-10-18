import { requireOwner, errorResponse } from "@/lib/auth";
import { q, one, tx } from "@/lib/db";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { tenantId } = await requireOwner(req);
    const { id } = await ctx.params;
    const broadcastId = Number(id);

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

    if (!broadcast) {
      return Response.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const statusFilter = (searchParams.get("status") || "").trim();
    const search = (searchParams.get("search") || "").trim();

    // Summary counts
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

    // Replied count: inbound messages within 48 hours after sent_at
    const repliedRow = await one<{ replied_count: string | number }>(
      `SELECT COUNT(DISTINCT r.phone)::int AS replied_count
         FROM wa_broadcast_recipients r
         JOIN wa_messages m
           ON m.tenant_id = r.tenant_id
          AND m.phone = r.phone
          AND m.direction IN ('in', 'inbound')
          AND m.created_at >= r.sent_at
          AND m.created_at <= r.sent_at + interval '48 hours'
        WHERE r.broadcast_id = $1 AND r.tenant_id = $2 AND r.status = 'sent'`,
      [broadcastId, tenantId]
    );

    // Opt-outs after broadcast: contacts who received message and opted out after sent_at
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

    // Recipients list
    let recQuery = `
      SELECT r.id, r.phone, r.status, r.skip_reason, r.error, r.sent_at, r.created_at,
             COALESCE(c.name, '') AS contact_name,
             EXISTS(
               SELECT 1 FROM wa_messages m
                WHERE m.tenant_id = r.tenant_id
                  AND m.phone = r.phone
                  AND m.direction IN ('in', 'inbound')
                  AND m.created_at >= r.sent_at
                  AND m.created_at <= r.sent_at + interval '48 hours'
             ) AS has_replied
        FROM wa_broadcast_recipients r
        LEFT JOIN wa_contacts c ON c.tenant_id = r.tenant_id AND c.phone = r.phone
       WHERE r.broadcast_id = $1 AND r.tenant_id = $2
    `;
    const recParams: any[] = [broadcastId, tenantId];

    if (statusFilter) {
      recParams.push(statusFilter);
      recQuery += ` AND r.status = $${recParams.length}`;
    }
    if (search) {
      recParams.push(`%${search}%`);
      recQuery += ` AND (r.phone ILIKE $${recParams.length} OR COALESCE(c.name,'') ILIKE $${recParams.length})`;
    }

    recQuery += ` ORDER BY r.id ASC LIMIT 200`;
    const recipients = await q(recQuery, recParams);

    return Response.json({
      ok: true,
      broadcast,
      counts: {
        total: Number(counts?.total ?? 0),
        queued: Number(counts?.queued ?? 0),
        sending: Number(counts?.sending ?? 0),
        sent: Number(counts?.sent ?? 0),
        failed: Number(counts?.failed ?? 0),
        skipped: Number(counts?.skipped ?? 0),
        replied: Number(repliedRow?.replied_count ?? 0),
        optOuts: Number(optOutsRow?.optouts_count ?? 0),
      },
      recipients,
    });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { tenantId } = await requireOwner(req);
    const { id } = await ctx.params;
    const broadcastId = Number(id);
    const body = await req.json();
    const action = String(body.action ?? "").toLowerCase();

    // Verify broadcast belongs to this tenant
    const existing = await one<{ id: number; status: string; name: string }>(
      `SELECT id, status, name FROM wa_broadcasts WHERE id = $1 AND tenant_id = $2`,
      [broadcastId, tenantId]
    );
    if (!existing) {
      return Response.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    if (action === "pause") {
      const reason = String(body.reason ?? "Paused by user").trim();
      await one(
        `UPDATE wa_broadcasts
            SET status = 'paused',
                pause_reason = $3,
                updated_at = now()
          WHERE id = $1 AND tenant_id = $2 RETURNING id`,
        [broadcastId, tenantId, reason]
      );
      return Response.json({ ok: true, status: "paused", pause_reason: reason });
    }

    if (action === "resume") {
      // Resume is refused while WhatsApp number is not connected
      const instance = await one<{ status: string }>(
        `SELECT status FROM wa_instances WHERE tenant_id = $1`,
        [tenantId]
      );
      if (instance?.status !== "connected") {
        return Response.json(
          {
            ok: false,
            error: "whatsapp_not_connected",
            message: "Cannot resume broadcast: WhatsApp number is not connected.",
          },
          { status: 400 }
        );
      }

      await one(
        `UPDATE wa_broadcasts
            SET status = 'running',
                pause_reason = NULL,
                started_at = COALESCE(started_at, now()),
                updated_at = now()
          WHERE id = $1 AND tenant_id = $2 RETURNING id`,
        [broadcastId, tenantId]
      );
      return Response.json({ ok: true, status: "running" });
    }

    if (action === "cancel") {
      // Cancel sets queued recipients to skipped with skip_reason cancelled and the broadcast to cancelled
      await tx(async (client) => {
        await client.query(
          `UPDATE wa_broadcast_recipients
              SET status = 'skipped',
                  skip_reason = 'cancelled'
            WHERE broadcast_id = $1 AND tenant_id = $2 AND status = 'queued'`,
          [broadcastId, tenantId]
        );

        await client.query(
          `UPDATE wa_broadcasts
              SET status = 'cancelled',
                  finished_at = now(),
                  updated_at = now()
            WHERE id = $1 AND tenant_id = $2`,
          [broadcastId, tenantId]
        );
      });

      return Response.json({ ok: true, status: "cancelled" });
    }

    return Response.json({ ok: false, error: "invalid_action" }, { status: 400 });
  } catch (e) {
    return errorResponse(e);
  }
}
