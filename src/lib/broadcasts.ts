import { one } from "@/lib/db";

export type BroadcastSettings = {
  enabled: boolean;
  daily_cap: number;
  hourly_cap: number;
  window_start: string;
  window_end: string;
};

export const DEFAULT_BROADCAST_SETTINGS: BroadcastSettings = {
  enabled: true,
  daily_cap: 100,
  hourly_cap: 25,
  window_start: "09:00",
  window_end: "21:00",
};

/**
 * Calculates warm-up cap and effective daily cap:
 * Warm-up rule: 20 on the first sending day, plus 10 per earlier sending day.
 * Effective daily cap: min(tenant.daily_cap, platform.broadcast_daily_max, warm_up_cap)
 */
export async function getEffectiveBroadcastCap(tenantId: number): Promise<{
  effectiveDailyCap: number;
  warmUpCap: number;
  tenantDailyCap: number;
  platformDailyMax: number;
  earlierSendingDays: number;
  hourlyCap: number;
  enabled: boolean;
  windowStart: string;
  windowEnd: string;
}> {
  // 1. Get platform max
  const platform = await one<{ broadcast_daily_max: number }>(
    `SELECT COALESCE(broadcast_daily_max, 200) AS broadcast_daily_max FROM wa_platform_settings WHERE id = 1`
  );
  const platformDailyMax = Number(platform?.broadcast_daily_max ?? 200);

  // 2. Get tenant broadcast settings
  const botSettings = await one<{ broadcast_settings: any }>(
    `SELECT broadcast_settings FROM wa_bot_settings WHERE tenant_id = $1`,
    [tenantId]
  );
  const bs: BroadcastSettings = {
    ...DEFAULT_BROADCAST_SETTINGS,
    ...(botSettings?.broadcast_settings ?? {}),
  };

  // 3. Count earlier sending days (distinct calendar dates where at least 1 broadcast recipient was sent)
  const daysRow = await one<{ sending_days: string | number }>(
    `SELECT count(DISTINCT sent_at::date) AS sending_days
       FROM wa_broadcast_recipients
      WHERE tenant_id = $1 AND status = 'sent'`,
    [tenantId]
  );
  const earlierSendingDays = Number(daysRow?.sending_days ?? 0);

  // Warm-up cap: 20 on first sending day, +10 per earlier sending day
  const warmUpCap = 20 + 10 * earlierSendingDays;

  // Tenant daily cap cannot exceed platform max
  const tenantDailyCap = Math.min(Number(bs.daily_cap || 100), platformDailyMax);

  // Effective daily cap is the minimum of tenant daily cap, platform max, and warmup cap
  const effectiveDailyCap = Math.min(tenantDailyCap, platformDailyMax, warmUpCap);

  return {
    effectiveDailyCap,
    warmUpCap,
    tenantDailyCap,
    platformDailyMax,
    earlierSendingDays,
    hourlyCap: Math.min(Number(bs.hourly_cap || 25), 40),
    enabled: Boolean(bs.enabled),
    windowStart: bs.window_start || "09:00",
    windowEnd: bs.window_end || "21:00",
  };
}

/**
 * Calculates estimated completion time string based on eligible count, effective cap, and sending window.
 */
export function estimateCompletionTime(
  eligibleCount: number,
  effectiveDailyCap: number,
  hourlyCap: number,
  windowStart = "09:00",
  windowEnd = "21:00"
): string {
  if (eligibleCount <= 0) return "0 minutes";
  if (effectiveDailyCap <= 0) return "Unavailable (cap is 0)";

  const daysNeeded = Math.ceil(eligibleCount / effectiveDailyCap);
  if (daysNeeded > 1) {
    return `~${daysNeeded} days (at ${effectiveDailyCap} messages/day)`;
  }

  // If within 1 day, estimate hours based on hourly cap
  const hoursNeeded = Math.ceil(eligibleCount / Math.max(1, hourlyCap));
  if (hoursNeeded <= 1) {
    const mins = Math.max(5, Math.ceil((eligibleCount / Math.max(1, hourlyCap)) * 60));
    return `~${mins} minutes`;
  }
  return `~${hoursNeeded} hours today (within ${windowStart} - ${windowEnd})`;
}

/**
 * Renders sample preview of a broadcast template
 */
export function renderMessagePreview(
  template: string,
  sampleName = "Sarah",
  businessName = "Our Store"
): string {
  let rendered = template
    .replace(/\{name\}/gi, sampleName)
    .replace(/\{business\}/gi, businessName);

  // Append STOP note as required by WhatsApp compliance
  if (!rendered.toLowerCase().includes("stop")) {
    rendered += "\n\nReply STOP to unsubscribe.";
  }
  return rendered;
}
