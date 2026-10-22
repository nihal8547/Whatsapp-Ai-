import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    const items = await client.query(`SELECT id, name, price, currency, available, variants FROM wa_catalog_items WHERE tenant_id = 59;`);
    console.log("wa_catalog_items for tenant 59:", items.rows);
    const media = await client.query(`SELECT id, title, category, keywords FROM wa_media WHERE tenant_id = 59;`);
    console.log("wa_media for tenant 59:", media.rows);
    const bot = await client.query(`SELECT business_name, business_info FROM wa_bot_settings WHERE tenant_id = 59;`);
    console.log("wa_bot_settings for tenant 59:", bot.rows);
    const orders = await client.query(`SELECT * FROM wa_orders WHERE tenant_id = 59;`);
    console.log("wa_orders for tenant 59:", orders.rows);
  } finally {
    client.release();
    await pool.end();
  }
}
run();
