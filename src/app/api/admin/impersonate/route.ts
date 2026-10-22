import { requireSuperAdmin, setSession, errorResponse } from "@/lib/auth";
import { one } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const s = await requireSuperAdmin();

    const body = await req.json();
    const targetTenantId = Number(body.tenantId);
    if (!targetTenantId || isNaN(targetTenantId)) {
      return Response.json({ ok: false, error: "invalid_tenant_id" }, { status: 400 });
    }

    const tenant = await one<{ id: number; name: string }>(
      `SELECT id, name FROM wa_tenants WHERE id = $1`,
      [targetTenantId]
    );
    if (!tenant) {
      return Response.json({ ok: false, error: "tenant_not_found" }, { status: 404 });
    }

    // Update active session cookie with target tenant while retaining superAdmin
    await setSession({
      ...s,
      tenantId: tenant.id,
    });

    return Response.json({ ok: true, tenantName: tenant.name, tenantId: tenant.id });
  } catch (e) {
    return errorResponse(e);
  }
}
