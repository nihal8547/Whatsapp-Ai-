import { requireOwner, errorResponse } from "@/lib/auth";
import { q, one } from "@/lib/db";
import crypto from "crypto";

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

export async function GET(req: Request) {
  try {
    const { tenantId } = await requireOwner(req);

    const rows = await q(
      `SELECT id, tenant_id, name, key_prefix, scopes, rate_limit_per_min,
              to_char(last_used_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS last_used_at,
              to_char(expires_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS expires_at,
              active,
              to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
         FROM wa_tenant_api_keys
        WHERE tenant_id = $1
        ORDER BY created_at DESC`,
      [tenantId]
    );

    const keys = rows.map((r) => ({
      ...r,
      scopes: normalizeScopes(r.scopes),
    }));

    return Response.json({ ok: true, keys });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const { session, tenantId } = await requireOwner(req);
    const body = await req.json().catch(() => ({}));

    const name = String(body.name || "").trim();
    if (!name) {
      return Response.json({ ok: false, error: "Name is required" }, { status: 400 });
    }
    if (name.length > 100) {
      return Response.json({ ok: false, error: "Name too long (max 100 characters)" }, { status: 400 });
    }

    // Name must be unique per tenant
    const existing = await one(
      `SELECT id FROM wa_tenant_api_keys WHERE tenant_id = $1 AND lower(name) = lower($2)`,
      [tenantId, name]
    );
    if (existing) {
      return Response.json(
        { ok: false, error: "An API key with this name already exists" },
        { status: 409 }
      );
    }

    // Scopes validation: read, write
    let scopes: string[] = ["read", "write"];
    if (Array.isArray(body.scopes) && body.scopes.length > 0) {
      const allowed = new Set(["read", "write"]);
      const filtered = body.scopes.map(String).filter((s: string) => allowed.has(s));
      if (filtered.length > 0) {
        scopes = Array.from(new Set(filtered));
      }
    }

    // Rate limit per min: 10 to 300, default 60
    let rateLimit = 60;
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

    // Expiry date (optional)
    let expiresAt: string | null = null;
    if (body.expires_at) {
      const expDate = new Date(body.expires_at);
      if (isNaN(expDate.getTime())) {
        return Response.json({ ok: false, error: "Invalid expiry date format" }, { status: 400 });
      }
      if (expDate.getTime() <= Date.now()) {
        return Response.json({ ok: false, error: "Expiry date must be in the future" }, { status: 400 });
      }
      expiresAt = expDate.toISOString();
    }

    // Key generation:
    // Generate a 48-char random hex key with crypto.randomBytes(22).toString('hex') prefixed with wbk_
    // or crypto.randomBytes(24).toString('hex')
    const rawHex = crypto.randomBytes(22).toString("hex");
    const fullKey = `wbk_${rawHex}`; // Exactly 48 characters
    const keyPrefix = fullKey.slice(0, 8); // e.g. "wbk_a3f2"
    const keyHash = crypto.createHash("sha256").update(fullKey).digest("hex");

    const row = await one(
      `INSERT INTO wa_tenant_api_keys (
         tenant_id, name, key_prefix, key_hash, scopes, rate_limit_per_min, expires_at, active, created_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8)
       RETURNING id, tenant_id, name, key_prefix, scopes, rate_limit_per_min,
                 to_char(last_used_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS last_used_at,
                 to_char(expires_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS expires_at,
                 active,
                 to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at`,
      [tenantId, name, keyPrefix, keyHash, scopes, rateLimit, expiresAt, session.userId]
    );

    return Response.json(
      {
        ok: true,
        key: {
          ...row,
          scopes: normalizeScopes(row.scopes),
        },
        apiKey: fullKey,
      },
      { status: 201 }
    );
  } catch (e) {
    return errorResponse(e);
  }
}
