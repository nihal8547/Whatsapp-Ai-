#!/bin/bash
set -e
cd /opt/wa-dashboard

docker exec -i wa-dashboard node -e "
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
let sql = '';
process.stdin.setEncoding('utf-8');
process.stdin.on('data', c => { sql += c; });
process.stdin.on('end', async () => {
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('Migration 021 applied successfully!');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', e);
    process.exit(1);
  } finally {
    await client.end();
  }
});
" < /opt/wa-dashboard/migrations/021_ad_playbooks.sql
