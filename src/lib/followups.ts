export const INTENT_VALUES = [
  "unknown",
  "enquiry",
  "job_seeker",
  "support",
  "customer",
  "other",
] as const;

export type ContactIntent = (typeof INTENT_VALUES)[number];

export const STAGE_VALUES = [
  "none",
  "enquiry",
  "quoted",
  "negotiating",
  "booked",
  "lost",
] as const;

export type LeadStage = (typeof STAGE_VALUES)[number];

export const ENQUIRY_ALLOWED_VARS = ["name", "topic"] as const;
export const QUOTED_ALLOWED_VARS = ["name", "topic", "quote"] as const;

export const INTENT_CONFIG: Record<
  ContactIntent,
  { label: string; tone: "good" | "bad" | "warn" | "neutral"; bg: string; text: string; border: string }
> = {
  unknown: {
    label: "Unknown",
    tone: "neutral",
    bg: "bg-slate-100 dark:bg-slate-800",
    text: "text-slate-700 dark:text-slate-300",
    border: "border-slate-200 dark:border-slate-700",
  },
  enquiry: {
    label: "Enquiry",
    tone: "good",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-200 dark:border-emerald-800",
  },
  job_seeker: {
    label: "Job seeker",
    tone: "neutral",
    bg: "bg-purple-50 dark:bg-purple-950/40",
    text: "text-purple-700 dark:text-purple-300",
    border: "border-purple-200 dark:border-purple-800",
  },
  support: {
    label: "Support",
    tone: "warn",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-800 dark:text-amber-300",
    border: "border-amber-200 dark:border-amber-800",
  },
  customer: {
    label: "Customer",
    tone: "good",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    text: "text-blue-700 dark:text-blue-300",
    border: "border-blue-200 dark:border-blue-800",
  },
  other: {
    label: "Other",
    tone: "neutral",
    bg: "bg-zinc-100 dark:bg-zinc-800",
    text: "text-zinc-700 dark:text-zinc-300",
    border: "border-zinc-200 dark:border-zinc-700",
  },
};

export const STAGE_CONFIG: Record<
  LeadStage,
  { label: string; tone: "good" | "bad" | "warn" | "neutral"; bg: string; text: string; border: string }
> = {
  none: {
    label: "No stage",
    tone: "neutral",
    bg: "bg-slate-100 dark:bg-slate-800",
    text: "text-slate-600 dark:text-slate-400",
    border: "border-slate-200 dark:border-slate-700",
  },
  enquiry: {
    label: "Enquiry",
    tone: "neutral",
    bg: "bg-sky-50 dark:bg-sky-950/40",
    text: "text-sky-700 dark:text-sky-300",
    border: "border-sky-200 dark:border-sky-800",
  },
  quoted: {
    label: "Quoted",
    tone: "warn",
    bg: "bg-indigo-50 dark:bg-indigo-950/40",
    text: "text-indigo-700 dark:text-indigo-300",
    border: "border-indigo-200 dark:border-indigo-800",
  },
  negotiating: {
    label: "Negotiating",
    tone: "warn",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-700 dark:text-amber-300",
    border: "border-amber-200 dark:border-amber-800",
  },
  booked: {
    label: "Booked",
    tone: "good",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-200 dark:border-emerald-800",
  },
  lost: {
    label: "Lost",
    tone: "bad",
    bg: "bg-rose-50 dark:bg-rose-950/40",
    text: "text-rose-700 dark:text-rose-300",
    border: "border-rose-200 dark:border-rose-800",
  },
};

export function isValidIntent(val: any): val is ContactIntent {
  return typeof val === "string" && INTENT_VALUES.includes(val as ContactIntent);
}

export function isValidStage(val: any): val is LeadStage {
  return typeof val === "string" && STAGE_VALUES.includes(val as LeadStage);
}

/**
 * Extracts variable names from templates like "{name} and {topic}".
 */
export function extractTemplateVariables(template: string): string[] {
  const matches = template.match(/\{([^{}]+)\}/g);
  if (!matches) return [];
  return matches.map((m) => m.slice(1, -1).trim());
}

/**
 * Validates a follow-up template:
 * - max 300 characters
 * - only allowed variables
 */
export function validateFollowupTemplate(
  template: string,
  allowedVars: readonly string[],
  fieldName = "Template"
): { ok: boolean; error?: string } {
  if (typeof template !== "string") {
    return { ok: false, error: `${fieldName} must be a text string.` };
  }
  if (template.length > 300) {
    return {
      ok: false,
      error: `${fieldName} must be at most 300 characters (currently ${template.length}).`,
    };
  }

  const vars = extractTemplateVariables(template);
  const unknownVars = vars.filter((v) => !allowedVars.includes(v as any));
  if (unknownVars.length > 0) {
    return {
      ok: false,
      error: `${fieldName} contains invalid variables: {${unknownVars.join("}, {")}}. Allowed: {${allowedVars.join("}, {")}}`,
    };
  }

  return { ok: true };
}

/**
 * Validates follow-up wait hours (24 to 168).
 */
export function validateFollowupHours(hours: any): { ok: boolean; value?: number; error?: string } {
  const num = Number(hours);
  if (!Number.isInteger(num) || num < 24 || num > 168) {
    return {
      ok: false,
      error: "Follow-up wait time must be an integer between 24 and 168 hours.",
    };
  }
  return { ok: true, value: num };
}

/**
 * Renders template with data.
 */
export function renderFollowupMessage(
  template: string,
  data: { name?: string | null; topic?: string | null; quote?: string | null }
): string {
  if (!template) return "";
  const name = data.name?.trim() || "there";
  const topic = data.topic?.trim() || "";
  const quote = data.quote?.trim() || "";

  return template
    .replace(/\{name\}/g, name)
    .replace(/\{topic\}/g, topic)
    .replace(/\{quote\}/g, quote);
}

/**
 * Calculates scheduled follow-up time based on last message and after_hours,
 * noting the 09:00 - 21:00 dispatch window.
 */
export function calculateScheduledFollowup(
  lastMessageAt: Date | string,
  afterHours = 72
): {
  scheduledDate: Date;
  isOverdue: boolean;
  windowNote: string;
} {
  const d = new Date(lastMessageAt);
  const scheduledTime = d.getTime() + afterHours * 60 * 60 * 1000;
  const scheduledDate = new Date(scheduledTime);
  const now = Date.now();
  const isOverdue = now >= scheduledTime;

  return {
    scheduledDate,
    isOverdue,
    windowNote: "Sent between 09:00 and 21:00 (at most twice to quiet enquiries)",
  };
}
