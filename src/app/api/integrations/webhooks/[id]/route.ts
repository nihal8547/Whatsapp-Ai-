import { requireOwner, errorResponse } from "@/lib/auth";
import { one } from "@/lib/db";

function normalizeEvents(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") {
    const trimmed = raw.trim();
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
  return ["all"];
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { tenantId } = await requireOwner(req);
    const { id } = await ctx.params;
    const webhookId = Number(id);
    if (!webhookId || isNaN(webhookId)) {
      return Response.json({ ok: false, error: "invalid_id" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));

    let urlParam: string | null = null;
    if (body.url !== undefined) {
      const u = String(body.url).trim();
      if (!u.startsWith("http://") && !u.startsWith("https://")) {
        return Response.json({ ok: false, error: "Valid HTTP or HTTPS URL is required" }, { status: 400 });
      }
      urlParam = u;
    }

    let eventsParam: string[] | null = null;
    if (Array.isArray(body.events)) {
      const allowed = new Set(["message.received", "appointment.created", "contact.opted_out", "all"]);
      const filtered = body.events.map(String).filter((e: string) => allowed.has(e));
      if (filtered.length > 0) {
        eventsParam = Array.from(new Set(filtered));
      }
    }

    const activeParam = typeof body.active === "boolean" ? body.active : null;

    const row = await one(
      `UPDATE wa_tenant_webhooks
          SET active = COALESCE($3, active),
              url = COALESCE($4, url),
              events = COALESCE($5, events)
        WHERE id = $1 AND tenant_id = $2
        RETURNING id, tenant_id, url, secret, events, active,
                  to_char(last_triggered_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS last_triggered_at,
                  fail_count,
                  to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at`,
      [webhookId, tenantId, activeParam, urlParam, eventsParam]
    );

    if (!row) {
      return Response.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    return Response.json({
      ok: true,
      webhook: {
        ...row,
        events: normalizeEvents(row.events),
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { tenantId } = await requireOwner(req);
    const { id } = await ctx.params;
    const webhookId = Number(id);
    if (!webhookId || isNaN(webhookId)) {
      return Response.json({ ok: false, error: "invalid_id" }, { status: 400 });
    }

    const row = await one(
      `DELETE FROM wa_tenant_webhooks WHERE id = $1 AND tenant_id = $2 RETURNING id`,
      [webhookId, tenantId]
    );

    if (!row) {
      return Response.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    return Response.json({ ok: true, deleted: true });
  } catch (e) {
    return errorResponse(e);
  }
}
