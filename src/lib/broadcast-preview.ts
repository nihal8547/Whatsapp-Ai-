/**
 * Client-safe broadcast message preview formatter.
 * Contains no server-side database dependencies.
 */

export function renderMessagePreview(
  template: string,
  sampleName = "Sarah",
  businessName = "Our Store",
  sampleAttributes: Record<string, string> = {}
): string {
  if (!template) return "";
  return template.replace(
    /\{([^{}|]+)(?:\|([^{}]*))?\}/g,
    (match, rawKey, fallback) => {
      const key = rawKey.trim();
      const lower = key.toLowerCase();
      if (lower === "name") {
        return sampleName || (fallback !== undefined ? fallback : "");
      }
      if (lower === "business") {
        return businessName || (fallback !== undefined ? fallback : "");
      }
      if (sampleAttributes[key] !== undefined && sampleAttributes[key] !== "") {
        return sampleAttributes[key];
      }
      if (fallback !== undefined) {
        return fallback;
      }
      return match;
    }
  );
}
