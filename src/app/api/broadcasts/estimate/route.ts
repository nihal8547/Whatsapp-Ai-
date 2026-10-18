import { requireOwner, errorResponse } from "@/lib/auth";
import { q, one } from "@/lib/db";
import { getEffectiveBroadcastCap, estimateCompletionTime } from "@/lib/broadcasts";

export async function GET(req: Request) {
  try {
    const { tenantId } = await requireOwner(req);
    const { searchParams } = new URL(req.url);
    const importId = searchParams.get("importId");

    let audienceCondition = "c.tenant_id = $1";
    const params: any[] = [tenantId];

    if (importId && !isNaN(Number(importId))) {
      params.push(`import:${Number(importId)}`);
      audienceCondition += ` AND $2 = ANY(c.tags)`;
    }

    // Get audience breakdown
    const countsRow = await one<{
      eligible: string | number;
      opted_out: string | number;
      unknown: string | number;
      total: string | number;
    }>(
      `SELECT
         COUNT(*) FILTER (WHERE c.consent_status = 'opted_in')  AS eligible,
         COUNT(*) FILTER (WHERE c.consent_status = 'opted_out') AS opted_out,
         COUNT(*) FILTER (WHERE c.consent_status = 'unknown' OR c.consent_status IS NULL) AS unknown,
         COUNT(*) AS total
       FROM wa_contacts c
       WHERE ${audienceCondition}`,
      params
    );

    const eligible = Number(countsRow?.eligible ?? 0);
    const optedOut = Number(countsRow?.opted_out ?? 0);
    const unknown = Number(countsRow?.unknown ?? 0);
    const total = Number(countsRow?.total ?? 0);

    // Get caps & warm-up stats
    const caps = await getEffectiveBroadcastCap(tenantId);

    // Check WhatsApp connection
    const instance = await one<{ status: string }>(
      `SELECT status FROM wa_instances WHERE tenant_id = $1`,
      [tenantId]
    );
    const whatsappConnected = instance?.status === "connected";

    // Check for active broadcast
    const activeBc = await one<{ id: number; status: string; name: string }>(
      `SELECT id, status, name FROM wa_broadcasts
        WHERE tenant_id = $1 AND status IN ('running', 'scheduled')
        LIMIT 1`,
      [tenantId]
    );

    // Get tenant business name
    const bot = await one<{ business_name: string; timezone: string }>(
      `SELECT business_name, timezone FROM wa_bot_settings WHERE tenant_id = $1`,
      [tenantId]
    );

    const estimateText = estimateCompletionTime(
      eligible,
      caps.effectiveDailyCap,
      caps.hourlyCap,
      caps.windowStart,
      caps.windowEnd
    );

    return Response.json({
      ok: true,
      eligible,
      optedOut,
      unknown,
      total,
      caps,
      estimateText,
      whatsappConnected,
      hasActiveBroadcast: Boolean(activeBc),
      activeBroadcast: activeBc ?? null,
      businessName: bot?.business_name || "My Business",
      timezone: bot?.timezone || "Asia/Qatar",
    });
  } catch (e) {
    return errorResponse(e);
  }
}
