import { requireTenant, requireOwner, errorResponse } from "@/lib/auth";
import { q, one } from "@/lib/db";
import { applyPack, getTenantConfig } from "@/lib/packs";

export async function GET(req: Request) {
  try {
    const { tenantId } = await requireTenant(req);
    const config = await getTenantConfig(tenantId);
    const packs = await q(
      `SELECT code, name, modules, labels, persona_rules, version
         FROM wa_business_packs WHERE active = true ORDER BY name`
    );

    return Response.json({
      ok: true,
      currentPack: config.pack,
      packs,
    });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const { tenantId } = await requireOwner(req);
    const body = await req.json();
    const packCode = String(body.packCode || "").trim();

    if (!packCode) {
      return Response.json({ ok: false, error: "missing_pack_code" }, { status: 400 });
    }

    const res = await applyPack(tenantId, packCode, { overwrite: false });
    await one(`UPDATE wa_tenants SET business_type = $1 WHERE id = $2 RETURNING id`, [res.pack, tenantId]);

    return Response.json({ ok: true, packCode: res.pack });
  } catch (e) {
    return errorResponse(e);
  }
}
