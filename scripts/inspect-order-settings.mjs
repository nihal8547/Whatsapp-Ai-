import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    const res = await client.query(`SELECT tenant_id, order_settings FROM wa_bot_settings WHERE tenant_id = 59;`);
    console.log("Tenant 59 order_settings:", JSON.stringify(res.rows, null, 2));

    const checkOther = await client.query(`SELECT tenant_id, order_settings FROM wa_bot_settings WHERE order_settings IS NOT NULL LIMIT 5;`);
    console.log("Sample other order_settings:", JSON.stringify(checkOther.rows, null, 2));
  } finally {
    client.release();
    await pool.end();
  }
}
run();
