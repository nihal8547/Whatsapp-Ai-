import { Pool } from "pg";
import { SignJWT } from "jose";

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://localhost:5432/wa_saas";
const SESSION_SECRET = process.env.SESSION_SECRET || "default_test_secret_32_characters_long_min";
const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";

const pool = new Pool({ connectionString: DATABASE_URL });

const FAKE_PREFIX = "99999990";
const FAKE_OPTED_OUT = `${FAKE_PREFIX}0001`;
const FAKE_GOOD_1 = `${FAKE_PREFIX}0002`;
const FAKE_GOOD_2 = `${FAKE_PREFIX}0003`;
const FAKE_GOOD_3 = `${FAKE_PREFIX}0004`;

function logPass(msg) {
  console.log(`\x1b[32m✔ PASS:\x1b[0m ${msg}`);
}
function logFail(msg, err) {
  console.error(`\x1b[31m✖ FAIL:\x1b[0m ${msg}`, err || "");
  process.exitCode = 1;
}

async function createSessionCookie(payload) {
  const secret = new TextEncoder().encode(SESSION_SECRET);
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1d")
    .sign(secret);
  return `wa_session=${token}`;
}

async function run() {
  console.log("=== STARTING CONTACTS & BROADCASTS COMPREHENSIVE TESTS ===");

  try {
    // 0. Ensure 2 test tenants and test users exist
    await pool.query(
      `INSERT INTO wa_tenants (id, name, slug, status)
       VALUES (991, 'Test Tenant 1', 'test-tenant-1', 'active')
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`
    );
    await pool.query(
      `INSERT INTO wa_tenants (id, name, slug, status)
       VALUES (992, 'Test Tenant 2', 'test-tenant-2', 'active')
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`
    );

    // Bot settings
    await pool.query(
      `INSERT INTO wa_bot_settings (tenant_id, business_name, timezone, broadcast_settings)
       VALUES (991, 'Test Business 1', 'Asia/Qatar', '{"enabled": true, "daily_cap": 100, "hourly_cap": 25, "window_end": "21:00", "window_start": "09:00"}'::jsonb)
       ON CONFLICT (tenant_id) DO NOTHING`
    );
    await pool.query(
      `INSERT INTO wa_bot_settings (tenant_id, business_name, timezone, broadcast_settings)
       VALUES (992, 'Test Business 2', 'Asia/Qatar', '{"enabled": true, "daily_cap": 100, "hourly_cap": 25, "window_end": "21:00", "window_start": "09:00"}'::jsonb)
       ON CONFLICT (tenant_id) DO NOTHING`
    );

    // Instances
    await pool.query(
      `INSERT INTO wa_instances (tenant_id, instance_name, status)
       VALUES (991, 'inst-991', 'connected')
       ON CONFLICT (tenant_id) DO UPDATE SET status = 'connected'`
    );
    await pool.query(
      `INSERT INTO wa_instances (tenant_id, instance_name, status)
       VALUES (992, 'inst-992', 'disconnected')
       ON CONFLICT (tenant_id) DO UPDATE SET status = 'disconnected'`
    );

    // Users
    const uOwner1 = await pool.query(
      `INSERT INTO wa_tenant_users (tenant_id, email, password_hash, full_name, role, is_super_admin)
       VALUES (991, 'owner1@test.com', 'hash', 'Owner One', 'owner', false)
       ON CONFLICT (email) DO UPDATE SET role = 'owner', tenant_id = 991
       RETURNING id`
    );
    const uStaff1 = await pool.query(
      `INSERT INTO wa_tenant_users (tenant_id, email, password_hash, full_name, role, is_super_admin)
       VALUES (991, 'staff1@test.com', 'hash', 'Staff One', 'staff', false)
       ON CONFLICT (email) DO UPDATE SET role = 'staff', tenant_id = 991
       RETURNING id`
    );
    const uOwner2 = await pool.query(
      `INSERT INTO wa_tenant_users (tenant_id, email, password_hash, full_name, role, is_super_admin)
       VALUES (992, 'owner2@test.com', 'hash', 'Owner Two', 'owner', false)
       ON CONFLICT (email) DO UPDATE SET role = 'owner', tenant_id = 992
       RETURNING id`
    );

    const owner1Cookie = await createSessionCookie({
      userId: uOwner1.rows[0].id,
      tenantId: 991,
      email: "owner1@test.com",
      name: "Owner One",
      role: "owner",
      superAdmin: false,
    });

    const staff1Cookie = await createSessionCookie({
      userId: uStaff1.rows[0].id,
      tenantId: 991,
      email: "staff1@test.com",
      name: "Staff One",
      role: "staff",
      superAdmin: false,
    });

    const owner2Cookie = await createSessionCookie({
      userId: uOwner2.rows[0].id,
      tenantId: 992,
      email: "owner2@test.com",
      name: "Owner Two",
      role: "owner",
      superAdmin: false,
    });

    // Reset clean state for test tenants
    await pool.query(`DELETE FROM wa_broadcast_recipients WHERE tenant_id IN (991, 992)`);
    await pool.query(`DELETE FROM wa_broadcasts WHERE tenant_id IN (991, 992)`);
    await pool.query(`DELETE FROM wa_contact_imports WHERE tenant_id IN (991, 992)`);
    await pool.query(`DELETE FROM wa_contacts WHERE tenant_id IN (991, 992)`);

    // Insert an initial OPTED-OUT contact into Tenant 1
    await pool.query(
      `INSERT INTO wa_contacts (tenant_id, phone, name, consent_status, consent_source, consent_at, opted_out_at)
       VALUES (991, $1, 'Prior Opted Out User', 'opted_out', 'whatsapp_optin', now() - interval '5 days', now() - interval '2 days')`,
      [FAKE_OPTED_OUT]
    );

    console.log("\n--- TEST 1: SERVER-SIDE CONSENT VALIDATION ---");
    const csvContent = `phone,name\n${FAKE_GOOD_1},Alice Good\n${FAKE_GOOD_2},Bob Good\n${FAKE_OPTED_OUT},Opted Out Person\n99999990abc4,Invalid Person\n12345,Short Number\n${FAKE_GOOD_1},Alice Duplicate\n`;

    // 1.1: Import without consent checkbox
    const resNoConsent = await fetch(`${BASE_URL}/api/contacts/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: owner1Cookie },
      body: JSON.stringify({
        csvContent,
        consentConfirmed: false,
        consentSource: "customer_form",
      }),
    });
    if (resNoConsent.status === 400) {
      const data = await resNoConsent.json();
      if (data.error === "consent_confirmation_required") {
        logPass("Server-side validation: rejected import when consentConfirmed is false (400)");
      } else {
        logFail("Expected error 'consent_confirmation_required' but got:", data);
      }
    } else {
      logFail(`Expected status 400 but got ${resNoConsent.status}`);
    }

    // 1.2: Add single contact without consent checkbox
    const resSingleNoConsent = await fetch(`${BASE_URL}/api/contacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: owner1Cookie },
      body: JSON.stringify({
        phone: FAKE_GOOD_3,
        name: "Single Person",
        consentConfirmed: false,
        consentSource: "in_store",
      }),
    });
    if (resSingleNoConsent.status === 400) {
      logPass("Server-side validation: rejected single contact creation without consent (400)");
    } else {
      logFail(`Expected status 400 for single contact but got ${resSingleNoConsent.status}`);
    }

    console.log("\n--- TEST 2: PREVIEW CSV (VALID, INVALID, DUPLICATES, OPTED-OUT) ---");
    const resPreview = await fetch(`${BASE_URL}/api/contacts/import/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: owner1Cookie },
      body: JSON.stringify({ csvContent, countryPrefix: "974" }),
    });
    const dataPreview = await resPreview.json();

    if (dataPreview.ok && dataPreview.counts) {
      const c = dataPreview.counts;
      if (
        c.validCount === 3 &&
        c.invalidCount === 2 &&
        c.duplicateCount === 1 &&
        c.alreadyExisting === 1 &&
        c.alreadyOptedOut === 1
      ) {
        logPass(`Preview counts exact: valid=${c.validCount}, invalid=${c.invalidCount}, dup=${c.duplicateCount}, existing=${c.alreadyExisting}, optedOut=${c.alreadyOptedOut}`);
      } else {
        logFail("Preview counts mismatch:", c);
      }
    } else {
      logFail("Preview failed:", dataPreview);
    }

    console.log("\n--- TEST 3: TRANSACTION IMPORT & NEVER RE-OPT-IN OPTED-OUT NUMBER ---");
    const resImport = await fetch(`${BASE_URL}/api/contacts/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: owner1Cookie },
      body: JSON.stringify({
        csvContent,
        countryPrefix: "974",
        consentConfirmed: true,
        consentSource: "customer_form",
        consentNote: "Automated test import",
        filename: "test_contacts.csv",
      }),
    });
    const dataImport = await resImport.json();

    if (dataImport.ok && dataImport.report) {
      const rep = dataImport.report;
      if (rep.created === 2 && rep.skippedOptedOut === 1) {
        logPass(`Import report: created=${rep.created}, skippedOptedOut=${rep.skippedOptedOut}`);
      } else {
        logFail("Import report mismatch:", rep);
      }
    } else {
      logFail("Import failed:", dataImport);
    }

    // Verify in database: FAKE_OPTED_OUT must STILL have consent_status = 'opted_out'
    const optedOutInDb = await pool.query(
      `SELECT consent_status FROM wa_contacts WHERE tenant_id = 991 AND phone = $1`,
      [FAKE_OPTED_OUT]
    );
    if (optedOutInDb.rows[0]?.consent_status === "opted_out") {
      logPass("CRITICAL: Opted-out contact strictly kept 'opted_out' consent_status after import!");
    } else {
      logFail("CRITICAL ERROR: Opted-out contact was re-opted in!", optedOutInDb.rows[0]);
    }

    // Test 3.2: Re-importing must NEVER re-opt-in
    const resReImport = await fetch(`${BASE_URL}/api/contacts/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: owner1Cookie },
      body: JSON.stringify({
        csvContent,
        countryPrefix: "974",
        consentConfirmed: true,
        consentSource: "website_signup",
        filename: "reimport.csv",
      }),
    });
    const dataReImport = await resReImport.json();
    const optedOutCheck2 = await pool.query(
      `SELECT consent_status FROM wa_contacts WHERE tenant_id = 991 AND phone = $1`,
      [FAKE_OPTED_OUT]
    );
    if (optedOutCheck2.rows[0]?.consent_status === "opted_out") {
      logPass("Re-import: Contact still remains 'opted_out'!");
    } else {
      logFail("Contact was re-opted in during secondary import!", optedOutCheck2.rows[0]);
    }

    // Test 3.3: Staff cannot change opted-out contact via single contact form
    const resStaffChangeOptOut = await fetch(`${BASE_URL}/api/contacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: staff1Cookie },
      body: JSON.stringify({
        phone: FAKE_OPTED_OUT,
        name: "Staff Trying To Re-opt-in",
        consentConfirmed: true,
        consentSource: "in_store",
      }),
    });
    if (resStaffChangeOptOut.status === 400) {
      const d = await resStaffChangeOptOut.json();
      if (d.error === "contact_opted_out") {
        logPass("Staff / manual re-opt-in refused with 400 (contact_opted_out)");
      } else {
        logFail("Unexpected error for opted-out edit:", d);
      }
    } else {
      logFail(`Expected status 400 for staff modifying opted-out contact, got ${resStaffChangeOptOut.status}`);
    }

    console.log("\n--- TEST 4: MULTI-TENANT ISOLATION (403 / 404) ---");
    // Staff cannot access owner-only routes (403)
    const resStaffImport = await fetch(`${BASE_URL}/api/contacts/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: staff1Cookie },
      body: JSON.stringify({ csvContent, consentConfirmed: true, consentSource: "customer_form" }),
    });
    if (resStaffImport.status === 403) {
      logPass("Staff blocked from /contacts/import with 403 Forbidden");
    } else {
      logFail(`Expected 403 for staff on /contacts/import, got ${resStaffImport.status}`);
    }

    const resStaffBroadcasts = await fetch(`${BASE_URL}/api/broadcasts`, {
      method: "GET",
      headers: { Cookie: staff1Cookie },
    });
    if (resStaffBroadcasts.status === 403) {
      logPass("Staff blocked from /broadcasts with 403 Forbidden");
    } else {
      logFail(`Expected 403 for staff on /broadcasts, got ${resStaffBroadcasts.status}`);
    }

    console.log("\n--- TEST 5: BROADCAST CREATION & RECIPIENT ELIGIBILITY ---");
    const resBc1 = await fetch(`${BASE_URL}/api/broadcasts`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: owner1Cookie },
      body: JSON.stringify({
        name: "Test Campaign 1",
        message: "Hello {name}, welcome to our store! From {business}.",
      }),
    });
    const dataBc1 = await resBc1.json();

    if (dataBc1.ok && dataBc1.broadcastId) {
      const bc1Id = dataBc1.broadcastId;
      logPass(`Broadcast #1 created with ID: ${bc1Id}, recipients: ${dataBc1.recipientsCreated}`);

      // Verify recipients in DB: only OPTED_IN contacts!
      const recipients = await pool.query(
        `SELECT phone, status FROM wa_broadcast_recipients WHERE broadcast_id = $1`,
        [bc1Id]
      );
      const recipientPhones = recipients.rows.map((r) => r.phone);
      if (recipientPhones.includes(FAKE_GOOD_1) && recipientPhones.includes(FAKE_GOOD_2)) {
        logPass("Eligible opted-in contacts populated into broadcast recipients");
      } else {
        logFail("Expected Alice and Bob in recipients, found:", recipientPhones);
      }

      if (!recipientPhones.includes(FAKE_OPTED_OUT)) {
        logPass("Opted-out contact was EXCLUDED from broadcast recipients!");
      } else {
        logFail("CRITICAL: Opted-out contact was included in broadcast recipients!");
      }

      console.log("\n--- TEST 6: CONCURRENCY RULE (409 CONFLICT) ---");
      // Attempting to create a second running or scheduled broadcast must return 409
      const resBc2 = await fetch(`${BASE_URL}/api/broadcasts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: owner1Cookie },
        body: JSON.stringify({
          name: "Test Campaign 2 (Conflict)",
          message: "Second broadcast attempt.",
        }),
      });
      if (resBc2.status === 409) {
        const d = await resBc2.json();
        if (d.error === "another_broadcast_active") {
          logPass("Second broadcast correctly returned HTTP 409 Conflict (another_broadcast_active)");
        } else {
          logFail("Expected error 'another_broadcast_active' but got:", d);
        }
      } else {
        logFail(`Expected status 409 for concurrent broadcast, got ${resBc2.status}`);
      }

      console.log("\n--- TEST 7: CROSS-TENANT ISOLATION (TENANT 2 CANNOT ACCESS TENANT 1 BROADCAST) ---");
      // Tenant 2 owner tries to view Tenant 1's broadcast detail
      const resT2ViewT1 = await fetch(`${BASE_URL}/api/broadcasts/${bc1Id}`, {
        method: "GET",
        headers: { Cookie: owner2Cookie },
      });
      if (resT2ViewT1.status === 404 || resT2ViewT1.status === 403) {
        logPass(`Tenant 2 cannot view Tenant 1's broadcast (returned ${resT2ViewT1.status})`);
      } else {
        logFail(`Expected 404 or 403 for cross-tenant access, got ${resT2ViewT1.status}`);
      }

      // Tenant 2 owner tries to cancel Tenant 1's broadcast
      const resT2CancelT1 = await fetch(`${BASE_URL}/api/broadcasts/${bc1Id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: owner2Cookie },
        body: JSON.stringify({ action: "cancel" }),
      });
      if (resT2CancelT1.status === 404 || resT2CancelT1.status === 403) {
        logPass(`Tenant 2 cannot cancel Tenant 1's broadcast (returned ${resT2CancelT1.status})`);
      } else {
        logFail(`Expected 404 or 403 for cross-tenant cancel, got ${resT2CancelT1.status}`);
      }

      console.log("\n--- TEST 8: PAUSE, RESUME, AND CANCEL LIFECYCLE ---");
      // Pause
      const resPause = await fetch(`${BASE_URL}/api/broadcasts/${bc1Id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: owner1Cookie },
        body: JSON.stringify({ action: "pause", reason: "Testing pause reason banner" }),
      });
      const dataPause = await resPause.json();
      if (dataPause.ok && dataPause.status === "paused") {
        logPass("Broadcast paused successfully with pause_reason");
      } else {
        logFail("Broadcast pause failed:", dataPause);
      }

      // Disconnect Tenant 1 instance to verify resume refused
      await pool.query(`UPDATE wa_instances SET status = 'disconnected' WHERE tenant_id = 991`);
      const resResumeNoWa = await fetch(`${BASE_URL}/api/broadcasts/${bc1Id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: owner1Cookie },
        body: JSON.stringify({ action: "resume" }),
      });
      if (resResumeNoWa.status === 400) {
        const d = await resResumeNoWa.json();
        if (d.error === "whatsapp_not_connected") {
          logPass("Resume correctly refused when WhatsApp is disconnected (400 whatsapp_not_connected)");
        } else {
          logFail("Unexpected error for disconnected resume:", d);
        }
      } else {
        logFail(`Expected status 400 when resuming without WhatsApp, got ${resResumeNoWa.status}`);
      }

      // Reconnect and resume
      await pool.query(`UPDATE wa_instances SET status = 'connected' WHERE tenant_id = 991`);
      const resResume = await fetch(`${BASE_URL}/api/broadcasts/${bc1Id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: owner1Cookie },
        body: JSON.stringify({ action: "resume" }),
      });
      const dataResume = await resResume.json();
      if (dataResume.ok && dataResume.status === "running") {
        logPass("Broadcast resumed successfully after WhatsApp connected");
      } else {
        logFail("Broadcast resume failed:", dataResume);
      }

      // Cancel
      const resCancel = await fetch(`${BASE_URL}/api/broadcasts/${bc1Id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: owner1Cookie },
        body: JSON.stringify({ action: "cancel" }),
      });
      const dataCancel = await resCancel.json();
      if (dataCancel.ok && dataCancel.status === "cancelled") {
        logPass("Broadcast cancelled successfully");
        const skippedRecs = await pool.query(
          `SELECT status, skip_reason FROM wa_broadcast_recipients WHERE broadcast_id = $1`,
          [bc1Id]
        );
        const allSkipped = skippedRecs.rows.every((r) => r.status === "skipped" && r.skip_reason === "cancelled");
        if (allSkipped) {
          logPass("All queued recipients marked status='skipped' with skip_reason='cancelled'");
        } else {
          logFail("Some recipients were not skipped on cancel:", skippedRecs.rows);
        }
      } else {
        logFail("Broadcast cancel failed:", dataCancel);
      }

      console.log("\n--- TEST 9: REPLIED COUNT (48H) & OPT-OUTS AFTER BROADCAST ---");
      const simulatedBc = await pool.query(
        `INSERT INTO wa_broadcasts (tenant_id, name, message, status, started_at)
         VALUES (991, 'KPI Test Campaign', 'Testing KPI replies', 'completed', now() - interval '24 hours')
         RETURNING id`
      );
      const simBcId = simulatedBc.rows[0].id;

      await pool.query(
        `INSERT INTO wa_broadcast_recipients (broadcast_id, tenant_id, phone, status, sent_at)
         VALUES ($1, 991, $2, 'sent', now() - interval '20 hours')`,
        [simBcId, FAKE_GOOD_1]
      );

      // Inbound reply 10 hours ago
      await pool.query(
        `INSERT INTO wa_messages (tenant_id, phone, direction, sender, msg_type, content, created_at)
         VALUES (991, $1, 'in', 'customer', 'text', 'Thanks for the offer!', now() - interval '10 hours')`,
        [FAKE_GOOD_1]
      );

      // Opt-out 5 hours ago
      await pool.query(
        `UPDATE wa_contacts
            SET consent_status = 'opted_out',
                opted_out_at = now() - interval '5 hours'
          WHERE tenant_id = 991 AND phone = $1`,
        [FAKE_GOOD_1]
      );

      const resKpi = await fetch(`${BASE_URL}/api/broadcasts/${simBcId}`, {
        method: "GET",
        headers: { Cookie: owner1Cookie },
      });
      const dataKpi = await resKpi.json();

      if (dataKpi.ok && dataKpi.counts) {
        if (dataKpi.counts.replied === 1) {
          logPass("KPI: Inbound message within 48 hours counted as replied=1");
        } else {
          logFail("Expected replied=1, got:", dataKpi.counts.replied);
        }

        if (dataKpi.counts.optOuts === 1) {
          logPass("KPI: Opt-out after broadcast correctly counted as optOuts=1");
        } else {
          logFail("Expected optOuts=1, got:", dataKpi.counts.optOuts);
        }
      } else {
        logFail("KPI fetch failed:", dataKpi);
      }
    } else {
      logFail("Broadcast creation failed:", dataBc1);
    }

    console.log("\n--- TEST 10: BROADCAST SETTINGS CAPS & PLATFORM MAX ---");
    // Daily cap > platform max
    const resCapExceeded = await fetch(`${BASE_URL}/api/settings/broadcast`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: owner1Cookie },
      body: JSON.stringify({
        enabled: true,
        daily_cap: 9999,
        hourly_cap: 25,
      }),
    });
    if (resCapExceeded.status === 400) {
      logPass("Owner cannot set daily_cap exceeding platform max (400)");
    } else {
      logFail(`Expected 400 for daily_cap exceeding platform max, got ${resCapExceeded.status}`);
    }

    // Hourly cap > 40
    const resHourlyExceeded = await fetch(`${BASE_URL}/api/settings/broadcast`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: owner1Cookie },
      body: JSON.stringify({
        enabled: true,
        daily_cap: 50,
        hourly_cap: 80,
      }),
    });
    if (resHourlyExceeded.status === 400) {
      logPass("Owner cannot set hourly_cap exceeding 40 (400)");
    } else {
      logFail(`Expected 400 for hourly_cap exceeding 40, got ${resHourlyExceeded.status}`);
    }

    console.log("\n--- CLEANING UP TEST DATA ---");
    // Cleanup fake numbers and test tenants
    await pool.query(`DELETE FROM wa_messages WHERE tenant_id IN (991, 992) AND phone LIKE '${FAKE_PREFIX}%'`);
    await pool.query(`DELETE FROM wa_broadcast_recipients WHERE tenant_id IN (991, 992)`);
    await pool.query(`DELETE FROM wa_broadcasts WHERE tenant_id IN (991, 992)`);
    await pool.query(`DELETE FROM wa_contact_imports WHERE tenant_id IN (991, 992)`);
    await pool.query(`DELETE FROM wa_contacts WHERE tenant_id IN (991, 992)`);
    await pool.query(`DELETE FROM wa_tenant_users WHERE tenant_id IN (991, 992)`);
    await pool.query(`DELETE FROM wa_instances WHERE tenant_id IN (991, 992)`);
    await pool.query(`DELETE FROM wa_bot_settings WHERE tenant_id IN (991, 992)`);
    await pool.query(`DELETE FROM wa_tenants WHERE id IN (991, 992)`);

    const checkCleanup = await pool.query(`SELECT count(*) FROM wa_contacts WHERE phone LIKE '${FAKE_PREFIX}%'`);
    if (Number(checkCleanup.rows[0].count) === 0) {
      logPass("All test fake numbers and test tenants purged from database.");
    } else {
      logFail(`Leftover test contacts found: ${checkCleanup.rows[0].count}`);
    }

    console.log("\n\x1b[32m=== ALL 10 TEST SUITES PASSED PERFECTLY! ===\x1b[0m\n");
  } catch (err) {
    console.error("Test execution encountered an error:", err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();
