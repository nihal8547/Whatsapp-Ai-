export type RangeDays = 7 | 30 | 90;

export function parseRange(param: string | null): RangeDays | null {
  const val = param ?? "30";
  if (val === "7") return 7;
  if (val === "30") return 30;
  if (val === "90") return 90;
  return null;
}

export function getDateRanges(todayStr: string, days: RangeDays) {
  const [y, m, d] = todayStr.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));

  const currentDates: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const dt = new Date(base.getTime() - i * 86400000);
    currentDates.push(dt.toISOString().slice(0, 10));
  }

  const previousDates: string[] = [];
  for (let i = 2 * days - 1; i >= days; i--) {
    const dt = new Date(base.getTime() - i * 86400000);
    previousDates.push(dt.toISOString().slice(0, 10));
  }

  return {
    current: {
      dates: currentDates,
      start: currentDates[0],
      end: currentDates[currentDates.length - 1],
    },
    previous: {
      dates: previousDates,
      start: previousDates[0],
      end: previousDates[previousDates.length - 1],
    },
  };
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || isNaN(seconds)) return "—";
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
}

export function formatTimeAgo(iso: string | Date | null | undefined): string {
  if (!iso) return "";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const elapsedSecs = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (elapsedSecs < 60) return "just now";
  const mins = Math.floor(elapsedSecs / 60);
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function escapeCsv(val: unknown): string {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  return `"${str.replace(/"/g, '""')}"`;
}
