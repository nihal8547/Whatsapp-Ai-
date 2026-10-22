import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    const cols = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'wa_business_packs';
    `);
    console.log("wa_business_packs columns:", cols.rows);

    const rows = await client.query(`SELECT * FROM wa_business_packs LIMIT 3;`);
    console.log("wa_business_packs sample row:", rows.rows);

  } catch (err) {
    console.error("Error:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
