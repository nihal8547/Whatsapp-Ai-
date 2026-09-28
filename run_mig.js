const { Pool } = require("pg");
const fs = require("fs");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  const sql = fs.readFileSync("/opt/wa-dashboard/migrations/update_schema.sql", "utf-8");
  console.log("Running migration...");
  try {
    await pool.query(sql);
    console.log("Migration successful!");
  } catch (e) {
    console.error("Migration failed:", e);
  } finally {
    pool.end();
  }
}
run();
