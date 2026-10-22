import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT t.id, t.name, t.pack_code, t.business_type, t.modules,
        bp.modules AS bp_modules,
        COALESCE(NULLIF(t.modules, '[]'::jsonb), bp.modules, '[]'::jsonb) AS effective_modules
      FROM wa_tenants t
      LEFT JOIN wa_business_packs bp ON bp.code = COALESCE(t.pack_code, t.business_type)
      WHERE t.id = 59;
    `);
    console.log("Tenant 59 modules:", res.rows);
  } finally {
    client.release();
    await pool.end();
  }
}
run();
