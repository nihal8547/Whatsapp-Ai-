import { requireOwner, errorResponse } from "@/lib/auth";
import { q, one } from "@/lib/db";

const MAX_ITEMS_PER_TENANT = 5000;

export async function GET(req: Request) {
  // Download sample CSV
  const sampleCsv = `category,name,aliases,description,price,unit,stock,available
Fruits,Fresh Red Apples,"apple, apples, seb",Crisp sweet organic apples,12.50,kg,100,true
Dairy,Organic Full Cream Milk,"milk, paal",Fresh farm milk 1L,8.00,litre,50,true
Bakery,Artisan Sourdough Bread,"bread, sourdough",Handmade crusty sourdough loaf,15.00,each,25,true
Beverages,Cold Pressed Orange Juice,"orange juice, juice",100% pure orange juice 500ml,14.00,each,0,false
`;

  return new Response(sampleCsv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="catalog_sample.csv"',
    },
  });
}

function parseCSV(text: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let curr = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (c === '"') {
      if (inQuotes && next === '"') {
        curr += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === "," && !inQuotes) {
      row.push(curr.trim());
      curr = "";
    } else if ((c === "\r" || c === "\n") && !inQuotes) {
      if (c === "\r" && next === "\n") i++;
      row.push(curr.trim());
      if (row.some((cell) => cell.length > 0)) {
        lines.push(row);
      }
      row = [];
      curr = "";
    } else {
      curr += c;
    }
  }

  if (curr.length > 0 || row.length > 0) {
    row.push(curr.trim());
    if (row.some((cell) => cell.length > 0)) {
      lines.push(row);
    }
  }

  return lines;
}

export async function POST(req: Request) {
  try {
    const { tenantId } = await requireOwner(req);

    const body = await req.json();
    const csvText = String(body.csvText || "").trim();
    const previewOnly = Boolean(body.preview);

    if (!csvText) {
      return Response.json({ ok: false, error: "missing_csv_data" }, { status: 400 });
    }

    const rows = parseCSV(csvText);
    if (rows.length < 2) {
      return Response.json(
        { ok: false, error: "empty_or_no_header", message: "CSV must contain a header and at least one row." },
        { status: 400 }
      );
    }

    const header = rows[0].map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
    const colMap: Record<string, number> = {};
    header.forEach((h, idx) => {
      if (h.includes("cat")) colMap["category"] = idx;
      else if (h === "name" || h.includes("item") || h.includes("title")) colMap["name"] = idx;
      else if (h.includes("alias")) colMap["aliases"] = idx;
      else if (h.includes("desc")) colMap["description"] = idx;
      else if (h.includes("price") || h.includes("rate") || h.includes("cost")) colMap["price"] = idx;
      else if (h.includes("unit")) colMap["unit"] = idx;
      else if (h.includes("stock") || h.includes("qty")) colMap["stock"] = idx;
      else if (h.includes("avail") || h.includes("sold")) colMap["available"] = idx;
    });

    if (colMap["name"] === undefined) {
      return Response.json(
        { ok: false, error: "missing_name_column", message: "Header must contain a 'name' column." },
        { status: 400 }
      );
    }

    // Check existing count
    const countRow = await one<{ cnt: number }>(
      `SELECT count(*)::int AS cnt FROM wa_catalog_items WHERE tenant_id = $1`,
      [tenantId]
    );
    let currentTotal = countRow?.cnt ?? 0;

    // Fetch existing categories
    const existingCats = await q<{ id: number; name: string }>(
      `SELECT id, name FROM wa_catalog_categories WHERE tenant_id = $1`,
      [tenantId]
    );
    const catMap = new Map<string, number>();
    existingCats.forEach((c) => catMap.set(c.name.toLowerCase().trim(), c.id));

    // Fetch existing item names to distinguish created vs updated
    const existingItems = await q<{ name: string }>(
      `SELECT name FROM wa_catalog_items WHERE tenant_id = $1`,
      [tenantId]
    );
    const existingNames = new Set(existingItems.map((i) => i.name.toLowerCase().trim()));

    const rejected: Array<{ row: number; name?: string; reason: string }> = [];
    const validRows: Array<{
      rowNum: number;
      isUpdate: boolean;
      name: string;
      categoryName: string;
      aliases: string[];
      description: string | null;
      price: number | null;
      unit: string;
      stockQty: number | null;
      trackStock: boolean;
      available: boolean;
    }> = [];

    for (let i = 1; i < rows.length; i++) {
      const rowNum = i + 1;
      const r = rows[i];
      const rawName = colMap["name"] !== undefined ? r[colMap["name"]] : "";
      const name = (rawName || "").trim();

      if (!name) {
        rejected.push({ row: rowNum, reason: "Item name is required and cannot be empty." });
        continue;
      }

      const isUpdate = existingNames.has(name.toLowerCase());
      if (!isUpdate && currentTotal >= MAX_ITEMS_PER_TENANT) {
        rejected.push({ row: rowNum, name, reason: `Exceeds maximum limit of ${MAX_ITEMS_PER_TENANT} items.` });
        continue;
      }

      const rawCat = colMap["category"] !== undefined ? r[colMap["category"]] : "";
      const categoryName = (rawCat || "").trim();

      const rawAliases = colMap["aliases"] !== undefined ? r[colMap["aliases"]] : "";
      const aliases = rawAliases
        ? rawAliases.split(",").map((a) => a.trim()).filter(Boolean)
        : [];

      const rawDesc = colMap["description"] !== undefined ? r[colMap["description"]] : "";
      const description = (rawDesc || "").trim() || null;

      const rawPrice = colMap["price"] !== undefined ? r[colMap["price"]] : "";
      let price: number | null = null;
      if (rawPrice !== undefined && rawPrice !== "") {
        const p = Number(rawPrice);
        if (isNaN(p) || p < 0) {
          rejected.push({ row: rowNum, name, reason: `Invalid price value: '${rawPrice}' must be a non-negative number.` });
          continue;
        }
        price = p;
      }

      const rawUnit = colMap["unit"] !== undefined ? r[colMap["unit"]] : "";
      const unit = (rawUnit || "").trim() || "each";

      const rawStock = colMap["stock"] !== undefined ? r[colMap["stock"]] : "";
      let stockQty: number | null = null;
      let trackStock = false;
      if (rawStock !== undefined && rawStock !== "") {
        const s = Number(rawStock);
        if (isNaN(s) || s < 0) {
          rejected.push({ row: rowNum, name, reason: `Invalid stock quantity: '${rawStock}' must be a non-negative number.` });
          continue;
        }
        stockQty = s;
        trackStock = true;
      }

      const rawAvail = colMap["available"] !== undefined ? r[colMap["available"]] : "";
      let available = true;
      if (rawAvail !== undefined && rawAvail !== "") {
        const low = rawAvail.toLowerCase().trim();
        if (low === "false" || low === "0" || low === "no" || low === "sold out" || low === "soldout") {
          available = false;
        }
      }

      validRows.push({
        rowNum,
        isUpdate,
        name,
        categoryName,
        aliases,
        description,
        price,
        unit,
        stockQty,
        trackStock,
        available,
      });

      if (!isUpdate) {
        currentTotal++;
        existingNames.add(name.toLowerCase());
      }
    }

    if (previewOnly) {
      return Response.json({
        ok: true,
        preview: true,
        totalRows: rows.length - 1,
        validCount: validRows.length,
        rejectedCount: rejected.length,
        validSample: validRows.slice(0, 10),
        rejected,
      });
    }

    // Apply import in database
    let createdCount = 0;
    let updatedCount = 0;

    for (const item of validRows) {
      // Find or create category
      let catId: number | null = null;
      if (item.categoryName) {
        const normCat = item.categoryName.toLowerCase();
        if (catMap.has(normCat)) {
          catId = catMap.get(normCat)!;
        } else {
          const newCat = await one<{ id: number }>(
            `INSERT INTO wa_catalog_categories (tenant_id, name)
             VALUES ($1, $2)
             ON CONFLICT (tenant_id, name) DO UPDATE SET active = true
             RETURNING id`,
            [tenantId, item.categoryName]
          );
          if (newCat) {
            catId = newCat.id;
            catMap.set(normCat, catId);
          }
        }
      }

      const upserted = await one(
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
           updated_at = now()
         RETURNING (xmax = 0) AS was_inserted`,
        [
          tenantId,
          catId,
          item.name,
          item.aliases,
          item.description,
          item.price,
          item.unit,
          item.trackStock,
          item.stockQty,
          item.available,
        ]
      );

      if (upserted?.was_inserted) {
        createdCount++;
      } else {
        updatedCount++;
      }
    }

    return Response.json({
      ok: true,
      created: createdCount,
      updated: updatedCount,
      rejected,
      message: `Import complete: ${createdCount} created, ${updatedCount} updated, ${rejected.length} rejected.`,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
