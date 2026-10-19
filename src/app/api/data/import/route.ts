import { requireOwner, errorResponse } from "@/lib/auth";
import { tx } from "@/lib/db";
import {
  parseAndValidateCsv,
  checkSensitiveColumn,
  stripControlChars,
  sanitizeFieldKey,
  MAX_KNOWLEDGE_TABLES,
} from "@/lib/csv-data";
import { normalizePhoneNumber, isValidConsentSource } from "@/lib/contacts-import";

export async function POST(req: Request) {
  try {
    const { tenantId, session } = await requireOwner(req);
    const body = await req.json();

    const kind = String(body.kind ?? "") as "customers" | "catalog" | "knowledge";
    if (!["customers", "catalog", "knowledge"].includes(kind)) {
      return Response.json({ ok: false, error: "invalid_kind" }, { status: 400 });
    }

    const csvContent = String(body.csvContent ?? "");
    const filename = String(body.filename ?? `${kind}.csv`).trim();
    const countryPrefix = String(body.countryPrefix ?? "974").replace(/[^0-9]/g, "") || "974";

    // 1. Parse and validate CSV with server-side safety checks
    const parsed = parseAndValidateCsv(csvContent);
    if (parsed.error) {
      return Response.json(
        { ok: false, error: parsed.error, rejectedRow: parsed.rejectedRow },
        { status: 400 }
      );
    }

    const { headers, rows } = parsed;

    // 2. Reject sensitive columns server-side
    for (let cIdx = 0; cIdx < headers.length; cIdx++) {
      const header = headers[cIdx];
      const sampleVals = rows.slice(0, 50).map((r) => r[cIdx] ?? "");
      const sens = checkSensitiveColumn(header, sampleVals);
      if (sens.sensitive) {
        return Response.json(
          {
            ok: false,
            error: sens.reason || `Column '${header}' contains sensitive information which is not permitted.`,
          },
          { status: 400 }
        );
      }
    }

    // Process kind inside ONE transaction
    const result = await tx(async (client) => {
      let importedCount = 0;
      let rejectedCount = 0;
      let targetTableId: number | null = null;
      let columnMapJson: Record<string, any> = {};

      if (kind === "customers") {
        const phoneColIdx = Number(body.phoneColumn ?? 0);
        const nameColIdx = body.nameColumn !== null && body.nameColumn !== undefined ? Number(body.nameColumn) : -1;
        const customFieldMap = (body.customFields ?? {}) as Record<string, string>; // { "2": "company", "3": "city" }

        columnMapJson = {
          phoneColumn: phoneColIdx,
          nameColumn: nameColIdx,
          customFields: customFieldMap,
        };

        const isPromotional = body.customerMode === "promotional";
        let contactImportId: number | null = null;

        if (isPromotional) {
          const consentConfirmed = Boolean(body.consentConfirmed);
          if (!consentConfirmed) {
            throw new Error("Consent declaration must be confirmed for promotional imports.");
          }
          const consentSource = String(body.consentSource ?? "").trim();
          if (!isValidConsentSource(consentSource)) {
            throw new Error("Please select a valid consent source.");
          }
          const consentNote = String(body.consentNote ?? "").trim() || null;

          // Record wa_contact_imports row exactly like Broadcasts task
          const impRes = await client.query(
            `INSERT INTO wa_contact_imports (
               tenant_id, filename, total_rows, valid_rows, invalid_rows, duplicate_rows,
               consent_source, consent_note, attested_by, attested_at, created_at
             ) VALUES ($1, $2, $3, $4, 0, 0, $5, $6, $7, now(), now())
             RETURNING id`,
            [
              tenantId,
              filename,
              rows.length,
              rows.length,
              consentSource,
              consentNote,
              session.userId,
            ]
          );
          contactImportId = impRes.rows[0].id;
        }

        const importTag = contactImportId ? `import:${contactImportId}` : null;
        const seenPhones = new Set<string>();

        // Pre-fetch existing contacts
        const rawPhones = rows.map((r) => r[phoneColIdx] ?? "");
        const normalizedPhones = rawPhones
          .map((p) => normalizePhoneNumber(p, countryPrefix))
          .filter((res) => res.valid)
          .map((res) => res.phone);

        const existingMap = new Map<string, { consent_status: string; attributes: any; name: string | null }>();
        if (normalizedPhones.length > 0) {
          const existRes = await client.query(
            `SELECT phone, consent_status, COALESCE(attributes, '{}'::jsonb) AS attributes, name
               FROM wa_contacts
              WHERE tenant_id = $1 AND phone = ANY($2)`,
            [tenantId, normalizedPhones]
          );
          for (const row of existRes.rows) {
            existingMap.set(row.phone, row);
          }
        }

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const rawPhone = row[phoneColIdx] ?? "";
          const rawName = nameColIdx !== -1 && row[nameColIdx] ? stripControlChars(row[nameColIdx]).slice(0, 500) : "";

          const { phone: normalized, valid } = normalizePhoneNumber(rawPhone, countryPrefix);
          if (!valid || seenPhones.has(normalized)) {
            rejectedCount++;
            continue;
          }
          seenPhones.add(normalized);

          // Build attributes
          const attributes: Record<string, string> = {};
          for (const [colIdxStr, fieldKeyRaw] of Object.entries(customFieldMap)) {
            const colIdx = Number(colIdxStr);
            const val = row[colIdx];
            if (val !== undefined && val !== null) {
              const cleanedVal = stripControlChars(String(val)).slice(0, 500);
              if (cleanedVal.length > 0) {
                const key = sanitizeFieldKey(fieldKeyRaw);
                attributes[key] = cleanedVal;
              }
            }
          }

          const existing = existingMap.get(normalized);
          const attrJson = JSON.stringify(attributes);

          if (existing) {
            // Contact exists
            if (isPromotional) {
              if (existing.consent_status === "opted_out") {
                // NEVER set opted_in for someone who is opted_out!
                await client.query(
                  `UPDATE wa_contacts
                      SET attributes = COALESCE(attributes, '{}'::jsonb) || $3::jsonb,
                          tags = CASE WHEN $4 IS NOT NULL AND NOT ($4 = ANY(tags)) THEN array_append(tags, $4) ELSE tags END
                    WHERE tenant_id = $1 AND phone = $2`,
                  [tenantId, normalized, attrJson, importTag]
                );
              } else {
                // Update to opted_in
                await client.query(
                  `UPDATE wa_contacts
                      SET name = COALESCE(NULLIF($3, ''), name),
                          attributes = COALESCE(attributes, '{}'::jsonb) || $4::jsonb,
                          consent_status = 'opted_in',
                          consent_source = $5,
                          consent_at = now(),
                          tags = CASE WHEN $6 IS NOT NULL AND NOT ($6 = ANY(tags)) THEN array_append(tags, $6) ELSE tags END
                    WHERE tenant_id = $1 AND phone = $2`,
                  [
                    tenantId,
                    normalized,
                    rawName,
                    attrJson,
                    body.consentSource || "existing_customers",
                    importTag,
                  ]
                );
              }
            } else {
              // Assistant only: merge custom fields without changing consent status
              await client.query(
                `UPDATE wa_contacts
                    SET name = COALESCE(NULLIF($3, ''), name),
                        attributes = COALESCE(attributes, '{}'::jsonb) || $4::jsonb
                  WHERE tenant_id = $1 AND phone = $2`,
                [tenantId, normalized, rawName, attrJson]
              );
            }
          } else {
            // New contact: create with consent_status unknown (or opted_in if promotional)
            const consentStatus = isPromotional ? "opted_in" : "unknown";
            const consentSource = isPromotional ? String(body.consentSource || "existing_customers") : null;
            const consentAt = isPromotional ? new Date() : null;
            const initialTags = importTag ? [importTag] : [];

            await client.query(
              `INSERT INTO wa_contacts (
                 tenant_id, phone, name, attributes, consent_status, consent_source, consent_at, tags, created_at
               ) VALUES ($1, $2, NULLIF($3, ''), $4::jsonb, $5, $6, $7, $8, now())`,
              [
                tenantId,
                normalized,
                rawName,
                attrJson,
                consentStatus,
                consentSource,
                consentAt,
                initialTags,
              ]
            );
          }

          importedCount++;
        }
      } else if (kind === "catalog") {
        const colMap = (body.columnMap ?? {}) as Record<string, number>;
        columnMapJson = colMap;

        // Existing categories
        const existingCats = await client.query(
          `SELECT id, name FROM wa_catalog_categories WHERE tenant_id = $1`,
          [tenantId]
        );
        const catMap = new Map<string, number>();
        existingCats.rows.forEach((c: any) => catMap.set(c.name.toLowerCase().trim(), c.id));

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const nameCol = colMap["name"] !== undefined ? colMap["name"] : 0;
          const rawName = (row[nameCol] ?? "").trim();
          if (!rawName) {
            rejectedCount++;
            continue;
          }

          const catCol = colMap["category"];
          const rawCat = catCol !== undefined ? (row[catCol] ?? "").trim() : "";
          let catId: number | null = null;

          if (rawCat) {
            const normCat = rawCat.toLowerCase();
            if (catMap.has(normCat)) {
              catId = catMap.get(normCat)!;
            } else {
              const newCat = await client.query(
                `INSERT INTO wa_catalog_categories (tenant_id, name)
                 VALUES ($1, $2)
                 ON CONFLICT (tenant_id, name) DO UPDATE SET active = true
                 RETURNING id`,
                [tenantId, rawCat]
              );
              if (newCat.rows[0]) {
                catId = Number(newCat.rows[0].id);
                catMap.set(normCat, catId);
              }
            }
          }

          const aliasCol = colMap["aliases"];
          const rawAliases = aliasCol !== undefined ? row[aliasCol] : "";
          const aliases = rawAliases
            ? rawAliases.split(",").map((a: string) => stripControlChars(a.trim())).filter(Boolean)
            : [];

          const descCol = colMap["description"];
          const description = descCol !== undefined && row[descCol] ? stripControlChars(row[descCol]).slice(0, 500) : null;

          const priceCol = colMap["price"];
          let price: number | null = null;
          if (priceCol !== undefined && row[priceCol]) {
            const p = Number(row[priceCol].trim());
            if (!isNaN(p) && p >= 0) price = p;
          }

          const unitCol = colMap["unit"];
          const unit = unitCol !== undefined && row[unitCol] ? stripControlChars(row[unitCol]).slice(0, 50) : "each";

          const stockCol = colMap["stock"];
          let stockQty: number | null = null;
          let trackStock = false;
          if (stockCol !== undefined && row[stockCol]) {
            const s = Number(row[stockCol].trim());
            if (!isNaN(s) && s >= 0) {
              stockQty = s;
              trackStock = true;
            }
          }

          const availCol = colMap["available"];
          let available = true;
          if (availCol !== undefined && row[availCol]) {
            const av = row[availCol].trim().toLowerCase();
            if (av === "false" || av === "0" || av === "no" || av === "out_of_stock") {
              available = false;
            }
          }

          await client.query(
            `INSERT INTO wa_catalog_items (
               tenant_id, category_id, name, aliases, description,
               price, unit, track_stock, stock_qty, available, updated_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
             ON CONFLICT (tenant_id, name) DO UPDATE SET
               category_id = COALESCE(EXCLUDED.category_id, wa_catalog_items.category_id),
               aliases = EXCLUDED.aliases,
               description = COALESCE(EXCLUDED.description, wa_catalog_items.description),
               price = COALESCE(EXCLUDED.price, wa_catalog_items.price),
               unit = EXCLUDED.unit,
               track_stock = EXCLUDED.track_stock,
               stock_qty = COALESCE(EXCLUDED.stock_qty, wa_catalog_items.stock_qty),
               available = EXCLUDED.available,
               updated_at = now()`,
            [
              tenantId,
              catId,
              stripControlChars(rawName).slice(0, 200),
              aliases,
              description,
              price,
              unit,
              trackStock,
              stockQty,
              available,
            ]
          );

          importedCount++;
        }
      } else if (kind === "knowledge") {
        const tableId = body.tableId ? Number(body.tableId) : null;
        const mode = body.knowledgeMode === "append" ? "append" : "replace";

        let finalTableId: number;

        if (tableId) {
          // Check table ownership
          const existingTable = await client.query(
            `SELECT id, name, columns FROM wa_data_tables WHERE id = $1 AND tenant_id = $2`,
            [tableId, tenantId]
          );
          if (existingTable.rows.length === 0) {
            throw new Error("Target knowledge table not found.");
          }
          finalTableId = tableId;

          if (mode === "replace") {
            await client.query(
              `DELETE FROM wa_data_rows WHERE table_id = $1 AND tenant_id = $2`,
              [finalTableId, tenantId]
            );
          }
        } else {
          // Verify max 20 tables limit
          const countRes = await client.query(
            `SELECT count(*)::int AS count FROM wa_data_tables WHERE tenant_id = $1`,
            [tenantId]
          );
          if ((countRes.rows[0]?.count ?? 0) >= MAX_KNOWLEDGE_TABLES) {
            throw new Error(`Maximum limit of ${MAX_KNOWLEDGE_TABLES} knowledge tables reached.`);
          }

          const rawName = String(body.tableName ?? "").trim();
          const title = String(body.tableTitle ?? "").trim() || rawName;
          const description = String(body.tableDescription ?? "").trim();
          if (!description) {
            throw new Error("Description explaining 'When should the assistant use this?' is required.");
          }

          const columns = body.columns || headers.map((h) => ({ name: h, key: sanitizeFieldKey(h), type: "text" }));

          const newTable = await client.query(
            `INSERT INTO wa_data_tables (
               tenant_id, name, title, description, columns, row_count, active, created_at, updated_at
             ) VALUES ($1, $2, $3, $4, $5::jsonb, 0, true, now(), now())
             RETURNING id`,
            [tenantId, rawName, title, description, JSON.stringify(columns)]
          );
          finalTableId = newTable.rows[0].id;
        }

        targetTableId = finalTableId;

        // Insert rows into wa_data_rows
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const rowData: Record<string, any> = {};
          const searchTokens: string[] = [];

          for (let c = 0; c < headers.length; c++) {
            const h = headers[c];
            const val = row[c] !== undefined ? stripControlChars(row[c]).slice(0, 500) : "";
            rowData[h] = val;
            if (val.length > 0) {
              searchTokens.push(val.toLowerCase());
            }
          }

          const searchText = searchTokens.join(" ");

          await client.query(
            `INSERT INTO wa_data_rows (table_id, tenant_id, data, search_text)
             VALUES ($1, $2, $3::jsonb, $4)`,
            [finalTableId, tenantId, JSON.stringify(rowData), searchText]
          );

          importedCount++;
        }

        // Update row_count on table
        await client.query(
          `UPDATE wa_data_tables
              SET row_count = (SELECT count(*)::int FROM wa_data_rows WHERE table_id = $1 AND tenant_id = $2),
                  updated_at = now()
            WHERE id = $1 AND tenant_id = $2`,
          [finalTableId, tenantId]
        );
      }

      // Record wa_csv_uploads
      const uploadRes = await client.query(
        `INSERT INTO wa_csv_uploads (
           tenant_id, kind, filename, total_rows, imported_rows, rejected_rows,
           column_map, target_table_id, uploaded_by, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, now())
         RETURNING id`,
        [
          tenantId,
          kind,
          filename,
          rows.length,
          importedCount,
          rejectedCount,
          JSON.stringify(columnMapJson),
          targetTableId,
          session.userId,
        ]
      );

      return {
        uploadId: uploadRes.rows[0].id,
        kind,
        importedCount,
        rejectedCount,
        targetTableId,
      };
    });

    return Response.json({
      ok: true,
      ...result,
      message: `Successfully imported ${result.importedCount} rows (${result.rejectedCount} rejected).`,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
