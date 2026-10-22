import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  let passed = 0;
  let failed = 0;

  function assert(label, cond, extra = "") {
    if (cond) {
      console.log(`  ✓ ${label}`);
      passed++;
    } else {
      console.error(`  ✗ ${label}${extra ? " — " + extra : ""}`);
      failed++;
    }
  }

  try {
    console.log("Starting DB & API logic verification for /ads...");
    const tenantId = 1;

    // Find an existing contact or create one
    let contact = await client.query(`SELECT phone FROM wa_contacts WHERE tenant_id = $1 LIMIT 1;`, [tenantId]);
    let phone;
    let createdContact = false;
    if (contact.rows.length > 0) {
      phone = contact.rows[0].phone;
    } else {
      phone = '97430009999';
      await client.query(`INSERT INTO wa_contacts (tenant_id, phone, name) VALUES ($1, $2, 'Test Contact')`, [tenantId, phone]);
      createdContact = true;
    }

    // 1. Insert test click
    const clickRes = await client.query(`
      INSERT INTO wa_ad_clicks (tenant_id, phone, ad_title, ad_body, source_url, source_id)
      VALUES ($1, $2, 'Special Promo Ad', 'Get 20% off web development today', 'https://fb.me/test', 'ad_src_999')
      RETURNING id;
    `, [tenantId, phone]);
    const clickId = clickRes.rows[0].id;
    assert("Test ad click inserted", !!clickId);

    // 2. Query grouped ads
    const adsQuery = await client.query(`
      WITH grouped_ads AS (
        SELECT
          COALESCE(c.source_id, c.ad_title)          AS group_key,
          MAX(c.source_id)                            AS source_id,
          MAX(c.ad_title)                             AS ad_title,
          MAX(c.ad_body)                              AS ad_body,
          COUNT(*)::int                               AS clicks,
          COUNT(DISTINCT c.phone)::int                AS people,
          to_char(MAX(c.created_at), 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS last_seen
        FROM wa_ad_clicks c
       WHERE c.tenant_id = $1
       GROUP BY COALESCE(c.source_id, c.ad_title)
      )
      SELECT
        g.*,
        COALESCE(p.booked, 0)::int    AS bookings,
        COALESCE(p.completed, 0)::int AS completed,
        pb.id                         AS playbook_id,
        pb.name                       AS playbook_name
      FROM grouped_ads g
      LEFT JOIN wa_v_ad_performance p
             ON p.tenant_id = $1
            AND p.ad_key = g.group_key
      LEFT JOIN LATERAL (
        SELECT pb.id, pb.name
          FROM wa_ad_playbooks pb
         WHERE pb.tenant_id = $1
           AND pb.active = true
           AND (
             (pb.match_type = 'source_id'       AND g.source_id IS NOT NULL AND pb.match_value = g.source_id)
             OR (pb.match_type = 'title_contains' AND g.ad_title ILIKE '%' || pb.match_value || '%')
             OR pb.match_type = 'any'
           )
         ORDER BY
           CASE pb.match_type
             WHEN 'source_id' THEN 1
             WHEN 'title_contains' THEN 2
             ELSE 3
           END,
           pb.sort_order ASC,
           pb.id ASC
         LIMIT 1
      ) pb ON true
      WHERE g.group_key = 'ad_src_999'
      ORDER BY g.last_seen DESC;
    `, [tenantId]);

    assert("Grouped ad returned with clicks and people counts", adsQuery.rows.length === 1);
    assert("Matches source_id", adsQuery.rows[0]?.source_id === 'ad_src_999');
    assert("Has 1 click", adsQuery.rows[0]?.clicks === 1);
    assert("Has 1 person", adsQuery.rows[0]?.people === 1);
    assert("Playbook is initially null", adsQuery.rows[0]?.playbook_id === null);

    // 3. Create a playbook matching this source_id
    const pbRes = await client.query(`
      INSERT INTO wa_ad_playbooks (tenant_id, name, match_type, match_value, instructions, active, sort_order)
      VALUES ($1, 'Web Dev Promo Playbook', 'source_id', 'ad_src_999', 'Offer special package pricing', true, 1)
      RETURNING id;
    `, [tenantId]);
    const pbId = pbRes.rows[0].id;
    assert("Playbook created with source_id match", !!pbId);

    // 4. Re-query grouped ads to verify lateral join picked up the playbook
    const adsQuery2 = await client.query(`
      WITH grouped_ads AS (
        SELECT
          COALESCE(c.source_id, c.ad_title)          AS group_key,
          MAX(c.source_id)                            AS source_id,
          MAX(c.ad_title)                             AS ad_title,
          MAX(c.ad_body)                              AS ad_body,
          COUNT(*)::int                               AS clicks,
          COUNT(DISTINCT c.phone)::int                AS people,
          to_char(MAX(c.created_at), 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS last_seen
        FROM wa_ad_clicks c
       WHERE c.tenant_id = $1
       GROUP BY COALESCE(c.source_id, c.ad_title)
      )
      SELECT
        g.*,
        pb.id                         AS playbook_id,
        pb.name                       AS playbook_name
      FROM grouped_ads g
      LEFT JOIN LATERAL (
        SELECT pb.id, pb.name
          FROM wa_ad_playbooks pb
         WHERE pb.tenant_id = $1
           AND pb.active = true
           AND (
             (pb.match_type = 'source_id'       AND g.source_id IS NOT NULL AND pb.match_value = g.source_id)
             OR (pb.match_type = 'title_contains' AND g.ad_title ILIKE '%' || pb.match_value || '%')
             OR pb.match_type = 'any'
           )
         ORDER BY
           CASE pb.match_type
             WHEN 'source_id' THEN 1
             WHEN 'title_contains' THEN 2
             ELSE 3
           END,
           pb.sort_order ASC,
           pb.id ASC
         LIMIT 1
      ) pb ON true
      WHERE g.group_key = 'ad_src_999';
    `, [tenantId]);

    assert("Grouped ad now shows linked playbook", adsQuery2.rows[0]?.playbook_id === pbId);
    assert("Playbook name is 'Web Dev Promo Playbook'", adsQuery2.rows[0]?.playbook_name === 'Web Dev Promo Playbook');

    // 5. Test match_type = 'any' with match_value = ''
    const anyPbRes = await client.query(`
      INSERT INTO wa_ad_playbooks (tenant_id, name, match_type, match_value, instructions, active, sort_order)
      VALUES ($1, 'Catch-all Any Ad', 'any', '', 'Default ad handler', true, 99)
      RETURNING id;
    `, [tenantId]);
    const anyPbId = anyPbRes.rows[0].id;
    assert("Any ad playbook inserted with empty string match_value", !!anyPbId);

    // 6. Verify priority: source_id (priority 1) should be chosen over 'any' (priority 3)
    const adsQuery3 = await client.query(`
      WITH grouped_ads AS (
        SELECT
          COALESCE(c.source_id, c.ad_title)          AS group_key,
          MAX(c.source_id)                            AS source_id,
          MAX(c.ad_title)                             AS ad_title
        FROM wa_ad_clicks c
       WHERE c.tenant_id = $1
       GROUP BY COALESCE(c.source_id, c.ad_title)
      )
      SELECT
        pb.id                         AS playbook_id,
        pb.name                       AS playbook_name
      FROM grouped_ads g
      LEFT JOIN LATERAL (
        SELECT pb.id, pb.name
          FROM wa_ad_playbooks pb
         WHERE pb.tenant_id = $1
           AND pb.active = true
           AND (
             (pb.match_type = 'source_id'       AND g.source_id IS NOT NULL AND pb.match_value = g.source_id)
             OR (pb.match_type = 'title_contains' AND g.ad_title ILIKE '%' || pb.match_value || '%')
             OR pb.match_type = 'any'
           )
         ORDER BY
           CASE pb.match_type
             WHEN 'source_id' THEN 1
             WHEN 'title_contains' THEN 2
             ELSE 3
           END,
           pb.sort_order ASC,
           pb.id ASC
         LIMIT 1
      ) pb ON true
      WHERE g.group_key = 'ad_src_999';
    `, [tenantId]);

    assert("Priority rule selected specific source_id playbook over 'any'", adsQuery3.rows[0]?.playbook_id === pbId);

    // 7. Cleanup test data
    await client.query(`DELETE FROM wa_ad_clicks WHERE id = $1;`, [clickId]);
    await client.query(`DELETE FROM wa_ad_playbooks WHERE id IN ($1, $2);`, [pbId, anyPbId]);
    if (createdContact) {
      await client.query(`DELETE FROM wa_contacts WHERE tenant_id = $1 AND phone = $2;`, [tenantId, phone]);
    }
    assert("Cleanup executed successfully", true);

    console.log(`\nVerification Summary: ${passed} Passed, ${failed} Failed`);
    process.exit(failed > 0 ? 1 : 0);

  } catch (err) {
    console.error("Verification failed with exception:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
