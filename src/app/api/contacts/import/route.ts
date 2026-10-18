import { requireOwner, errorResponse } from "@/lib/auth";
import { tx } from "@/lib/db";
import { parseContactsCsv, isValidConsentSource } from "@/lib/contacts-import";

export async function POST(req: Request) {
  try {
    const { tenantId, session } = await requireOwner(req);
    const body = await req.json();

    const consentConfirmed = Boolean(body.consentConfirmed);
    if (!consentConfirmed) {
      return Response.json(
        { ok: false, error: "consent_confirmation_required", message: "Consent declaration must be confirmed before importing." },
        { status: 400 }
      );
    }

    const consentSource = String(body.consentSource ?? "").trim();
    if (!isValidConsentSource(consentSource)) {
      return Response.json(
        { ok: false, error: "invalid_consent_source", message: "Please select a valid consent source." },
        { status: 400 }
      );
    }

    const consentNote = String(body.consentNote ?? "").trim() || null;
    const filename = String(body.filename ?? "contacts.csv").trim();
    const csvContent = String(body.csvContent ?? "");
    const countryPrefix = String(body.countryPrefix ?? "974").replace(/[^0-9]/g, "") || "974";

    const parsed = parseContactsCsv(csvContent, countryPrefix);
    if (parsed.error) {
      return Response.json({ ok: false, error: parsed.error }, { status: 400 });
    }

    const validRows = parsed.rows.filter((r) => r.valid && !r.isDuplicate);

    // Execute in ONE transaction
    const result = await tx(async (client) => {
      // 1. Insert wa_contact_imports row
      const importRes = await client.query(
        `INSERT INTO wa_contact_imports (
           tenant_id, filename, total_rows, valid_rows, invalid_rows, duplicate_rows,
           consent_source, consent_note, attested_by, attested_at, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), now())
         RETURNING id`,
        [
          tenantId,
          filename,
          parsed.totalRows,
          parsed.validCount,
          parsed.invalidCount,
          parsed.duplicateCount,
          consentSource,
          consentNote,
          session.userId,
        ]
      );
      const importId: number = importRes.rows[0].id;
      const importTag = `import:${importId}`;

      let createdCount = 0;
      let updatedCount = 0;
      let skippedOptedOut = 0;

      if (validRows.length > 0) {
        // Fetch existing records for this tenant matching valid numbers
        const validPhones = validRows.map((r) => r.normalizedPhone);
        const existingRes = await client.query(
          `SELECT phone, name, consent_status, tags FROM wa_contacts
            WHERE tenant_id = $1 AND phone = ANY($2)`,
          [tenantId, validPhones]
        );

        const existingMap = new Map<string, { name: string | null; consent_status: string; tags: string[] }>();
        for (const row of existingRes.rows) {
          existingMap.set(row.phone, row);
        }

        for (const row of validRows) {
          const existing = existingMap.get(row.normalizedPhone);

          if (existing) {
            // If already opted out: NEVER re-opt-in!
            if (existing.consent_status === "opted_out") {
              skippedOptedOut++;
              // Keep opted_out status, append import tag if not present
              await client.query(
                `UPDATE wa_contacts
                    SET tags = array_append(tags, $3)
                  WHERE tenant_id = $1 AND phone = $2 AND NOT ($3 = ANY(tags))`,
                [tenantId, row.normalizedPhone, importTag]
              );
            } else {
              // Existing and not opted_out: keep its name (COALESCE) and set opted_in
              updatedCount++;
              await client.query(
                `UPDATE wa_contacts
                    SET name = COALESCE(NULLIF($3, ''), name),
                        consent_status = 'opted_in',
                        consent_source = $4,
                        consent_at = now(),
                        tags = CASE WHEN $5 = ANY(tags) THEN tags ELSE array_append(tags, $5) END
                  WHERE tenant_id = $1 AND phone = $2`,
                [
                  tenantId,
                  row.normalizedPhone,
                  row.name ? row.name.trim() : "",
                  consentSource,
                  importTag,
                ]
              );
            }
          } else {
            // New contact: insert with opted_in
            createdCount++;
            await client.query(
              `INSERT INTO wa_contacts (
                 tenant_id, phone, name, consent_status, consent_source, consent_at, tags, created_at
               ) VALUES ($1, $2, NULLIF($3, ''), 'opted_in', $4, now(), ARRAY[$5], now())`,
              [
                tenantId,
                row.normalizedPhone,
                row.name ? row.name.trim() : "",
                consentSource,
                importTag,
              ]
            );
          }
        }
      }

      return {
        importId,
        created: createdCount,
        updated: updatedCount,
        skippedOptedOut,
        skipped: skippedOptedOut + parsed.invalidCount + parsed.duplicateCount,
        invalid: parsed.invalidCount,
        duplicates: parsed.duplicateCount,
      };
    });

    return Response.json({
      ok: true,
      report: result,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
