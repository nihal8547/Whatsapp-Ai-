#!/usr/bin/env node
import pg from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationFile = process.argv[2] || "021_ad_playbooks.sql";
const migrationPath = path.resolve(__dirname, "../migrations", migrationFile);

if (!fs.existsSync(migrationPath)) {
  console.error(`Migration file not found: ${migrationPath}`);
  process.exit(1);
}

const sql = fs.readFileSync(migrationPath, "utf-8");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  console.log(`Running migration ${migrationFile}...`);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");
    console.log(`Migration ${migrationFile} applied successfully!`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(`Migration ${migrationFile} failed:`, err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
