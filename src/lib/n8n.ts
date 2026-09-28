/** Server-only client for the n8n platform API. Never import this from a client component. */
type Action =
  | "send_message"
  | "create_tenant"
  | "whatsapp_connect"
  | "whatsapp_status"
  | "whatsapp_disconnect";

export async function n8n<T = any>(action: Action, body: Record<string, unknown> = {}) {
  const url = process.env.N8N_API_URL;
  const key = process.env.N8N_API_KEY;
  if (!url || !key) throw new Error("n8n_not_configured");

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key },
    body: JSON.stringify({ action, ...body }),
    cache: "no-store",
  });

  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok || data.ok === false) {
    const err: any = new Error(data.error || "n8n_" + res.status);
    err.status = res.ok ? 400 : res.status;
    throw err;
  }
  return data as T;
}
