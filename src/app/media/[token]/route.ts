import { one } from "@/lib/db";

/**
 * Public image endpoint — NO login required.
 * Evolution API fetches this URL directly from the internet with no cookie,
 * so we must NOT enforce a session check here.
 *
 * Cache-Control: immutable because public_token is a random UUID that
 * never changes for a given row; CDN / browser can cache forever.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ token: string }> }
) {
  const { token } = await ctx.params;

  // Basic token sanity — 32 hex chars, nothing usable for injection.
  if (!/^[a-f0-9]{32}$/.test(token)) {
    return new Response("Not found", { status: 404 });
  }

  const row = await one<{ mime_type: string; file_data: Buffer }>(
    `SELECT mime_type, file_data FROM wa_media WHERE public_token = $1 AND active`,
    [token]
  );

  if (!row) return new Response("Not found", { status: 404 });

  // Convert Buffer → Uint8Array so it is a valid BodyInit in the Web API.
  return new Response(new Uint8Array(row.file_data), {
    headers: {
      "Content-Type": row.mime_type,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
