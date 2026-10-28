import { requireOwner, errorResponse } from "@/lib/auth";
import { one } from "@/lib/db";
import crypto from "crypto";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { tenantId } = await requireOwner(req);
    const { id } = await ctx.params;
    const webhookId = Number(id);

    const hook = await one(
      `SELECT id, url, secret, events, active FROM wa_tenant_webhooks WHERE id = $1 AND tenant_id = $2`,
      [webhookId, tenantId]
    );

    if (!hook) {
      return Response.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    const samplePayload = {
      event: "message.received",
      timestamp: new Date().toISOString(),
      tenant_id: tenantId,
      data: {
        message_id: "test_" + crypto.randomBytes(4).toString("hex"),
        phone: "+97455550000",
        sender_name: "Test User",
        content: "This is a test webhook payload from the Webbea Dashboard.",
        type: "text",
      },
    };

    const signature = crypto
      .createHmac("sha256", hook.secret || "")
      .update(JSON.stringify(samplePayload))
      .digest("hex");

    let success = false;
    let statusCode = 0;
    let errorMessage = "";

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(hook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Signature": signature,
          "User-Agent": "Webbea-Webhook-Tester/1.0",
        },
        body: JSON.stringify(samplePayload),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      statusCode = res.status;
      success = res.ok;
    } catch (err: any) {
      errorMessage = err?.name === "AbortError" ? "Request timed out after 8s" : (err?.message || "Connection failed");
    }

    if (success) {
      await one(
        `UPDATE wa_tenant_webhooks
            SET last_triggered_at = now(),
                fail_count = 0
          WHERE id = $1`,
        [webhookId]
      );
    } else {
      await one(
        `UPDATE wa_tenant_webhooks
            SET last_triggered_at = now(),
                fail_count = fail_count + 1
          WHERE id = $1`,
        [webhookId]
      );
    }

    return Response.json({
      ok: true,
      delivered: success,
      statusCode,
      error: errorMessage || (success ? null : `Target returned HTTP ${statusCode}`),
    });
  } catch (e) {
    return errorResponse(e);
  }
}
