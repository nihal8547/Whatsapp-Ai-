import { requireTenant, errorResponse } from "@/lib/auth";
import { q } from "@/lib/db";
import { parseRange, getDateRanges, escapeCsv } from "@/lib/analytics";
import { getTenantToday } from "@/lib/analytics-server";

export async function GET(req: Request) {
  try {
    const { tenantId } = await requireTenant(req);
    const sp = new URL(req.url).searchParams;
    const type = sp.get("type");
    if (type !== "daily" && type !== "ads") {
      return Response.json({ ok: false, error: "invalid_type" }, { status: 400 });
    }

    const range = parseRange(sp.get("range"));
    if (!range) {
      return Response.json({ ok: false, error: "invalid_range" }, { status: 400 });
    }

    const todayStr = await getTenantToday(tenantId);
    const { current } = getDateRanges(todayStr, range);

    let csvContent = "";
    let filename = "";

    if (type === "daily") {
      filename = `daily-analytics-${range}d.csv`;
      const rawDaily = await q<{
        day: string;
        messages_in: number;
        bot_replies: number;
        staff_replies: number;
        new_contacts: number;
        ad_leads: number;
        bookings_created: number;
        bookings_by_bot: number;
      }>(
        `SELECT to_char(day, 'YYYY-MM-DD') AS day,
                messages_in, bot_replies, staff_replies,
                new_contacts, ad_leads, bookings_created, bookings_by_bot
           FROM wa_v_daily_overview
          WHERE tenant_id = $1
            AND day >= $2::date AND day <= $3::date
          ORDER BY day ASC`,
        [tenantId, current.start, current.end]
      );

      const dailyByDay = new Map(rawDaily.map((r) => [r.day, r]));
      const headers = [
        "Day",
        "Messages In",
        "Bot Replies",
        "Staff Replies",
        "New Contacts",
        "Ad Leads",
        "Bookings Created",
        "Bookings by Bot",
      ];
      const lines = [headers.map(escapeCsv).join(",")];

      for (const d of current.dates) {
        const row = dailyByDay.get(d);
        lines.push(
          [
            d,
            Number(row?.messages_in) || 0,
            Number(row?.bot_replies) || 0,
            Number(row?.staff_replies) || 0,
            Number(row?.new_contacts) || 0,
            Number(row?.ad_leads) || 0,
            Number(row?.bookings_created) || 0,
            Number(row?.bookings_by_bot) || 0,
          ]
            .map(escapeCsv)
            .join(",")
        );
      }
      csvContent = lines.join("\r\n");
    } else {
      filename = `ad-performance-${range}d.csv`;
      const ads = await q<{
        ad_key: string;
        ad_title: string;
        ad_body: string;
        leads: number;
        engaged: number;
        booked: number;
        completed: number;
        booking_rate_pct: number;
      }>(
        `SELECT COALESCE(NULLIF(ad_key, ''), 'Unknown ad') AS ad_key,
                COALESCE(NULLIF(ad_title, ''), 'Unknown ad') AS ad_title,
                COALESCE(ad_body, '') AS ad_body,
                leads::int AS leads,
                engaged::int AS engaged,
                booked::int AS booked,
                completed::int AS completed,
                COALESCE(booking_rate_pct, 0)::float AS booking_rate_pct
           FROM wa_v_ad_performance
          WHERE tenant_id = $1
            AND (last_lead_at AT TIME ZONE COALESCE((SELECT timezone FROM wa_bot_settings WHERE tenant_id = $1), 'Asia/Qatar'))::date >= $2::date
            AND (last_lead_at AT TIME ZONE COALESCE((SELECT timezone FROM wa_bot_settings WHERE tenant_id = $1), 'Asia/Qatar'))::date <= $3::date
          ORDER BY leads DESC, booking_rate_pct DESC`,
        [tenantId, current.start, current.end]
      );

      const headers = [
        "Ad",
        "Title",
        "Body",
        "Leads",
        "Engaged",
        "Booked",
        "Completed",
        "Booking Rate (%)",
      ];
      const lines = [headers.map(escapeCsv).join(",")];

      for (const a of ads) {
        lines.push(
          [
            a.ad_key,
            a.ad_title,
            a.ad_body,
            Number(a.leads) || 0,
            Number(a.engaged) || 0,
            Number(a.booked) || 0,
            Number(a.completed) || 0,
            Number(a.booking_rate_pct) || 0,
          ]
            .map(escapeCsv)
            .join(",")
        );
      }
      csvContent = lines.join("\r\n");
    }

    // UTF-8 with BOM (\uFEFF) ensures Excel opens multilingual characters correctly
    const bomCsv = "\uFEFF" + csvContent;

    return new Response(bomCsv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
