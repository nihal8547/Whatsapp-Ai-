import { hashPassword, signIn, errorResponse } from "@/lib/auth";
import { one } from "@/lib/db";
import { n8n } from "@/lib/n8n";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const business = String(body.business || "").trim();
    const fullName = String(body.fullName || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const adminPhone = String(body.adminPhone || "").replace(/[^0-9]/g, "");
    const timezone = String(body.timezone || "Asia/Qatar");
    const businessType = String(body.businessType || "other");


    if (business.length < 2 || !email || password.length < 8) {
      return Response.json({ ok: false, error: "invalid_input" }, { status: 400 });
    }

    const exists = await one(`SELECT id FROM wa_tenant_users WHERE lower(email) = $1`, [email]);
    if (exists) return Response.json({ ok: false, error: "email_taken" }, { status: 409 });

    const created = await n8n<{ tenant_id: number; slug: string }>("create_tenant", {
      name: business,
      timezone,
      admin_phone: adminPhone,
    });

    let initialMetadata = {};
    switch (businessType) {
      case "clinic":
        initialMetadata = { departments: [], doctors: [], packages: [] };
        break;
      case "travels":
        initialMetadata = { destinations: [], packages: [], vehicles: [] };
        break;
      case "hostel":
        initialMetadata = { roomTypes: [], amenities: [] };
        break;
      case "realestate":
        initialMetadata = { propertyTypes: [], locations: [] };
        break;
      case "grocery":
        initialMetadata = { productCategories: [], deliveryDetails: {} };
        break;
      case "tech":
        initialMetadata = { services: [], portfolio: [], subscriptionPlans: [] };
        break;
      case "restaurant":
        initialMetadata = { menuItems: [], cuisineTypes: [] };
        break;
      case "education":
        initialMetadata = { courses: [], batches: [] };
        break;
      case "retail":
        initialMetadata = { productCategories: [], brands: [] };
        break;
      case "salon":
        initialMetadata = { services: [], specialists: [] };
        break;
      default:
        initialMetadata = { customFields: [] };
    }

    await one(
      `UPDATE wa_tenants SET business_type = $1, business_metadata = $2 WHERE id = $3 RETURNING id`,
      [businessType, initialMetadata, created.tenant_id]
    );

    const hash = await hashPassword(password);
    await one(
      `INSERT INTO wa_tenant_users (tenant_id, email, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4, 'owner') RETURNING id`,
      [created.tenant_id, email, hash, fullName]
    );

    await signIn(email, password);
    return Response.json({ ok: true, tenant_id: created.tenant_id });
  } catch (e) {
    return errorResponse(e);
  }
}
