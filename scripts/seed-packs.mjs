#!/usr/bin/env node
/**
 * Upserts all packs from the packs/ directory into wa_business_packs.
 * Usage: node scripts/seed-packs.mjs
 * Reads DATABASE_URL from process.env.DATABASE_URL
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packsDir = path.resolve(__dirname, "../packs");

const dbUrl =
  process.env.DATABASE_URL ||
  "postgresql://wa_saas_user:f9abd85ead55ece664035169f24e4b343f9be8c222e8c167@127.0.0.1:5432/wa_saas";

const pool = new pg.Pool({
  connectionString: dbUrl,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
});

async function main() {
  console.log(`Loading packs from ${packsDir}...`);
  const files = fs.readdirSync(packsDir).filter((f) => f.endsWith(".json"));
  console.log(`Found ${files.length} pack definition files.`);

  let upserted = 0;
  for (const file of files) {
    const raw = fs.readFileSync(path.join(packsDir, file), "utf8");
    const pack = JSON.parse(raw);

    const res = await pool.query(
      `INSERT INTO wa_business_packs (code, name, modules, labels, persona_rules, defaults, version, active, updated_at)
       VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6::jsonb, 1, true, now())
       ON CONFLICT (code) DO UPDATE
         SET name = EXCLUDED.name,
             modules = EXCLUDED.modules,
             labels = EXCLUDED.labels,
             persona_rules = EXCLUDED.persona_rules,
             defaults = EXCLUDED.defaults,
             version = wa_business_packs.version + 1,
             active = true,
             updated_at = now()
       RETURNING code, version`,
      [
        pack.code,
        pack.name,
        JSON.stringify(pack.modules || []),
        JSON.stringify(pack.labels || {}),
        pack.persona_rules || "",
        JSON.stringify(pack.defaults || {}),
      ]
    );

    const row = res.rows[0];
    console.log(`✓ Upserted pack: ${row.code} (v${row.version})`);
    upserted++;
  }

  console.log(`\nSuccessfully seeded ${upserted} packs.`);
  await pool.end();
}

main().catch((err) => {
  console.error("Failed to seed packs:", err);
  process.exit(1);
});
