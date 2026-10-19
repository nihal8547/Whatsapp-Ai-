import { requireOwner, errorResponse } from "@/lib/auth";
import { q, one, tx } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { tenantId } = await requireOwner(req);

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

    // Compute progress % for each
    const list = broadcasts.map((b) => {
      const total = Number(b.total_recipients);
      const sent = Number(b.sent_count);
      const progress = total > 0 ? Math.round((sent / total) * 100) : 0;
      return {
        ...b,
        progress,
      };
    });

    return Response.json({ ok: true, broadcasts: list });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const { tenantId, session } = await requireOwner(req);
    const body = await req.json();

    const name = String(body.name ?? "").trim();
    if (!name) {
      return Response.json({ ok: false, error: "name_required", message: "Broadcast name is required." }, { status: 400 });
    }

    const message = String(body.message ?? "").trim();
    if (!message || message.length > 1000) {
      return Response.json(
        { ok: false, error: "invalid_message", message: "Message must be between 1 and 1000 characters." },
        { status: 400 }
      );
    }

    // Check concurrency: Only ONE running or scheduled broadcast per tenant (409 otherwise)
    const activeBroadcast = await one<{ id: number; name: string; status: string }>(
      `SELECT id, name, status FROM wa_broadcasts
        WHERE tenant_id = $1 AND status IN ('running', 'scheduled')
        LIMIT 1`,
      [tenantId]
    );

    if (activeBroadcast) {
      return Response.json(
        {
          ok: false,
          error: "another_broadcast_active",
          message: `There is already an active broadcast ("${activeBroadcast.name}" - ${activeBroadcast.status}). Only one running or scheduled broadcast per workspace is allowed.`,
        },
        { status: 409 }
      );
    }

    // Check WhatsApp connection
    const instance = await one<{ status: string }>(
      `SELECT status FROM wa_instances WHERE tenant_id = $1`,
      [tenantId]
    );
    if (instance?.status !== "connected") {
      return Response.json(
        {
          ok: false,
          error: "whatsapp_not_connected",
          message: "Cannot start a broadcast because your WhatsApp number is not connected. Connect your number first.",
        },
        { status: 400 }
      );
    }

    const importId = body.importId ? Number(body.importId) : null;
    const scheduledAtRaw = body.scheduledAt ? String(body.scheduledAt) : null;

    // Validate variables in template: allow {name}, {business}, and any custom field key for audience
    const varMatches = Array.from(message.matchAll(/\{([^{}|]+)(?:\|([^{}]*))?\}/g));
    const usedVariables = varMatches.map((m: any) => ({
      raw: m[0],
      key: m[1].trim(),
      fallback: m[2] !== undefined ? m[2] : null,
    }));

    let audienceCondition = "c.tenant_id = $1 AND c.consent_status = 'opted_in'";
    const audienceParams: any[] = [tenantId];
    if (importId) {
      audienceParams.push(`import:${importId}`);
      audienceCondition += ` AND $2 = ANY(c.tags)`;
    }

    const availableKeyRows = await q<{ key: string }>(
      `SELECT DISTINCT jsonb_object_keys(c.attributes) AS key
         FROM wa_contacts c
        WHERE ${audienceCondition}
          AND c.attributes IS NOT NULL
          AND c.attributes != '{}'::jsonb`,
      audienceParams
    );
    const audienceCustomKeys = availableKeyRows.map((r) => r.key);
    const allowedVariables = new Set(["name", "business", ...audienceCustomKeys.map((k) => k.toLowerCase())]);

    for (const v of usedVariables) {
      if (!allowedVariables.has(v.key.toLowerCase())) {
        return Response.json(
          {
            ok: false,
            error: "unknown_variable",
            message: `Unknown variable '{${v.key}}'. Allowed variables for this audience: {name}, {business}${
              audienceCustomKeys.length > 0
                ? ", " + audienceCustomKeys.map((k) => "{" + k + "}").join(", ")
                : ""
            }.`,
          },
          { status: 400 }
        );
      }
    }

    // Get tenant business name for {business}
    const bot = await one<{ business_name: string }>(
      `SELECT business_name FROM wa_bot_settings WHERE tenant_id = $1`,
      [tenantId]
    );
    const businessName = bot?.business_name || "My Business";

    let isScheduled = false;
    let scheduledDate: Date | null = null;
    if (scheduledAtRaw) {
      const parsed = new Date(scheduledAtRaw);
      if (!isNaN(parsed.getTime()) && parsed > new Date()) {
        isScheduled = true;
        scheduledDate = parsed;
      }
    }

    const status = isScheduled ? "scheduled" : "running";
    const startedAt = isScheduled ? null : new Date();

    const broadcast = await tx(async (client) => {
      // 1. Insert broadcast row
      const bcRes = await client.query(
        `INSERT INTO wa_broadcasts (
           tenant_id, name, message, status, scheduled_at, started_at,
           import_id, created_by, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), now())
         RETURNING id`,
        [tenantId, name, message, status, scheduledDate, startedAt, importId, session.userId]
      );
      const broadcastId = bcRes.rows[0].id;

      // 2. Fetch eligible contacts for this audience
      const eligibleContactsRes = await client.query(
        `SELECT c.phone, COALESCE(c.name, '') AS name, COALESCE(c.attributes, '{}'::jsonb) AS attributes
           FROM wa_contacts c
          WHERE ${audienceCondition}`,
        audienceParams
      );

      let recipientCount = 0;
      let blockedCount = 0;

      // 3. Render per recipient and insert into wa_broadcast_recipients
      for (const contact of eligibleContactsRes.rows) {
        let recipientStatus = "queued";
        let skipReason: string | null = null;
        let renderedText: string | null = message;

        for (const v of usedVariables) {
          const k = v.key.toLowerCase();
          let resolvedVal: string | null = null;

          if (k === "name") {
            resolvedVal = contact.name || v.fallback || "";
          } else if (k === "business") {
            resolvedVal = businessName || v.fallback || "";
          } else {
            // Custom field key lookup
            const attrVal = contact.attributes ? contact.attributes[v.key] : undefined;
            if (attrVal !== undefined && attrVal !== null && String(attrVal).trim() !== "") {
              resolvedVal = String(attrVal).trim();
            } else if (v.fallback !== null) {
              resolvedVal = v.fallback;
            } else {
              // Missing field without fallback -> block recipient with clear report
              recipientStatus = "skipped";
              skipReason = `missing_variable: ${v.key}`;
              renderedText = null;
              break;
            }
          }

          if (renderedText !== null) {
            renderedText = renderedText.replace(v.raw, resolvedVal ?? "");
          }
        }

        if (recipientStatus === "queued") {
          recipientCount++;
        } else {
          blockedCount++;
        }

        await client.query(
          `INSERT INTO wa_broadcast_recipients (
             broadcast_id, tenant_id, phone, status, skip_reason, rendered_text, created_at
           ) VALUES ($1, $2, $3, $4, $5, $6, now())
           ON CONFLICT (broadcast_id, phone) DO NOTHING`,
          [
            broadcastId,
            tenantId,
            contact.phone,
            recipientStatus,
            skipReason,
            renderedText,
          ]
        );
      }

      return {
        broadcastId,
        recipientCount,
        blockedCount,
        status,
      };
    });

    return Response.json({
      ok: true,
      broadcastId: broadcast.broadcastId,
      recipientsCreated: broadcast.recipientCount,
      recipientsBlocked: broadcast.blockedCount,
      status: broadcast.status,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
