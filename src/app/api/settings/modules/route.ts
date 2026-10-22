import { requireTenant, requireOwner, errorResponse } from "@/lib/auth";
import { one, q } from "@/lib/db";
import { getTenantConfig } from "@/lib/packs";

const ALL_MODULES = [
  { code: "appointments", name: "Appointments & Bookings", built: true },
  { code: "orders", name: "Orders & Cart", built: true },
  { code: "catalog", name: "Catalog / Products / Menu", built: true },
  { code: "leads", name: "Leads & Enquiries", built: true },
  { code: "ads", name: "Ad Playbooks", built: true },
  { code: "faq", name: "FAQ Knowledge Base", built: true },
  { code: "media", name: "Media Library", built: true },
  { code: "stays", name: "Stays & Hospitality", built: false },
  { code: "resources", name: "Staff / Rooms / Tables", built: false },
  { code: "quotes", name: "Price Quotes", built: false },
  { code: "table_booking", name: "Table Booking", built: false },
];

export async function GET(req: Request) {
  try {
    const { tenantId } = await requireTenant(req);
    const config = await getTenantConfig(tenantId);
    const tenantRow = await one(`SELECT modules FROM wa_tenants WHERE id = $1`, [tenantId]);

    return Response.json({
      ok: true,
      activeModules: config.modules,
      customModules: tenantRow?.modules ?? null,
      packModules: config.pack.modules,
      availableModules: ALL_MODULES,
    });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PUT(req: Request) {
  try {
    const { tenantId } = await requireOwner(req);
    const body = await req.json();
    const modules = body.modules;

    if (modules === null) {
      // Reset to follow pack
      await q(`UPDATE wa_tenants SET modules = NULL WHERE id = $1`, [tenantId]);
    } else if (Array.isArray(modules)) {
      await q(`UPDATE wa_tenants SET modules = $1::jsonb WHERE id = $2`, [JSON.stringify(modules), tenantId]);
    } else {
      return Response.json({ ok: false, error: "invalid_modules" }, { status: 400 });
    }

    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
