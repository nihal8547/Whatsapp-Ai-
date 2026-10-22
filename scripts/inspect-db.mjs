import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    const tenants = await client.query(`SELECT id, name, pack_code, modules FROM wa_tenants WHERE id IN (1, 49)`);
    console.log("Tenants:", tenants.rows);

    const packs = await client.query(`SELECT code, modules FROM wa_business_packs WHERE active = true`);
    console.log("Packs:", packs.rows.map(p => ({ code: p.code, hasAds: p.modules?.includes('ads') })));
  } catch (err) {
    console.error("Error:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
