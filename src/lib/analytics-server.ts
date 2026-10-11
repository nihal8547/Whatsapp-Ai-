import { one } from "./db";

export async function getTenantToday(tenantId: number): Promise<string> {
  const row = await one<{ today: string }>(
    `WITH tz AS (
      SELECT COALESCE(timezone, 'Asia/Qatar') AS name FROM wa_bot_settings WHERE tenant_id = $1
      UNION ALL SELECT 'Asia/Qatar' LIMIT 1
    )
    SELECT ((CURRENT_TIMESTAMP AT TIME ZONE (SELECT name FROM tz))::date)::text AS today`,
    [tenantId]
  );
  return row?.today || new Date().toISOString().slice(0, 10);
}
