export type NormalizedRow = {
  rawPhone: string;
  normalizedPhone: string;
  name: string;
  valid: boolean;
  reason?: string;
  isDuplicate?: boolean;
};

export const CONSENT_SOURCES = [
  { value: "customer_form", label: "Customer Form" },
  { value: "whatsapp_optin", label: "WhatsApp Opt-in" },
  { value: "in_store", label: "In-Store Signup" },
  { value: "website_signup", label: "Website Signup" },
  { value: "existing_customers", label: "Existing Customers" },
  { value: "other", label: "Other" },
] as const;

export type ConsentSourceValue = (typeof CONSENT_SOURCES)[number]["value"];

export function isValidConsentSource(s: unknown): s is ConsentSourceValue {
  return typeof s === "string" && CONSENT_SOURCES.some((src) => src.value === s);
}

/**
 * Normalises a phone number:
 * - Removes spaces, dashes, brackets, dots
 * - Removes leading + or 00
 * - 8-digit Qatar numbers starting with 3, 5, 6 or 7 get 974 prefixed
 * - Valid length: 8 to 15 pure digits
 */
export function normalizePhoneNumber(
  raw: string,
  countryPrefix = "974"
): { phone: string; valid: boolean; reason?: string } {
  if (!raw || typeof raw !== "string") {
    return { phone: "", valid: false, reason: "Phone number is empty" };
  }

  // Remove spaces, dashes, parentheses, dots
  let cleaned = raw.trim().replace(/[\s\-\(\)\.]/g, "");

  // Remove leading + or 00
  if (cleaned.startsWith("+")) {
    cleaned = cleaned.slice(1);
  } else if (cleaned.startsWith("00")) {
    cleaned = cleaned.slice(2);
  }

  if (!cleaned) {
    return { phone: "", valid: false, reason: "Phone number is empty" };
  }

  // Check if non-digits remain
  if (!/^\d+$/.test(cleaned)) {
    return { phone: cleaned, valid: false, reason: "Contains non-numeric characters" };
  }

  // 8-digit Qatar numbers starting with 3, 5, 6, 7 get country prefix (default 974)
  if (cleaned.length === 8 && /^[3567]/.test(cleaned)) {
    cleaned = `${countryPrefix}${cleaned}`;
  }

  if (cleaned.length < 8) {
    return { phone: cleaned, valid: false, reason: "Too short (minimum 8 digits)" };
  }

  if (cleaned.length > 15) {
    return { phone: cleaned, valid: false, reason: "Too long (maximum 15 digits)" };
  }

  return { phone: cleaned, valid: true };
}

/**
 * Parses a simple or quoted CSV line
 */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Parses CSV content into parsed rows with header detection.
 * Max 5,000 rows, max 2MB.
 */
export function parseContactsCsv(
  csvText: string,
  countryPrefix = "974"
): {
  rows: NormalizedRow[];
  totalRows: number;
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
  error?: string;
} {
  if (!csvText || typeof csvText !== "string") {
    return { rows: [], totalRows: 0, validCount: 0, invalidCount: 0, duplicateCount: 0, error: "CSV file is empty" };
  }

  // Check size limit: 2MB ~ 2,097,152 bytes (UTF-8 length check)
  if (new TextEncoder().encode(csvText).length > 2 * 1024 * 1024) {
    return { rows: [], totalRows: 0, validCount: 0, invalidCount: 0, duplicateCount: 0, error: "File exceeds 2 MB limit" };
  }

  // Strip BOM if present
  let cleanText = csvText;
  if (cleanText.charCodeAt(0) === 0xfeff) {
    cleanText = cleanText.slice(1);
  }

  const rawLines = cleanText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (rawLines.length === 0) {
    return { rows: [], totalRows: 0, validCount: 0, invalidCount: 0, duplicateCount: 0, error: "CSV has no rows" };
  }

  // Check row limit (max 5,000 rows excluding header)
  if (rawLines.length - 1 > 5000) {
    return {
      rows: [],
      totalRows: rawLines.length - 1,
      validCount: 0,
      invalidCount: 0,
      duplicateCount: 0,
      error: "CSV exceeds 5,000 rows limit (max 5,000 allowed)",
    };
  }

  const headerCells = parseCsvLine(rawLines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
  let phoneColIdx = headerCells.findIndex((h) => ["phone", "mobile", "number", "whatsapp"].includes(h));
  let nameColIdx = headerCells.findIndex((h) => ["name", "fullname", "contactname", "customername"].includes(h));

  if (phoneColIdx === -1) {
    // If no header matched, check if first line looks like header or data
    return {
      rows: [],
      totalRows: 0,
      validCount: 0,
      invalidCount: 0,
      duplicateCount: 0,
      error: "Missing required phone column. Header must include 'phone', 'mobile', 'number', or 'whatsapp'",
    };
  }

  const seenInFile = new Set<string>();
  const parsedRows: NormalizedRow[] = [];
  let validCount = 0;
  let invalidCount = 0;
  let duplicateCount = 0;

  for (let i = 1; i < rawLines.length; i++) {
    const cells = parseCsvLine(rawLines[i]);
    const rawPhone = cells[phoneColIdx] ?? "";
    const rawName = nameColIdx !== -1 ? (cells[nameColIdx] ?? "") : "";

    const { phone: normalized, valid, reason } = normalizePhoneNumber(rawPhone, countryPrefix);

    if (!valid) {
      invalidCount++;
      parsedRows.push({
        rawPhone,
        normalizedPhone: normalized,
        name: rawName,
        valid: false,
        reason,
        isDuplicate: false,
      });
      continue;
    }

    if (seenInFile.has(normalized)) {
      duplicateCount++;
      parsedRows.push({
        rawPhone,
        normalizedPhone: normalized,
        name: rawName,
        valid: false,
        reason: "Duplicate number inside CSV",
        isDuplicate: true,
      });
      continue;
    }

    seenInFile.add(normalized);
    validCount++;
    parsedRows.push({
      rawPhone,
      normalizedPhone: normalized,
      name: rawName,
      valid: true,
      isDuplicate: false,
    });
  }

  return {
    rows: parsedRows,
    totalRows: rawLines.length - 1,
    validCount,
    invalidCount,
    duplicateCount,
  };
}
