import { requireTenant, requireOwner, hashPassword, errorResponse } from "@/lib/auth";
import { q, one } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { tenantId } = await requireTenant(req);
    const members = await q(
      `SELECT id, email, COALESCE(full_name,'') AS full_name, role, created_at
         FROM wa_tenant_users WHERE tenant_id = $1 ORDER BY id`,
      [tenantId]
    );
    return Response.json({ ok: true, members });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const { tenantId } = await requireOwner(req);
    const b = await req.json();
    const email = String(b.email || "").trim().toLowerCase();
    const password = String(b.password || "");
    const role = ["admin", "staff"].includes(b.role) ? b.role : "staff";
    if (!email || password.length < 8) {
      return Response.json({ ok: false, error: "invalid_input" }, { status: 400 });
    }
    const exists = await one(`SELECT id FROM wa_tenant_users WHERE lower(email) = $1`, [email]);
    if (exists) return Response.json({ ok: false, error: "email_taken" }, { status: 409 });

    const hash = await hashPassword(password);
    const row = await one(
      `INSERT INTO wa_tenant_users (tenant_id, email, password_hash, full_name, role)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [tenantId, email, hash, String(b.full_name || ""), role]
    );
    return Response.json({ ok: true, ...row });
  } catch (e) {
    return errorResponse(e);
  }
}
