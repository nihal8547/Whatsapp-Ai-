import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    const res = await client.query(`UPDATE wa_orders SET status = 'accepted', staff_alerted = true, updated_at = now() WHERE id = 13 AND tenant_id = 59 RETURNING id, order_no, status;`);
    console.log("Updated order 13:", res.rows);
  } finally {
    client.release();
    await pool.end();
  }
}
run();
