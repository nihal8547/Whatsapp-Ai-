import { requireOwner, errorResponse } from "@/lib/auth";
import { q } from "@/lib/db";
import { parseContactsCsv } from "@/lib/contacts-import";

export async function POST(req: Request) {
  try {
    const { tenantId } = await requireOwner(req);
    const body = await req.json();
    const csvContent = String(body.csvContent ?? "");
    const countryPrefix = String(body.countryPrefix ?? "974").replace(/[^0-9]/g, "") || "974";

    const parsed = parseContactsCsv(csvContent, countryPrefix);
    if (parsed.error) {
      return Response.json({ ok: false, error: parsed.error }, { status: 400 });
    }

    // Extract all valid normalized phone numbers to check against DB
    const validPhones = parsed.rows
      .filter((r) => r.valid && !r.isDuplicate)
      .map((r) => r.normalizedPhone);

    let existingMap = new Map<string, { consent_status: string }>();
    if (validPhones.length > 0) {
      const existing = await q<{ phone: string; consent_status: string }>(
        `SELECT phone, consent_status FROM wa_contacts WHERE tenant_id = $1 AND phone = ANY($2)`,
        [tenantId, validPhones]
      );
      for (const row of existing) {
        existingMap.set(row.phone, row);
      }
    }

    let alreadyExistingCount = 0;
    let alreadyOptedOutCount = 0;

    // Enhance rows with DB existence status
    const annotatedRows = parsed.rows.map((row) => {
      if (!row.valid) return row;
      const dbRecord = existingMap.get(row.normalizedPhone);
      if (dbRecord) {
        alreadyExistingCount++;
        if (dbRecord.consent_status === "opted_out") {
          alreadyOptedOutCount++;
          return {
            ...row,
            isOptedOut: true,
            statusNote: "Already opted out (will be skipped)",
          };
        }
        return {
          ...row,
          isExisting: true,
          statusNote: "Already existing",
        };
      }
      return {
        ...row,
        isNew: true,
        statusNote: "New contact",
      };
    });

    return Response.json({
      ok: true,
      counts: {
        totalRows: parsed.totalRows,
        validCount: parsed.validCount,
        invalidCount: parsed.invalidCount,
        duplicateCount: parsed.duplicateCount,
        alreadyExisting: alreadyExistingCount,
        alreadyOptedOut: alreadyOptedOutCount,
      },
      previewRows: annotatedRows.slice(0, 20),
    });
  } catch (e) {
    return errorResponse(e);
  }
}
