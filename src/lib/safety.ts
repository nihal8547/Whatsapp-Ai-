export type SafetySettings = {
  proactive_enabled: boolean;
  hourly_cap: number;
  daily_cap: number;
  window_start: string;
  window_end: string;
  [key: string]: unknown;
};

export const DEFAULT_SAFETY_SETTINGS: SafetySettings = {
  proactive_enabled: true,
  hourly_cap: 30,
  daily_cap: 150,
  window_start: "09:00",
  window_end: "21:00",
};

export type SafetyValidationResult =
  | { ok: true; settings: { proactive_enabled: boolean; hourly_cap: number; daily_cap: number; window_start: string; window_end: string } }
  | { ok: false; error: string; message: string };

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export function validateSafetySettingsInput(body: any): SafetyValidationResult {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "invalid_body", message: "Invalid request payload." };
  }

  // proactive_enabled
  const proactive_enabled = Boolean(body.proactive_enabled);

  // hourly_cap: integer 1 to 60
  const hourly_cap = Number(body.hourly_cap);
  if (!Number.isInteger(hourly_cap) || hourly_cap < 1 || hourly_cap > 60) {
    return {
      ok: false,
      error: "invalid_hourly_cap",
      message: "Hourly cap must be an integer between 1 and 60 messages/hour.",
    };
  }

  // daily_cap: integer 1 to 300
  const daily_cap = Number(body.daily_cap);
  if (!Number.isInteger(daily_cap) || daily_cap < 1 || daily_cap > 300) {
    return {
      ok: false,
      error: "invalid_daily_cap",
      message: "Daily cap must be an integer between 1 and 300 messages/day.",
    };
  }

  // window_start and window_end
  const window_start = String(body.window_start || "").trim();
  const window_end = String(body.window_end || "").trim();

  if (!TIME_REGEX.test(window_start) || !TIME_REGEX.test(window_end)) {
    return {
      ok: false,
      error: "invalid_window_format",
      message: "Window start and end must be in 24-hour HH:MM format.",
    };
  }

  if (window_start >= window_end) {
    return {
      ok: false,
      error: "invalid_window_range",
      message: "Window start time must be earlier than window end time.",
    };
  }

  return {
    ok: true,
    settings: {
      proactive_enabled,
      hourly_cap,
      daily_cap,
      window_start,
      window_end,
    },
  };
}
