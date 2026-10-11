import { requireTenant, errorResponse } from "@/lib/auth";
import { one } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { tenantId } = await requireTenant(req);

    const row = await one<{
      data: { topics?: Array<{ topic: string; count: number; example: string; suggestion: string }> };
      generated_at: string;
    }>(
      `SELECT data, to_char(generated_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS generated_at
         FROM wa_insights
        WHERE tenant_id = $1 AND kind = 'top_questions'`,
      [tenantId]
    );

    return Response.json({
      ok: true,
      insights: row
        ? {
            data: row.data ?? { topics: [] },
            generated_at: row.generated_at,
          }
        : null,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
