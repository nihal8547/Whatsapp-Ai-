import { requireTenant, errorResponse } from "@/lib/auth";
import { n8n } from "@/lib/n8n";

export async function POST(req: Request, ctx: { params: Promise<{ phone: string }> }) {
  try {
    const { tenantId, session } = await requireTenant(req);
    const { phone } = await ctx.params;
    const { text } = await req.json();
    const body = String(text || "").trim();
    if (!body) return Response.json({ ok: false, error: "empty_message" }, { status: 400 });

    // n8n sends through Evolution and writes the message + memory row.
    const result = await n8n("send_message", {
      tenant_id: tenantId,
      phone: phone.replace(/[^0-9]/g, ""),
      text: body,
      staff_name: session.name,
      add_to_memory: true,
    });
    return Response.json({ ok: true, result });
  } catch (e) {
    return errorResponse(e);
  }
}
