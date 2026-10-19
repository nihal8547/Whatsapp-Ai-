import { requireOwner, errorResponse } from "@/lib/auth";
import { q, one } from "@/lib/db";
import {
  parseAndValidateCsv,
  checkSensitiveColumn,
  guessColumnType,
  slugifyTableName,
  sanitizeFieldKey,
  MAX_KNOWLEDGE_TABLES,
} from "@/lib/csv-data";
import { normalizePhoneNumber } from "@/lib/contacts-import";

export async function POST(req: Request) {
  try {
    const { tenantId } = await requireOwner(req);
    const body = await req.json();

    const csvContent = String(body.csvContent ?? "");
    const kind = String(body.kind ?? "customers") as "customers" | "catalog" | "knowledge";
    const filename = String(body.filename ?? "data.csv");
    const countryPrefix = String(body.countryPrefix ?? "974").replace(/[^0-9]/g, "") || "974";

    const parsed = parseAndValidateCsv(csvContent);
    if (parsed.error) {
      return Response.json(
        { ok: false, error: parsed.error, rejectedRow: parsed.rejectedRow },
        { status: 400 }
      );
    }

    const { headers, rows, delimiter, totalRows } = parsed;

    // Check sensitive columns
    for (let cIdx = 0; cIdx < headers.length; cIdx++) {
      const header = headers[cIdx];
      const sampleVals = rows.slice(0, 50).map((r) => r[cIdx] ?? "");
      const sens = checkSensitiveColumn(header, sampleVals);
      if (sens.sensitive) {
        return Response.json(
          {
            ok: false,
            error: sens.reason || `Column '${header}' contains sensitive data which is not permitted.`,
          },
          { status: 400 }
        );
      }
    }

    // 1. Customers preview
    if (kind === "customers") {
      // Suggest phone and name column index
      const lowerHeaders = headers.map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
      let phoneColIdx = lowerHeaders.findIndex((h) =>
        ["phone", "mobile", "number", "whatsapp", "phonenumber", "mobilenumber", "cell"].includes(h)
      );
      if (phoneColIdx === -1) {
        // Fallback: check first column that looks like phone numbers
        phoneColIdx = 0;
      }

      let nameColIdx = lowerHeaders.findIndex((h) =>
        ["name", "fullname", "contactname", "customername", "clientname"].includes(h)
      );

      // Custom fields suggestions
      const customFieldSuggestions: Record<string, string> = {};
      headers.forEach((h, idx) => {
        if (idx !== phoneColIdx && idx !== nameColIdx) {
          customFieldSuggestions[String(idx)] = sanitizeFieldKey(h);
        }
      });

      // Analyze rows
      const seenPhones = new Set<string>();
      const rejectedRows: Array<{ row: number; phone?: string; reason: string }> = [];
      const validRows: Array<{
        rowNum: number;
        rawPhone: string;
        normalizedPhone: string;
        name: string;
        fields: Record<string, string>;
      }> = [];

      let duplicateCount = 0;

      for (let i = 0; i < rows.length; i++) {
        const rowNum = i + 2;
        const row = rows[i];
        const rawPhone = row[phoneColIdx] ?? "";
        const rawName = nameColIdx !== -1 ? (row[nameColIdx] ?? "") : "";

        const { phone: normalized, valid, reason } = normalizePhoneNumber(rawPhone, countryPrefix);
        if (!valid) {
          rejectedRows.push({ row: rowNum, phone: rawPhone, reason: reason || "Invalid phone number" });
          continue;
        }

        if (seenPhones.has(normalized)) {
          duplicateCount++;
          rejectedRows.push({ row: rowNum, phone: normalized, reason: "Duplicate phone number inside CSV" });
          continue;
        }

        seenPhones.add(normalized);

        const fields: Record<string, string> = {};
        Object.entries(customFieldSuggestions).forEach(([idxStr, key]) => {
          const colIdx = Number(idxStr);
          const val = row[colIdx];
          if (val !== undefined && val.trim().length > 0) {
            fields[key] = val.trim();
          }
        });

        validRows.push({
          rowNum,
          rawPhone,
          normalizedPhone: normalized,
          name: rawName.trim(),
          fields,
        });
      }

      // Check existing contacts in database
      const validPhones = validRows.map((r) => r.normalizedPhone);
      let alreadyExisting = 0;
      let alreadyOptedOut = 0;

      if (validPhones.length > 0) {
        const existingRows = await q<{ phone: string; consent_status: string }>(
          `SELECT phone, consent_status FROM wa_contacts WHERE tenant_id = $1 AND phone = ANY($2)`,
          [tenantId, validPhones]
        );
        const existingStatus = new Map(existingRows.map((r) => [r.phone, r.consent_status]));

        for (const v of validRows) {
          const status = existingStatus.get(v.normalizedPhone);
          if (status !== undefined) {
            alreadyExisting++;
            if (status === "opted_out") {
              alreadyOptedOut++;
            }
          }
        }
      }

      // Preview top 20
      const previewRows = rows.slice(0, 20).map((row, idx) => {
        const rowNum = idx + 2;
        const rawPhone = row[phoneColIdx] ?? "";
        const rawName = nameColIdx !== -1 ? (row[nameColIdx] ?? "") : "";
        const { phone: norm, valid, reason } = normalizePhoneNumber(rawPhone, countryPrefix);

        return {
          rowNum,
          rawPhone,
          normalizedPhone: norm,
          name: rawName,
          valid,
          reason,
          cells: row,
        };
      });

      return Response.json({
        ok: true,
        kind,
        headers,
        delimiter,
        totalRows,
        counts: {
          totalRows,
          validCount: validRows.length,
          rejectedCount: rejectedRows.length,
          duplicateCount,
          alreadyExisting,
          alreadyOptedOut,
        },
        detectedMapping: {
          phoneColumn: phoneColIdx,
          nameColumn: nameColIdx !== -1 ? nameColIdx : null,
          customFields: customFieldSuggestions,
        },
        rejectedSample: rejectedRows.slice(0, 20),
        previewRows,
      });
    }

    // 2. Catalog preview
    if (kind === "catalog") {
      const lowerHeaders = headers.map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
      const colMap: Record<string, number> = {};
      lowerHeaders.forEach((h, idx) => {
        if (h.includes("cat")) colMap["category"] = idx;
        else if (h === "name" || h.includes("item") || h.includes("title")) colMap["name"] = idx;
        else if (h.includes("alias")) colMap["aliases"] = idx;
        else if (h.includes("desc")) colMap["description"] = idx;
        else if (h.includes("price") || h.includes("rate") || h.includes("cost")) colMap["price"] = idx;
        else if (h.includes("unit")) colMap["unit"] = idx;
        else if (h.includes("stock") || h.includes("qty")) colMap["stock"] = idx;
        else if (h.includes("avail") || h.includes("sold")) colMap["available"] = idx;
      });

      const nameCol = colMap["name"] !== undefined ? colMap["name"] : 0;

      // Existing item names
      const existingItems = await q<{ name: string }>(
        `SELECT name FROM wa_catalog_items WHERE tenant_id = $1`,
        [tenantId]
      );
      const existingNames = new Set(existingItems.map((i) => i.name.toLowerCase().trim()));

      const rejectedRows: Array<{ row: number; name?: string; reason: string }> = [];
      let willCreate = 0;
      let willUpdate = 0;

      const seenNames = new Set<string>();

      for (let i = 0; i < rows.length; i++) {
        const rowNum = i + 2;
        const row = rows[i];
        const rawName = (row[nameCol] ?? "").trim();

        if (!rawName) {
          rejectedRows.push({ row: rowNum, reason: "Product name is required and cannot be empty." });
          continue;
        }

        const priceIdx = colMap["price"];
        if (priceIdx !== undefined && row[priceIdx]) {
          const p = Number(row[priceIdx].trim());
          if (isNaN(p) || p < 0) {
            rejectedRows.push({ row: rowNum, name: rawName, reason: `Invalid price: '${row[priceIdx]}'` });
            continue;
          }
        }

        if (seenNames.has(rawName.toLowerCase())) {
          willUpdate++;
        } else {
          seenNames.add(rawName.toLowerCase());
          if (existingNames.has(rawName.toLowerCase())) {
            willUpdate++;
          } else {
            willCreate++;
          }
        }
      }

      const previewRows = rows.slice(0, 20).map((row, idx) => ({
        rowNum: idx + 2,
        name: row[nameCol] || "—",
        cells: row,
      }));

      return Response.json({
        ok: true,
        kind,
        headers,
        delimiter,
        totalRows,
        counts: {
          totalRows,
          validCount: rows.length - rejectedRows.length,
          rejectedCount: rejectedRows.length,
          willCreate,
          willUpdate,
        },
        detectedMapping: colMap,
        rejectedSample: rejectedRows.slice(0, 20),
        previewRows,
      });
    }

    // 3. Knowledge table preview
    if (kind === "knowledge") {
      // Check max 20 tables limit
      const tableCount = await one<{ count: number }>(
        `SELECT count(*)::int AS count FROM wa_data_tables WHERE tenant_id = $1`,
        [tenantId]
      );
      const currentTables = tableCount?.count ?? 0;
      if (currentTables >= MAX_KNOWLEDGE_TABLES) {
        return Response.json(
          {
            ok: false,
            error: `Maximum limit of ${MAX_KNOWLEDGE_TABLES} knowledge tables reached for this workspace. Please delete an unused table before creating a new one.`,
          },
          { status: 400 }
        );
      }

      // Guess column types
      const columnsWithTypes = headers.map((header, idx) => {
        const sampleVals = rows.map((r) => r[idx] ?? "");
        const guessedType = guessColumnType(sampleVals);
        return {
          name: header,
          key: sanitizeFieldKey(header),
          type: guessedType,
        };
      });

      const suggestedSlug = slugifyTableName(filename.replace(/\.[^/.]+$/, ""));
      const suggestedTitle = filename
        .replace(/\.[^/.]+$/, "")
        .replace(/[_\-]+/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());

      const previewRows = rows.slice(0, 20).map((row, idx) => ({
        rowNum: idx + 2,
        cells: row,
      }));

      return Response.json({
        ok: true,
        kind,
        headers,
        delimiter,
        totalRows,
        columns: columnsWithTypes,
        suggestedName: suggestedSlug,
        suggestedTitle,
        counts: {
          totalRows,
          validCount: rows.length,
          rejectedCount: 0,
        },
        previewRows,
      });
    }

    return Response.json({ ok: false, error: "invalid_kind" }, { status: 400 });
  } catch (e) {
    return errorResponse(e);
  }
}
