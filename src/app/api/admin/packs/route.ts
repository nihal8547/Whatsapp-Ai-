import { requireSuperAdmin, errorResponse } from "@/lib/auth";
import { q, one } from "@/lib/db";

export async function GET() {
  try {
    const s = await requireSuperAdmin();

    const packs = await q<{
      code: string;
      name: string;
      modules: any;
      labels: any;
      active: boolean;
      tenant_count: number;
    }>(`
      SELECT p.code, p.name, p.modules, p.labels, p.active,
             (SELECT count(*) FROM wa_tenants t WHERE t.pack_code = p.code)::int AS tenant_count
        FROM wa_business_packs p
       ORDER BY p.name ASC
    `);

    return Response.json({ ok: true, packs });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(req: Request) {
  try {
    const s = await requireSuperAdmin();

    const body = await req.json();
    const code = String(body.code ?? "").trim();
    if (!code) {
      return Response.json({ ok: false, error: "code_required" }, { status: 400 });
    }

    if (body.modules !== undefined) {
      if (!Array.isArray(body.modules)) {
        return Response.json({ ok: false, error: "modules_must_be_array" }, { status: 400 });
      }
      await one(
        `UPDATE wa_business_packs
            SET modules = $1::jsonb, updated_at = now()
          WHERE code = $2`,
        [JSON.stringify(body.modules), code]
      );
    }

    if (body.labels !== undefined && typeof body.labels === "object") {
      await one(
        `UPDATE wa_business_packs
            SET labels = $1::jsonb, updated_at = now()
          WHERE code = $2`,
        [JSON.stringify(body.labels), code]
      );
    }

    if (body.name !== undefined && String(body.name).trim()) {
      await one(
        `UPDATE wa_business_packs
            SET name = $1, updated_at = now()
          WHERE code = $2`,
        [String(body.name).trim(), code]
      );
    }

    const updated = await one(
      `SELECT code, name, modules, labels, active FROM wa_business_packs WHERE code = $1`,
      [code]
    );

    return Response.json({ ok: true, pack: updated });
  } catch (e) {
    return errorResponse(e);
  }
}
