#!/usr/bin/env node
/**
 * test-integrations.mjs
 * Comprehensive integration tests for API Keys, Webhooks, and n8n webhook authentication.
 *
 * Usage:
 *   BASE_URL=https://ai.webbea.qa node scripts/test-integrations.mjs
 */

import { SignJWT } from "jose";

const BASE = process.env.BASE_URL || "https://ai.webbea.qa";
const N8N_URL = process.env.N8N_WEBHOOK_URL || "https://n8n.webbea.qa/webhook/tenant-api";
const SESSION_SECRET =
  process.env.SESSION_SECRET || "a21764c24ff36691c28c899a77d56e6d1e57cdebf457b9e07584ec66c7e140d3";

let passed = 0;
let failed = 0;

function assert(label, cond, extra = "") {
  if (cond) {
    console.log(`  \x1b[32m✓\x1b[0m ${label}`);
    passed++;
  } else {
    console.error(`  \x1b[31m✗\x1b[0m ${label}${extra ? " — " + extra : ""}`);
    failed++;
  }
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

async function api(method, path, cookie, body) {
  const headers = { "Content-Type": "application/json" };
  if (cookie) headers["Cookie"] = cookie;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data = {};
  try {
    data = await res.json();
  } catch {
    data = { raw: await res.text().catch(() => "") };
  }
  return { status: res.status, data };
}

async function run() {
  console.log(`\n======================================================`);
  console.log(`INTEGRATION & API KEYS TEST SUITE`);
  console.log(`Target: ${BASE}`);
  console.log(`n8n endpoint: ${N8N_URL}`);
  console.log(`======================================================\n`);

  // Setup test session cookies
  const cookieOwnerA = await createSessionCookie({
    userId: 2,
    tenantId: 1,
    email: "user@webbea.qa",
    name: "Tenant 1 Owner",
    role: "owner",
    superAdmin: false,
  });

  const cookieStaffA = await createSessionCookie({
    userId: 999,
    tenantId: 1,
    email: "staff@webbea.qa",
    name: "Tenant 1 Staff",
    role: "staff",
    superAdmin: false,
  });

  const cookieOwnerB = await createSessionCookie({
    userId: 8,
    tenantId: 49,
    email: "rejil@adam.qa",
    name: "Tenant 49 Owner",
    role: "owner",
    superAdmin: false,
  });

  const cookieSuperAdmin = await createSessionCookie({
    userId: 1,
    tenantId: 1,
    email: "admin@webbea.qa",
    name: "Super Admin",
    role: "owner",
    superAdmin: true,
  });

  // ── 1. Auth & Role enforcement ──────────────────────────────────────────
  console.log("1. Authorization & Role Guards");
  {
    const noAuth = await api("GET", "/api/integrations/keys", null);
    assert("Unauthenticated request rejected with 401", noAuth.status === 401);

    const staffReq = await api("GET", "/api/integrations/keys", cookieStaffA);
    assert("Staff role forbidden with 403 (owner only)", staffReq.status === 403);

    const ownerReq = await api("GET", "/api/integrations/keys", cookieOwnerA);
    assert("Owner role allowed with 200", ownerReq.status === 200 && Array.isArray(ownerReq.data.keys));
  }

  // ── 2. Create API Key for Tenant A ──────────────────────────────────────
  console.log("\n2. Create API Key for Tenant A");
  let testKeyId = null;
  let testApiKey = null;
  const testKeyName = `Test Key ${Date.now()}`;

  {
    const res = await api("POST", "/api/integrations/keys", cookieOwnerA, {
      name: testKeyName,
      scopes: ["read", "write"],
      rate_limit_per_min: 120,
    });

    assert("201 Created on valid API key creation", res.status === 201, JSON.stringify(res.data));
    assert("Returns full raw apiKey string", typeof res.data.apiKey === "string");
    assert("Raw apiKey is exactly 48 chars", res.data.apiKey?.length === 48);
    assert("Key prefix is 8 chars starting with wbk_", res.data.key?.key_prefix?.startsWith("wbk_") && res.data.key?.key_prefix?.length === 8);
    assert("Raw apiKey matches key_prefix", res.data.apiKey?.startsWith(res.data.key?.key_prefix));
    assert("Rate limit set correctly", res.data.key?.rate_limit_per_min === 120);
    assert("Key is active by default", res.data.key?.active === true);

    testKeyId = res.data.key?.id;
    testApiKey = res.data.apiKey;
  }

  // ── 3. Duplicate name prevention ────────────────────────────────────────
  console.log("\n3. Duplicate Key Name Validation");
  {
    const res = await api("POST", "/api/integrations/keys", cookieOwnerA, {
      name: testKeyName,
    });
    assert("409 Conflict when creating key with duplicate name", res.status === 409);
  }

  // ── 4. Use key against real n8n webhook endpoint ────────────────────────
  console.log("\n4. Test API Key against n8n Webhook (/services endpoint)");
  {
    const n8nRes = await fetch(N8N_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": testApiKey,
      },
      body: JSON.stringify({ endpoint: "/services" }),
    });

    let n8nData = {};
    try {
      n8nData = await n8nRes.json();
    } catch {}

    assert("n8n returns HTTP 200 with valid key", n8nRes.status === 200, `HTTP ${n8nRes.status}`);
    assert("n8n response has ok=true", n8nData.ok === true, JSON.stringify(n8nData));
    assert("n8n response returned services list", Array.isArray(n8nData.services));
  }

  // Also test with /stats
  console.log("\n4b. Test API Key against n8n Webhook (/stats endpoint)");
  {
    const n8nRes = await fetch(N8N_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": testApiKey,
      },
      body: JSON.stringify({ endpoint: "/stats" }),
    });

    const n8nData = await n8nRes.json().catch(() => ({}));
    assert("n8n /stats returns HTTP 200", n8nRes.status === 200);
    assert("n8n /stats returned stats object", typeof n8nData.stats === "object");
  }

  // ── 5. Verify API Logs recorded ─────────────────────────────────────────
  console.log("\n5. API Logs Recording");
  {
    const res = await api("GET", "/api/integrations/logs", cookieOwnerA);
    assert("200 on GET /api/integrations/logs", res.status === 200);
    assert("Logs array returned", Array.isArray(res.data.logs));
    const foundLog = res.data.logs?.find((l) => l.key_id === testKeyId);
    assert("Found log entry matching the created key", !!foundLog);
    if (foundLog) {
      assert("Log status is 200", foundLog.status === 200);
      assert("Log has key name", foundLog.key_name === testKeyName);
    }
  }

  // ── 6. Deactivate Key ───────────────────────────────────────────────────
  console.log("\n6. Deactivate API Key (PATCH /api/integrations/keys/:id)");
  {
    const res = await api("PATCH", `/api/integrations/keys/${testKeyId}`, cookieOwnerA, {
      active: false,
    });
    assert("200 on key update", res.status === 200);
    assert("Key active is now false", res.data.key?.active === false);
  }

  // ── 7. Deactivated key fails with 401 ───────────────────────────────────
  console.log("\n7. Verify Deactivated Key Fails against n8n (Expect HTTP 401)");
  {
    const n8nRes = await fetch(N8N_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": testApiKey,
      },
      body: JSON.stringify({ endpoint: "/services" }),
    });

    let n8nData = {};
    try {
      n8nData = await n8nRes.json();
    } catch {}

    assert("n8n rejects deactivated key with HTTP 401", n8nRes.status === 401, `got ${n8nRes.status}`);
    assert("Response error indicates invalid or expired key", String(n8nData.error).toLowerCase().includes("invalid or expired"));
  }

  // ── 8. Cross-tenant isolation (Tenant B cannot see/edit Tenant A's key) ─
  console.log("\n8. Cross-Tenant Security Isolation");
  {
    // Tenant B lists keys: should not include testKeyId
    const resBList = await api("GET", "/api/integrations/keys", cookieOwnerB);
    assert("Tenant B GET /api/integrations/keys returns 200", resBList.status === 200);
    const hasAKey = resBList.data.keys?.some((k) => k.id === testKeyId);
    assert("Tenant B CANNOT see Tenant A's API key", !hasAKey);

    // Tenant B tries to PATCH Tenant A's key: 404
    const resBPatch = await api("PATCH", `/api/integrations/keys/${testKeyId}`, cookieOwnerB, {
      active: true,
    });
    assert("Tenant B PATCH on Tenant A key returns 404", resBPatch.status === 404);

    // Tenant B tries to DELETE Tenant A's key: 404
    const resBDelete = await api("DELETE", `/api/integrations/keys/${testKeyId}`, cookieOwnerB);
    assert("Tenant B DELETE on Tenant A key returns 404", resBDelete.status === 404);

    // Tenant B logs should not show Tenant A calls
    const resBLogs = await api("GET", "/api/integrations/logs", cookieOwnerB);
    const hasALog = resBLogs.data.logs?.some((l) => l.key_id === testKeyId);
    assert("Tenant B CANNOT view Tenant A's API logs", !hasALog);
  }

  // ── 9. Platform admin revoke all keys ───────────────────────────────────
  console.log("\n9. Platform Admin Revoke All Keys");
  {
    // First reactivate Tenant A's key
    await api("PATCH", `/api/integrations/keys/${testKeyId}`, cookieOwnerA, { active: true });

    // Platform admin revokes all keys of Tenant 1
    const revokeRes = await api("POST", `/api/admin/tenants/1/revoke-keys`, cookieSuperAdmin);
    assert("Super admin revokes all keys with 200", revokeRes.status === 200);
    assert("Revoked count is at least 1", revokeRes.data.revoked_count >= 1);

    // Verify key is now deactivated
    const listRes = await api("GET", "/api/integrations/keys", cookieOwnerA);
    const keyAfterRevoke = listRes.data.keys?.find((k) => k.id === testKeyId);
    assert("Tenant A key is deactivated following platform admin revoke", keyAfterRevoke?.active === false);
  }

  // ── 10. Clear API Logs ─────────────────────────────────────────────────
  console.log("\n10. Clear API Logs");
  {
    const clearRes = await api("DELETE", "/api/integrations/logs", cookieOwnerA);
    assert("DELETE /api/integrations/logs returns 200", clearRes.status === 200);
    assert("cleared=true in response", clearRes.data.cleared === true);

    const checkLogs = await api("GET", "/api/integrations/logs", cookieOwnerA);
    assert("Logs count is now 0 after clearing", checkLogs.data.logs?.length === 0);
  }

  // ── 11. Delete Key Cleanup ──────────────────────────────────────────────
  console.log("\n11. Delete API Key (DELETE /api/integrations/keys/:id)");
  {
    const delRes = await api("DELETE", `/api/integrations/keys/${testKeyId}`, cookieOwnerA);
    assert("200 on key deletion", delRes.status === 200);
    assert("deleted=true in response", delRes.data.deleted === true);

    const listAfterDel = await api("GET", "/api/integrations/keys", cookieOwnerA);
    const stillExists = listAfterDel.data.keys?.some((k) => k.id === testKeyId);
    assert("Key successfully removed from database", !stillExists);
  }

  // ── Summary ─────────────────────────────────────────────────────────────
  console.log(`\n${"─".repeat(54)}`);
  console.log(`Passed: \x1b[32m${passed}\x1b[0m   Failed: \x1b[31m${failed}\x1b[0m`);
  console.log(`${"─".repeat(54)}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("Test runner threw error:", err);
  process.exit(1);
});
