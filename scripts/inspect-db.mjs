import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    const tenantId = 1;
    const leads = await client.query(`
      SELECT l.id, l.tenant_id, l.phone, l.name, l.kind, l.stage, l.summary,
             l.details, l.budget_min, l.budget_max, l.currency, l.value,
             l.assigned_to, l.next_followup_at, l.followups_sent, l.lost_reason,
             l.source, l.staff_alerted, l.created_at, l.updated_at,
             c.first_ad_title, c.lead_source,
             u.full_name AS owner_name, u.email AS owner_email
        FROM wa_leads l
        LEFT JOIN wa_contacts c ON c.tenant_id = l.tenant_id AND c.phone = l.phone
        LEFT JOIN wa_tenant_users u ON u.tenant_id = l.tenant_id AND u.id = l.assigned_to
       WHERE l.tenant_id = $1
       ORDER BY l.updated_at DESC, l.id DESC
       LIMIT 1000
    `, [tenantId]);
    console.log("Leads count for tenant 1:", leads.rows.length);

    // Also check all leads across all tenants
    const allLeads = await client.query(`SELECT tenant_id, count(*) FROM wa_leads GROUP BY tenant_id;`);
    console.log("Leads per tenant:", allLeads.rows);

  } catch (err) {
    console.error("Error running leads query:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
