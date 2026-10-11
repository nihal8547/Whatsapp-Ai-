#!/usr/bin/env node
/**
 * Applies a business pack to a tenant.
 * Usage: node scripts/apply-pack.mjs <tenantId> <packCode> [--overwrite]
 */
import pg from "pg";

const [tenantIdArg, packCodeArg, ...flags] = process.argv.slice(2);
const tenantId = Number(tenantIdArg);
const packCode = packCodeArg || "other";
const overwrite = flags.includes("--overwrite");

if (!tenantId || !packCode) {
  console.error("Usage: node scripts/apply-pack.mjs <tenantId> <packCode> [--overwrite]");
  process.exit(1);
}

const dbUrl =
  process.env.DATABASE_URL ||
  "postgresql://wa_saas_user:f9abd85ead55ece664035169f24e4b343f9be8c222e8c167@127.0.0.1:5432/wa_saas";

const pool = new pg.Pool({
  connectionString: dbUrl,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
});

async function main() {
  const client = await pool.connect();
  try {
    const packRes = await client.query(
      `SELECT code, name, modules, labels, persona_rules, defaults FROM wa_business_packs WHERE code = $1 AND active = true`,
      [packCode]
    );
    if (packRes.rows.length === 0) {
      throw new Error(`Pack not found: ${packCode}`);
    }
    const pack = packRes.rows[0];

    await client.query("BEGIN");

    // 1. wa_tenants
    await client.query(
      `UPDATE wa_tenants SET pack_code = $1, modules = NULL, labels = $2::jsonb WHERE id = $3`,
      [pack.code, JSON.stringify(pack.labels || {}), tenantId]
    );

    // 2. wa_bot_settings
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

    const botRes = await client.query(`SELECT tenant_id FROM wa_bot_settings WHERE tenant_id = $1`, [tenantId]);
    if (botRes.rows.length === 0) {
      await client.query(
        `INSERT INTO wa_bot_settings (tenant_id, persona_prompt, reminder_24h_template, reminder_1h_template, followup_template, review_template)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [tenantId, fullPersona, r24, r1, fol, rev]
      );
    } else {
      await client.query(
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

    // 3. hours
    const hours = pack.defaults?.hours || [];
    for (const h of hours) {
      if (overwrite) {
        await client.query(
          `INSERT INTO wa_business_hours (tenant_id, weekday, open_time, close_time, is_closed)
           VALUES ($1, $2, $3::time, $4::time, $5)
           ON CONFLICT (tenant_id, weekday) DO UPDATE
             SET open_time = EXCLUDED.open_time, close_time = EXCLUDED.close_time, is_closed = EXCLUDED.is_closed`,
          [tenantId, h.weekday, h.open || "09:00", h.close || "18:00", !!h.closed]
        );
      } else {
        await client.query(
          `INSERT INTO wa_business_hours (tenant_id, weekday, open_time, close_time, is_closed)
           VALUES ($1, $2, $3::time, $4::time, $5)
           ON CONFLICT (tenant_id, weekday) DO NOTHING`,
          [tenantId, h.weekday, h.open || "09:00", h.close || "18:00", !!h.closed]
        );
      }
    }

    // 4. services
    const services = pack.defaults?.services || [];
    for (const s of services) {
      await client.query(
        `INSERT INTO wa_services (tenant_id, name, duration_min, price, currency, active)
         VALUES ($1, $2, $3, NULL, 'QAR', true)
         ON CONFLICT (tenant_id, name) DO NOTHING`,
        [tenantId, s.name, Number(s.duration_min) || 30]
      );
    }

    // 5. categories
    const categories = pack.defaults?.categories || [];
    let sortOrder = 0;
    for (const cat of categories) {
      sortOrder += 10;
      await client.query(
        `INSERT INTO wa_catalog_categories (tenant_id, name, sort_order, active)
         VALUES ($1, $2, $3, true)
         ON CONFLICT (tenant_id, name) DO NOTHING`,
        [tenantId, cat, sortOrder]
      );
    }

    // 6. faqs (only if tenant has no faqs)
    const faqCount = await client.query(`SELECT count(*)::int AS cnt FROM wa_faqs WHERE tenant_id = $1`, [tenantId]);
    if (faqCount.rows[0].cnt === 0) {
      const faqs = pack.defaults?.faqs || [];
      let faqOrder = 0;
      for (const f of faqs) {
        faqOrder += 10;
        await client.query(
          `INSERT INTO wa_faqs (tenant_id, question, answer, keywords, sort_order, active)
           VALUES ($1, $2, $3, '{}', $4, false)
           ON CONFLICT (tenant_id, question) DO NOTHING`,
          [tenantId, f.question, f.answer, faqOrder]
        );
      }
    }

    await client.query("COMMIT");
    console.log(`Successfully applied pack '${pack.code}' to tenant ${tenantId} (overwrite=${overwrite})`);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Error applying pack:", err);
  process.exit(1);
});
