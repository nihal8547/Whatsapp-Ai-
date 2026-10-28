import { requireOwner, errorResponse } from "@/lib/auth";
import { q, one } from "@/lib/db";
import crypto from "crypto";

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

export async function GET(req: Request) {
  try {
    const { tenantId } = await requireOwner(req);

    const rows = await q(
      `SELECT id, tenant_id, url, secret, events, active,
              to_char(last_triggered_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS last_triggered_at,
              fail_count,
              to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
         FROM wa_tenant_webhooks
        WHERE tenant_id = $1
        ORDER BY created_at DESC`,
      [tenantId]
    );

    const webhooks = rows.map((r) => ({
      ...r,
      events: normalizeEvents(r.events),
    }));

    return Response.json({ ok: true, webhooks });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const { tenantId } = await requireOwner(req);
    const body = await req.json().catch(() => ({}));

    const url = String(body.url || "").trim();
    if (!url || (!url.startsWith("http://") && !url.startsWith("https://"))) {
      return Response.json({ ok: false, error: "Valid HTTP or HTTPS URL is required" }, { status: 400 });
    }

    // Check unique url per tenant
    const existing = await one(
      `SELECT id FROM wa_tenant_webhooks WHERE tenant_id = $1 AND url = $2`,
      [tenantId, url]
    );
    if (existing) {
      return Response.json(
        { ok: false, error: "A webhook with this URL already exists" },
        { status: 409 }
      );
    }

    let events: string[] = ["all"];
    if (Array.isArray(body.events) && body.events.length > 0) {
      const allowed = new Set(["message.received", "appointment.created", "contact.opted_out", "all"]);
      const filtered = body.events.map(String).filter((e: string) => allowed.has(e));
      if (filtered.length > 0) {
        events = Array.from(new Set(filtered));
      }
    }

    // Auto-generated secret
    const secret = crypto.randomBytes(24).toString("hex");

    const row = await one(
      `INSERT INTO wa_tenant_webhooks (tenant_id, url, secret, events, active)
       VALUES ($1, $2, $3, $4, true)
       RETURNING id, tenant_id, url, secret, events, active,
                 to_char(last_triggered_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS last_triggered_at,
                 fail_count,
                 to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at`,
      [tenantId, url, secret, events]
    );

    return Response.json(
      {
        ok: true,
        webhook: {
          ...row,
          events: normalizeEvents(row.events),
        },
      },
      { status: 201 }
    );
  } catch (e) {
    return errorResponse(e);
  }
}
