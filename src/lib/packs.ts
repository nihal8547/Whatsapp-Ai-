import { cache } from "react";
import { q, one } from "@/lib/db";

export type BusinessPack = {
  code: string;
  name: string;
  modules: string[];
  labels: Record<string, string>;
  persona_rules: string;
  defaults?: {
    persona?: string;
    hours?: Array<{ weekday: number; open: string; close: string; closed: boolean }>;
    services?: Array<{ name: string; duration_min: number }>;
    categories?: string[];
    faqs?: Array<{ question: string; answer: string }>;
    reminder_24h?: string;
    reminder_1h?: string;
    followup?: string;
    review?: string;
  };
};

export type TenantConfig = {
  pack: BusinessPack;
  modules: string[];
  labels: Record<string, string>;
};

export const DEFAULT_LABELS: Record<string, string> = {
  appointment: "Appointment",
  appointments: "Appointments",
  resource: "Resource",
  resources: "Resources",
  customer: "Customer",
  customers: "Customers",
  catalog: "Catalog",
  item: "Item",
  items: "Items",
  lead: "Lead",
  leads: "Leads",
  order: "Order",
  orders: "Orders",
  service: "Service",
  services: "Services",
  contact: "Contact",
  contacts: "Contacts",
  chat: "Chat",
  chats: "Chats",
  faq: "FAQ",
  faqs: "FAQs",
};

export const TYPE_TO_PACK: Record<string, string> = {
  clinic: "clinic",
  travels: "travels",
  hostel: "hotel",
  hotel: "hotel",
  realestate: "real_estate",
  real_estate: "real_estate",
  grocery: "grocery",
  tech: "it_agency",
  it_agency: "it_agency",
  restaurant: "restaurant",
  education: "education",
  retail: "retail",
  salon: "salon",
  other: "other",
};

export function mapBusinessTypeToPack(type?: string | null): string {
  if (!type) return "other";
  const norm = String(type).trim().toLowerCase();
  return TYPE_TO_PACK[norm] || "other";
}

export function tLabel(labels: Record<string, string> | undefined, key: string, fallback?: string): string {
  if (!labels) return fallback || DEFAULT_LABELS[key] || key;
  return labels[key] || fallback || DEFAULT_LABELS[key] || key;
}

export const getTenantConfig = cache(async (tenantId: number): Promise<TenantConfig> => {
  const row = await one(
    `SELECT t.id, t.pack_code, t.modules AS tenant_modules, t.labels AS tenant_labels,
            p.code AS pack_actual_code, p.name AS pack_name, p.modules AS pack_modules,
            p.labels AS pack_labels, p.persona_rules, p.defaults AS pack_defaults
       FROM wa_tenants t
       LEFT JOIN wa_business_packs p ON p.code = t.pack_code
      WHERE t.id = $1`,
    [tenantId]
  );

  let packData: BusinessPack;
  if (row?.pack_actual_code) {
    packData = {
      code: row.pack_actual_code,
      name: row.pack_name || "General Business",
      modules: Array.isArray(row.pack_modules) ? row.pack_modules : [],
      labels: row.pack_labels && typeof row.pack_labels === "object" ? row.pack_labels : {},
      persona_rules: row.persona_rules || "",
      defaults: row.pack_defaults || {},
    };
  } else {
    // Fall back to 'other' pack
    const fallbackPack = await one(
      `SELECT code, name, modules, labels, persona_rules, defaults
         FROM wa_business_packs WHERE code = 'other'`
    );
    packData = {
      code: fallbackPack?.code || "other",
      name: fallbackPack?.name || "General Business",
      modules: Array.isArray(fallbackPack?.modules) ? fallbackPack.modules : ["appointments", "leads", "faq", "media"],
      labels: fallbackPack?.labels && typeof fallbackPack.labels === "object" ? fallbackPack.labels : {},
      persona_rules: fallbackPack?.persona_rules || "",
      defaults: fallbackPack?.defaults || {},
    };
  }

  const tenantModules = row?.tenant_modules;
  const modules: string[] =
    Array.isArray(tenantModules) && tenantModules.length > 0
      ? tenantModules
      : packData.modules;

  const tenantLabels = row?.tenant_labels && typeof row.tenant_labels === "object" ? row.tenant_labels : {};
  const labels: Record<string, string> = {
    ...DEFAULT_LABELS,
    ...packData.labels,
    ...tenantLabels,
  };

  return { pack: packData, modules, labels };
});

export async function applyPack(
  tenantId: number,
  packCode: string,
  options: { overwrite?: boolean } = {}
): Promise<{ ok: boolean; pack: string }> {
  const overwrite = !!options.overwrite;
  const code = mapBusinessTypeToPack(packCode);

  let packRow = await one(
    `SELECT code, name, modules, labels, persona_rules, defaults
       FROM wa_business_packs WHERE code = $1 AND active = true`,
    [code]
  );

  if (!packRow) {
    packRow = await one(
      `SELECT code, name, modules, labels, persona_rules, defaults
         FROM wa_business_packs WHERE code = 'other' AND active = true`
    );
  }

  if (!packRow) {
    throw new Error(`Business pack not found: ${code}`);
  }

  const pack: BusinessPack = {
    code: packRow.code,
    name: packRow.name,
    modules: Array.isArray(packRow.modules) ? packRow.modules : [],
    labels: packRow.labels && typeof packRow.labels === "object" ? packRow.labels : {},
    persona_rules: packRow.persona_rules || "",
    defaults: packRow.defaults || {},
  };

  await q("BEGIN");
  try {
    // 1. Update wa_tenants: set pack_code, modules (NULL means follow pack), and pack labels
    await q(
      `UPDATE wa_tenants
          SET pack_code = $1,
              modules = NULL,
              labels = $2::jsonb
        WHERE id = $3`,
      [pack.code, JSON.stringify(pack.labels), tenantId]
    );

    // 2. wa_bot_settings: persona prompt & templates
    const fullPersona = [
      pack.defaults?.persona || "",
      pack.persona_rules ? "Rules:\n" + pack.persona_rules : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const r24 = pack.defaults?.reminder_24h || "";
    const r1 = pack.defaults?.reminder_1h || "";
    const fol = pack.defaults?.followup || "";
    const rev = pack.defaults?.review || "";

    const existingBot = await one(`SELECT tenant_id FROM wa_bot_settings WHERE tenant_id = $1`, [tenantId]);
    if (!existingBot) {
      await q(
        `INSERT INTO wa_bot_settings
           (tenant_id, persona_prompt, reminder_24h_template, reminder_1h_template, followup_template, review_template)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [tenantId, fullPersona, r24, r1, fol, rev]
      );
    } else {
      await q(
        `UPDATE wa_bot_settings
            SET persona_prompt = CASE
                  WHEN $3 = true OR persona_prompt IS NULL OR trim(persona_prompt) = '' THEN $2
                  ELSE persona_prompt
                END,
                reminder_24h_template = CASE
                  WHEN $3 = true OR reminder_24h_template IS NULL OR trim(reminder_24h_template) = '' THEN $4
                  ELSE reminder_24h_template
                END,
                reminder_1h_template = CASE
                  WHEN $3 = true OR reminder_1h_template IS NULL OR trim(reminder_1h_template) = '' THEN $5
                  ELSE reminder_1h_template
                END,
                followup_template = CASE
                  WHEN $3 = true OR followup_template IS NULL OR trim(followup_template) = ''
                       OR followup_template = 'Hi {name} 👋 just checking in — still interested? happy to answer any questions.' THEN $6
                  ELSE followup_template
                END,
                review_template = CASE
                  WHEN $3 = true OR review_template IS NULL OR trim(review_template) = ''
                       OR review_template = 'Hi {name}, hope the {service} went well! Would you mind leaving us a quick review? {link}' THEN $7
                  ELSE review_template
                END,
                updated_at = now()
          WHERE tenant_id = $1`,
        [tenantId, fullPersona, overwrite, r24, r1, fol, rev]
      );
    }

    // 3. Upsert business hours
    const hours = pack.defaults?.hours || [];
    for (const h of hours) {
      if (overwrite) {
        await q(
          `INSERT INTO wa_business_hours (tenant_id, weekday, open_time, close_time, is_closed)
           VALUES ($1, $2, $3::time, $4::time, $5)
           ON CONFLICT (tenant_id, weekday) DO UPDATE
             SET open_time = EXCLUDED.open_time,
                 close_time = EXCLUDED.close_time,
                 is_closed = EXCLUDED.is_closed`,
          [tenantId, h.weekday, h.open || "09:00", h.close || "18:00", !!h.closed]
        );
      } else {
        await q(
          `INSERT INTO wa_business_hours (tenant_id, weekday, open_time, close_time, is_closed)
           VALUES ($1, $2, $3::time, $4::time, $5)
           ON CONFLICT (tenant_id, weekday) DO NOTHING`,
          [tenantId, h.weekday, h.open || "09:00", h.close || "18:00", !!h.closed]
        );
      }
    }

    // 4. Starter services: names and durations, NO prices, ON CONFLICT DO NOTHING
    const services = pack.defaults?.services || [];
    for (const s of services) {
      await q(
        `INSERT INTO wa_services (tenant_id, name, duration_min, price, currency, active)
         VALUES ($1, $2, $3, NULL, 'QAR', true)
         ON CONFLICT (tenant_id, name) DO NOTHING`,
        [tenantId, s.name, Number(s.duration_min) || 30]
      );
    }

    // 5. Starter categories: ON CONFLICT DO NOTHING
    const categories = pack.defaults?.categories || [];
    let sortOrder = 0;
    for (const cat of categories) {
      sortOrder += 10;
      await q(
        `INSERT INTO wa_catalog_categories (tenant_id, name, sort_order, active)
         VALUES ($1, $2, $3, true)
         ON CONFLICT (tenant_id, name) DO NOTHING`,
        [tenantId, cat, sortOrder]
      );
    }

    // 6. Draft FAQs: only if tenant has NO FAQs, inserted as INACTIVE
    const faqCountRow = await one(`SELECT count(*)::int AS cnt FROM wa_faqs WHERE tenant_id = $1`, [tenantId]);
    const existingFaqs = faqCountRow?.cnt ?? 0;
    if (existingFaqs === 0) {
      const faqs = pack.defaults?.faqs || [];
      let faqOrder = 0;
      for (const f of faqs) {
        faqOrder += 10;
        await q(
          `INSERT INTO wa_faqs (tenant_id, question, answer, keywords, sort_order, active)
           VALUES ($1, $2, $3, '{}', $4, false)
           ON CONFLICT (tenant_id, question) DO NOTHING`,
          [tenantId, f.question, f.answer, faqOrder]
        );
      }
    }

    await q("COMMIT");
    return { ok: true, pack: pack.code };
  } catch (err) {
    await q("ROLLBACK");
    throw err;
  }
}
