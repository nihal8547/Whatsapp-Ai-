import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    const counters = await client.query(`SELECT * FROM wa_order_counters;`);
    console.log("wa_order_counters:", counters.rows);
  } catch (err) {
    console.error("Inspect error:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
