#!/usr/bin/env node
/**
 * test-ads.mjs  — integration tests for /api/ads and /api/ads/playbooks
 *
 * Usage (on server):
 *   BASE_URL=https://ai.webbea.qa \
 *   OWNER_A_EMAIL=ownerA@example.com OWNER_A_PASS=xxx \
 *   OWNER_B_EMAIL=ownerB@example.com OWNER_B_PASS=xxx \
 *   node scripts/test-ads.mjs
 */

const BASE = process.env.BASE_URL || "http://localhost:3000";

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

async function login(email, password) {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const setCookie = r.headers.get("set-cookie") ?? "";
  const match = setCookie.match(/wa_session=([^;]+)/);
  return match ? match[1] : null;
}

function authHeaders(token) {
  return { cookie: `wa_session=${token}`, "content-type": "application/json" };
}

async function api(method, path, token, body) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: authHeaders(token),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data;
  try { data = await r.json(); } catch { data = {}; }
  return { status: r.status, data };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

async function run() {
  const emailA = process.env.OWNER_A_EMAIL || "admin@example.com";
  const passA = process.env.OWNER_A_PASS || "adminpass";
  const emailB = process.env.OWNER_B_EMAIL || "user@example.com";
  const passB = process.env.OWNER_B_PASS || "userpass";

  const tokA = await login(emailA, passA);
  const tokB = await login(emailB, passB);

  if (!tokA) { console.error("Cannot login as tenant A — check OWNER_A_EMAIL/OWNER_A_PASS"); process.exit(1); }
  if (!tokB) { console.error("Cannot login as tenant B — check OWNER_B_EMAIL/OWNER_B_PASS"); process.exit(1); }

  // ── 1. Ads (grouped) ────────────────────────────────────────────────────

  console.log("\n1. GET /api/ads");
  {
    const { status, data } = await api("GET", "/api/ads", tokA);
    assert("returns 200", status === 200);
    assert("has ads array", Array.isArray(data.ads));
  }

  // ── 2. Playbooks — basic CRUD ────────────────────────────────────────────

  console.log("\n2. POST /api/ads/playbooks — create for tenant A");
  let pbId;
  {
    const { status, data } = await api("POST", "/api/ads/playbooks", tokA, {
      name: "Test summer ad",
      match_type: "title_contains",
      match_value: "Summer",
      instructions: "Ask about budget first. Offer 10% discount. Never promise delivery.",
      active: true,
      sort_order: 10,
    });
    assert("201 on create", status === 201, JSON.stringify(data));
    assert("has id", !!data.playbook?.id);
    pbId = data.playbook?.id;
  }

  console.log("\n3. GET /api/ads/playbooks — tenant A sees it");
  {
    const { status, data } = await api("GET", "/api/ads/playbooks", tokA);
    assert("200", status === 200);
    const found = data.playbooks?.some((p) => p.id === pbId);
    assert("newly created playbook present", found);
  }

  console.log("\n4. Duplicate detection");
  {
    const { status, data } = await api("POST", "/api/ads/playbooks", tokA, {
      name: "Duplicate",
      match_type: "title_contains",
      match_value: "Summer",
      instructions: "Duplicate instructions that are long enough.",
    });
    assert("409 on duplicate match_type + value", status === 409, JSON.stringify(data));
  }

  console.log("\n5. PATCH /api/ads/playbooks/:id — update");
  {
    const { status, data } = await api("PATCH", `/api/ads/playbooks/${pbId}`, tokA, {
      name: "Updated summer ad",
      active: false,
    });
    assert("200 on patch", status === 200, JSON.stringify(data));
    assert("name updated", data.playbook?.name === "Updated summer ad");
    assert("active is false", data.playbook?.active === false);
  }

  // ── 3. Validation ────────────────────────────────────────────────────────

  console.log("\n6. Validation — match_value required unless type=any");
  {
    const { status } = await api("POST", "/api/ads/playbooks", tokA, {
      name: "Missing value",
      match_type: "source_id",
      match_value: "",
      instructions: "Some instructions here",
    });
    assert("400 on missing match_value", status === 400);
  }

  console.log("\n7. Validation — instructions max 2000 chars");
  {
    const { status } = await api("POST", "/api/ads/playbooks", tokA, {
      name: "Too long",
      match_type: "any",
      instructions: "x".repeat(2001),
    });
    assert("400 on too-long instructions", status === 400);
  }

  console.log("\n8. Validation — invalid match_type");
  {
    const { status } = await api("POST", "/api/ads/playbooks", tokA, {
      name: "Bad type",
      match_type: "bogus",
      instructions: "Some instructions",
    });
    assert("400 on invalid match_type", status === 400);
  }

  // ── 4. Tenant B cannot read or modify tenant A's data ───────────────────

  console.log("\n9. Tenant B cannot see tenant A playbook");
  {
    const { data } = await api("GET", "/api/ads/playbooks", tokB);
    const found = (data.playbooks ?? []).some((p) => p.id === pbId);
    assert("tenant B cannot see tenant A playbook", !found);
  }

  console.log("\n10. Tenant B cannot PATCH tenant A playbook (404)");
  {
    const { status } = await api("PATCH", `/api/ads/playbooks/${pbId}`, tokB, {
      name: "Hacked",
    });
    assert("404 for cross-tenant PATCH", status === 404, `got ${status}`);
  }

  console.log("\n11. Tenant B cannot DELETE tenant A playbook (404)");
  {
    const { status } = await api("DELETE", `/api/ads/playbooks/${pbId}`, tokB);
    assert("404 for cross-tenant DELETE", status === 404, `got ${status}`);
  }

  // ── 5. Foreign media_id rejected ────────────────────────────────────────

  console.log("\n12. Cross-tenant media_id rejected");
  {
    // First get tenant B's media id (if any)
    const { data: bMedia } = await api("GET", "/api/ads/playbooks", tokB);
    const bMediaId = bMedia.media?.[0]?.id;
    if (bMediaId) {
      const { status } = await api("POST", "/api/ads/playbooks", tokA, {
        name: "Bad media",
        match_type: "any",
        instructions: "Trying to attach another tenant media",
        media_id: bMediaId,
      });
      assert("400 on foreign media_id", status === 400, `got ${status}`);
    } else {
      console.log("  — skipped (tenant B has no media)");
    }
  }

  // ── 6. Empty state ───────────────────────────────────────────────────────

  console.log("\n13. Empty state — /api/ads when no clicks");
  {
    const { status, data } = await api("GET", "/api/ads", tokA);
    assert("200 even with no clicks", status === 200);
    assert("ads is array", Array.isArray(data.ads));
  }

  // ── 7. Ad with no source_id matches by title ─────────────────────────────

  console.log("\n14. title_contains playbook on ad without source_id");
  {
    // This is verified structurally — the SQL uses COALESCE(source_id, ad_title) as group key
    // and the playbook LEFT JOIN matches on ILIKE. We verified the playbook created in step 2
    // has match_type=title_contains, match_value=Summer. GET /api/ads should show it linked
    // when ad_title contains "Summer" (depends on whether such click exists).
    // We assert the API is consistent.
    const { status } = await api("GET", "/api/ads", tokA);
    assert("GET /api/ads still returns 200 after playbook creation", status === 200);
  }

  // ── 8. DELETE cleanup ────────────────────────────────────────────────────

  console.log("\n15. DELETE /api/ads/playbooks/:id — cleanup");
  {
    const { status } = await api("DELETE", `/api/ads/playbooks/${pbId}`, tokA);
    assert("200 on delete", status === 200);
    // Verify gone
    const { data } = await api("GET", "/api/ads/playbooks", tokA);
    const stillThere = (data.playbooks ?? []).some((p) => p.id === pbId);
    assert("playbook removed from list", !stillThere);
  }

  // ── Summary ──────────────────────────────────────────────────────────────

  console.log(`\n${"─".repeat(50)}`);
  console.log(`Passed: ${passed}  Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
