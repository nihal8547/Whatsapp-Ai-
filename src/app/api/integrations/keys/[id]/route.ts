import { requireOwner, errorResponse } from "@/lib/auth";
import { one } from "@/lib/db";

function normalizeScopes(raw: unknown): string[] {
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
  return ["read", "write"];
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { tenantId } = await requireOwner(req);
    const { id } = await ctx.params;
    const keyId = Number(id);
    if (!keyId || isNaN(keyId)) {
      return Response.json({ ok: false, error: "invalid_id" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));

    let rateLimit: number | null = null;
    if (body.rate_limit_per_min !== undefined) {
      const parsedRate = Number(body.rate_limit_per_min);
      if (isNaN(parsedRate) || parsedRate < 10 || parsedRate > 300) {
        return Response.json(
          { ok: false, error: "Rate limit must be between 10 and 300 requests per minute" },
          { status: 400 }
        );
      }
      rateLimit = Math.floor(parsedRate);
    }

    let expiresAtParam: string | null = null;
    if (body.expires_at === null || body.expires_at === "") {
      expiresAtParam = "__CLEAR__";
    } else if (body.expires_at !== undefined) {
      const expDate = new Date(body.expires_at);
      if (isNaN(expDate.getTime())) {
        return Response.json({ ok: false, error: "Invalid expiry date format" }, { status: 400 });
      }
      expiresAtParam = expDate.toISOString();
    }

    const activeParam = typeof body.active === "boolean" ? body.active : null;

    const row = await one(
      `UPDATE wa_tenant_api_keys
          SET active = COALESCE($3, active),
              rate_limit_per_min = COALESCE($4, rate_limit_per_min),
              expires_at = CASE 
                WHEN $5::text = '__CLEAR__' THEN NULL 
                WHEN $5::text IS NOT NULL THEN $5::timestamptz 
                ELSE expires_at 
              END
        WHERE id = $1 AND tenant_id = $2
        RETURNING id, tenant_id, name, key_prefix, scopes, rate_limit_per_min,
                  to_char(last_used_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS last_used_at,
                  to_char(expires_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS expires_at,
                  active,
                  to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at`,
      [keyId, tenantId, activeParam, rateLimit, expiresAtParam]
    );

    if (!row) {
      return Response.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    return Response.json({
      ok: true,
      key: {
        ...row,
        scopes: normalizeScopes(row.scopes),
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
    const keyId = Number(id);
    if (!keyId || isNaN(keyId)) {
      return Response.json({ ok: false, error: "invalid_id" }, { status: 400 });
    }

    const row = await one(
      `DELETE FROM wa_tenant_api_keys WHERE id = $1 AND tenant_id = $2 RETURNING id`,
      [keyId, tenantId]
    );

    if (!row) {
      return Response.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    return Response.json({ ok: true, deleted: true });
  } catch (e) {
    return errorResponse(e);
  }
}
