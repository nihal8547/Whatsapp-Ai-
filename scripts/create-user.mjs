#!/usr/bin/env node
/**
 * Creates a dashboard login.
 *
 *   node scripts/create-user.mjs you@example.com "Your Name" secret123 --tenant 1
 *   node scripts/create-user.mjs admin@example.com "Platform Admin" secret123 --super
 *
 * Reads DATABASE_URL from the environment.
 */
import pg from "pg";
import bcrypt from "bcryptjs";

const [email, fullName, password] = process.argv.slice(2);
const args = process.argv.slice(2);
const superAdmin = args.includes("--super");
const tenantFlag = args.indexOf("--tenant");
const tenantId = tenantFlag > -1 ? Number(args[tenantFlag + 1]) : null;

if (!email || !password) {
  console.error('Usage: node scripts/create-user.mjs <email> "<full name>" <password> [--tenant N] [--super]');
  process.exit(1);
}
if (!superAdmin && !tenantId) {
  console.error("Pass --tenant N for a workspace login, or --super for a platform admin.");
  process.exit(1);
}
if (password.length < 8) {
  console.error("Password must be at least 8 characters.");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
});

const hash = await bcrypt.hash(password, 10);
try {
  const { rows } = await pool.query(
    `INSERT INTO wa_tenant_users (tenant_id, email, password_hash, full_name, role, is_super_admin)
     VALUES ($1, lower($2), $3, $4, $5, $6)
     ON CONFLICT (email) DO UPDATE
       SET password_hash = EXCLUDED.password_hash,
           full_name = EXCLUDED.full_name,
           role = EXCLUDED.role,
           is_super_admin = EXCLUDED.is_super_admin,
           tenant_id = EXCLUDED.tenant_id
     RETURNING id, email, role, is_super_admin, tenant_id`,
    [tenantId, email, hash, fullName || "", superAdmin ? "owner" : "owner", superAdmin]
  );
  console.log("Login ready:", rows[0]);
} catch (e) {
  console.error("Failed:", e.message);
  process.exit(1);
} finally {
  await pool.end();
}
