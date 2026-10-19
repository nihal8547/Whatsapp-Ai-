/**
 * Utilities for CSV parsing, validation, delimiter detection,
 * sensitive column filtering, and formula neutralization.
 */

export const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
export const MAX_ROW_LIMIT = 5000;
export const MAX_COLUMN_LIMIT = 20;
export const MAX_CELL_LENGTH = 500;
export const MAX_KNOWLEDGE_TABLES = 20;

export const SENSITIVE_KEYWORDS = [
  "password",
  "otp",
  "pin",
  "card",
  "cvv",
  "iban",
  "passport",
  "national id",
  "national_id",
  "nationalid",
  "secret",
];

/**
 * Auto-detects delimiter: comma (,), semicolon (;), or tab (\t).
 */
export function detectDelimiter(text: string): "," | ";" | "\t" {
  let clean = text;
  if (clean.charCodeAt(0) === 0xfeff) {
    clean = clean.slice(1);
  }

  // Sample the first 10 non-empty lines
  const sampleLines = clean
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .slice(0, 10);

  if (sampleLines.length === 0) return ",";

  const delimiters: Array<"," | ";" | "\t"> = [",", ";", "\t"];
  let bestDelimiter: "," | ";" | "\t" = ",";
  let maxScore = -1;

  for (const delim of delimiters) {
    let totalCount = 0;
    let countsAcrossLines: number[] = [];

    for (const line of sampleLines) {
      let count = 0;
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
          inQuotes = !inQuotes;
        } else if (c === delim && !inQuotes) {
          count++;
        }
      }
      totalCount += count;
      countsAcrossLines.push(count);
    }

    // Consistency score: prefer delimiters that appear consistently on each line
    const avg = totalCount / sampleLines.length;
    const variance =
      countsAcrossLines.reduce((acc, c) => acc + Math.pow(c - avg, 2), 0) /
      sampleLines.length;
    // Score combines presence and consistency
    const score = totalCount > 0 ? (totalCount * 10) / (1 + variance) : 0;

    if (score > maxScore && totalCount > 0) {
      maxScore = score;
      bestDelimiter = delim;
    }
  }

  return bestDelimiter;
}

/**
 * Strips ASCII control characters from strings.
 * Keeps standard spaces, tabs, and newlines if desired, or strips all non-printable.
 */
export function stripControlChars(str: string): string {
  if (!str || typeof str !== "string") return "";
  // Strip null bytes and non-printable control chars: 0x00-0x08, 0x0B, 0x0C, 0x0E-0x1F, 0x7F
  return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim();
}

/**
 * Checks if a column header or any values match sensitive keywords or patterns.
 */
export function checkSensitiveColumn(
  header: string,
  sampleValues: string[] = []
): { sensitive: boolean; reason?: string } {
  const normHeader = header.toLowerCase().replace(/[\s\-_]/g, "");

  for (const kw of SENSITIVE_KEYWORDS) {
    const normKw = kw.replace(/[\s\-_]/g, "");
    if (normHeader.includes(normKw)) {
      return {
        sensitive: true,
        reason: `Column '${header}' contains sensitive information ('${kw}') which is not permitted.`,
      };
    }
  }

  // Value inspection: e.g. check for credit card (13-19 digits) or IBAN format
  for (const rawVal of sampleValues.slice(0, 50)) {
    const val = rawVal.trim();
    if (!val) continue;

    // Credit card number (13-19 consecutive digits or spaced digits)
    const digitsOnly = val.replace(/[\s\-]/g, "");
    if (/^\d{13,19}$/.test(digitsOnly) && /^(?:4|5|6|3[47]|35|60|65)/.test(digitsOnly)) {
      return {
        sensitive: true,
        reason: `Column '${header}' appears to contain sensitive payment card numbers.`,
      };
    }

    // IBAN check (2 letters + 2 digits + up to 30 alphanumeric)
    if (/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/i.test(digitsOnly)) {
      return {
        sensitive: true,
        reason: `Column '${header}' appears to contain sensitive IBAN account numbers.`,
      };
    }
  }

  return { sensitive: false };
}

/**
 * Guesses column type: text, number, or boolean.
 */
export function guessColumnType(values: string[]): "text" | "number" | "boolean" {
  const nonEmpties = values.map((v) => v.trim()).filter((v) => v.length > 0);
  if (nonEmpties.length === 0) return "text";

  const isBool = nonEmpties.every((v) => {
    const l = v.toLowerCase();
    return l === "true" || l === "false" || l === "yes" || l === "no" || l === "1" || l === "0";
  });
  if (isBool) return "boolean";

  const isNum = nonEmpties.every((v) => {
    // Strip comma separators if any (e.g. 1,000) or check standard float
    const clean = v.replace(/,/g, "");
    return !isNaN(Number(clean)) && clean.length > 0;
  });
  if (isNum) return "number";

  return "text";
}

/**
 * Sanitizes machine slug for knowledge table: ^[a-z][a-z0-9_]{1,40}$
 */
export function slugifyTableName(input: string): string {
  let slug = (input || "table")
    .toLowerCase()
    .replace(/\.csv$/i, "")
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");

  // Must start with [a-z]
  if (!/^[a-z]/.test(slug)) {
    slug = `t_${slug}`;
  }

  if (slug.length < 2) {
    slug = `${slug}_table`;
  }

  if (slug.length > 40) {
    slug = slug.slice(0, 40).replace(/_+$/, "");
  }

  // Ensure pattern ^[a-z][a-z0-9_]{1,40}$
  if (!/^[a-z][a-z0-9_]{1,40}$/.test(slug)) {
    slug = "knowledge_data";
  }

  return slug;
}

/**
 * Sanitizes custom field key: lowercase letters, digits, underscore, max 30 chars
 */
export function sanitizeFieldKey(input: string): string {
  let key = (input || "field")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!key) key = "custom_field";
  if (!/^[a-z0-9_]/.test(key)) key = `field_${key}`;
  if (key.length > 30) key = key.slice(0, 30).replace(/_+$/, "");

  return key;
}

/**
 * Formula neutralization for CSV exports:
 * If cell starts with = + - @, prefix with ' (single quote)
 */
export function neutralizeCell(val: any): string {
  if (val === null || val === undefined) return "";
  let str = String(val);

  // If starts with =, +, -, @, neutralise to prevent CSV formula injection
  if (/^[=\+\-@]/.test(str)) {
    str = `'${str}`;
  }

  // Escape CSV quotes and wrap if needed
  if (/[",\n\r\t;]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export interface ParsedCsvResult {
  headers: string[];
  rows: string[][];
  delimiter: string;
  totalRows: number;
  error?: string;
  rejectedRow?: { row: number; reason: string };
}

/**
 * Full CSV parsing with auto-delimiter detection and all safety limit checks:
 * - max 2 MB
 * - max 20 columns
 * - max 5,000 rows
 * - each cell max 500 chars (rejected with row number)
 * - control characters stripped
 */
export function parseAndValidateCsv(
  csvText: string,
  customDelimiter?: string
): ParsedCsvResult {
  if (!csvText || typeof csvText !== "string") {
    return {
      headers: [],
      rows: [],
      delimiter: ",",
      totalRows: 0,
      error: "CSV file is empty.",
    };
  }

  // Check 2 MB size limit
  const byteLength = new TextEncoder().encode(csvText).length;
  if (byteLength > MAX_FILE_SIZE_BYTES) {
    return {
      headers: [],
      rows: [],
      delimiter: ",",
      totalRows: 0,
      error: `File exceeds 2 MB limit (size: ${(byteLength / (1024 * 1024)).toFixed(2)} MB).`,
    };
  }

  // Strip BOM if present
  let cleanText = csvText;
  if (cleanText.charCodeAt(0) === 0xfeff) {
    cleanText = cleanText.slice(1);
  }

  const delimiter = customDelimiter || detectDelimiter(cleanText);

  // Parse lines considering quotes and multi-line values
  const lines: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const c = cleanText[i];
    const next = cleanText[i + 1];

    if (c === '"') {
      if (inQuotes && next === '"') {
        currentCell += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === delimiter && !inQuotes) {
      currentRow.push(currentCell);
      currentCell = "";
    } else if ((c === "\r" || c === "\n") && !inQuotes) {
      if (c === "\r" && next === "\n") i++;
      currentRow.push(currentCell);
      currentCell = "";
      // Only keep rows that have at least one non-whitespace character
      if (currentRow.some((cell) => cell.trim().length > 0)) {
        lines.push(currentRow);
      }
      currentRow = [];
    } else {
      currentCell += c;
    }
  }

  // Flush remaining
  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    if (currentRow.some((cell) => cell.trim().length > 0)) {
      lines.push(currentRow);
    }
  }

  if (lines.length === 0) {
    return {
      headers: [],
      rows: [],
      delimiter,
      totalRows: 0,
      error: "CSV file has no data rows.",
    };
  }

  const rawHeaders = lines[0].map((h) => stripControlChars(h));
  if (rawHeaders.length > MAX_COLUMN_LIMIT) {
    return {
      headers: rawHeaders,
      rows: [],
      delimiter,
      totalRows: lines.length - 1,
      error: `CSV exceeds maximum limit of ${MAX_COLUMN_LIMIT} columns (found ${rawHeaders.length}).`,
    };
  }

  // Clean headers (ensure unique and non-empty)
  const headers = rawHeaders.map((h, idx) => h || `column_${idx + 1}`);

  const dataRows = lines.slice(1);

  if (dataRows.length > MAX_ROW_LIMIT) {
    return {
      headers,
      rows: [],
      delimiter,
      totalRows: dataRows.length,
      error: `CSV exceeds ${MAX_ROW_LIMIT.toLocaleString()} rows limit (found ${dataRows.length.toLocaleString()} rows).`,
    };
  }

  // Validate cell lengths and strip control characters
  const sanitizedRows: string[][] = [];

  for (let rIdx = 0; rIdx < dataRows.length; rIdx++) {
    const rowNum = rIdx + 2; // 1-based, accounting for header
    const row = dataRows[rIdx];
    const sanitizedRow: string[] = [];

    for (let cIdx = 0; cIdx < headers.length; cIdx++) {
      const cell = row[cIdx] ?? "";
      if (cell.length > MAX_CELL_LENGTH) {
        const colName = headers[cIdx] || `Column ${cIdx + 1}`;
        return {
          headers,
          rows: [],
          delimiter,
          totalRows: dataRows.length,
          error: `Row ${rowNum}: Cell in column '${colName}' exceeds ${MAX_CELL_LENGTH} characters limit (got ${cell.length}).`,
          rejectedRow: {
            row: rowNum,
            reason: `Cell in column '${colName}' exceeds ${MAX_CELL_LENGTH} characters limit (got ${cell.length}).`,
          },
        };
      }
      sanitizedRow.push(stripControlChars(cell));
    }
    sanitizedRows.push(sanitizedRow);
  }

  return {
    headers,
    rows: sanitizedRows,
    delimiter,
    totalRows: sanitizedRows.length,
  };
}
