import { requireTenant, errorResponse } from "@/lib/auth";
import { q, one } from "@/lib/db";
import { parseRange, getDateRanges } from "@/lib/analytics";
import { getTenantToday } from "@/lib/analytics-server";

export async function GET(req: Request) {
  try {
    const { tenantId } = await requireTenant(req);
    const sp = new URL(req.url).searchParams;
    const range = parseRange(sp.get("range"));
    if (!range) {
      return Response.json({ ok: false, error: "invalid_range" }, { status: 400 });
    }

    const todayStr = await getTenantToday(tenantId);
    const { current, previous } = getDateRanges(todayStr, range);

    // 1. Daily rows in current range
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
    const daily = current.dates.map((d) => {
      const row = dailyByDay.get(d);
      return {
        day: d,
        messages_in: Number(row?.messages_in) || 0,
        bot_replies: Number(row?.bot_replies) || 0,
        staff_replies: Number(row?.staff_replies) || 0,
        new_contacts: Number(row?.new_contacts) || 0,
        ad_leads: Number(row?.ad_leads) || 0,
        bookings_created: Number(row?.bookings_created) || 0,
        bookings_by_bot: Number(row?.bookings_by_bot) || 0,
      };
    });

    // 2. Current totals
    const totals = daily.reduce(
      (acc, r) => ({
        messages_in: acc.messages_in + r.messages_in,
        bot_replies: acc.bot_replies + r.bot_replies,
        staff_replies: acc.staff_replies + r.staff_replies,
        new_contacts: acc.new_contacts + r.new_contacts,
        ad_leads: acc.ad_leads + r.ad_leads,
        bookings_created: acc.bookings_created + r.bookings_created,
        bookings_by_bot: acc.bookings_by_bot + r.bookings_by_bot,
      }),
      {
        messages_in: 0,
        bot_replies: 0,
        staff_replies: 0,
        new_contacts: 0,
        ad_leads: 0,
        bookings_created: 0,
        bookings_by_bot: 0,
      }
    );

    // 3. Previous period totals
    const prevRow = await one<{
      messages_in: number;
      bot_replies: number;
      staff_replies: number;
      new_contacts: number;
      ad_leads: number;
      bookings_created: number;
      bookings_by_bot: number;
    }>(
      `SELECT COALESCE(SUM(messages_in), 0)::int AS messages_in,
              COALESCE(SUM(bot_replies), 0)::int AS bot_replies,
              COALESCE(SUM(staff_replies), 0)::int AS staff_replies,
              COALESCE(SUM(new_contacts), 0)::int AS new_contacts,
              COALESCE(SUM(ad_leads), 0)::int AS ad_leads,
              COALESCE(SUM(bookings_created), 0)::int AS bookings_created,
              COALESCE(SUM(bookings_by_bot), 0)::int AS bookings_by_bot
         FROM wa_v_daily_overview
        WHERE tenant_id = $1
          AND day >= $2::date AND day <= $3::date`,
      [tenantId, previous.start, previous.end]
    );

    // 4. Response time for current period
    const respRows = await q<{
      inbound_messages: number;
      replied: number;
      avg_seconds_to_reply: number | null;
      median_seconds_to_reply: number | null;
    }>(
      `SELECT inbound_messages, replied, avg_seconds_to_reply, median_seconds_to_reply
         FROM wa_v_response_time_daily
        WHERE tenant_id = $1
          AND day >= $2::date AND day <= $3::date`,
      [tenantId, current.start, current.end]
    );

    let sumInbound = 0;
    let sumReplied = 0;
    let totalWeightedSecs = 0;
    let totalRepliedWithAvg = 0;
    let sumMedian = 0;
    let countMedian = 0;

    for (const r of respRows) {
      const inMsg = Number(r.inbound_messages) || 0;
      const rep = Number(r.replied) || 0;
      sumInbound += inMsg;
      sumReplied += rep;
      if (r.avg_seconds_to_reply != null && rep > 0) {
        totalWeightedSecs += Number(r.avg_seconds_to_reply) * rep;
        totalRepliedWithAvg += rep;
      }
      if (r.median_seconds_to_reply != null) {
        sumMedian += Number(r.median_seconds_to_reply);
        countMedian += 1;
      }
    }

    const avg_seconds_to_reply =
      totalRepliedWithAvg > 0 ? Math.round(totalWeightedSecs / totalRepliedWithAvg) : null;
    const median_seconds_to_reply =
      countMedian > 0 ? Math.round(sumMedian / countMedian) : null;
    const replied_pct =
      sumInbound > 0 ? Math.round((sumReplied / sumInbound) * 1000) / 10 : 0;

    // Previous response time metrics for change indicators
    const prevRespRows = await q<{
      inbound_messages: number;
      replied: number;
      avg_seconds_to_reply: number | null;
    }>(
      `SELECT inbound_messages, replied, avg_seconds_to_reply
         FROM wa_v_response_time_daily
        WHERE tenant_id = $1
          AND day >= $2::date AND day <= $3::date`,
      [tenantId, previous.start, previous.end]
    );
    let prevSumInbound = 0;
    let prevSumReplied = 0;
    let prevTotalWeightedSecs = 0;
    let prevTotalRepliedWithAvg = 0;
    for (const r of prevRespRows) {
      const inMsg = Number(r.inbound_messages) || 0;
      const rep = Number(r.replied) || 0;
      prevSumInbound += inMsg;
      prevSumReplied += rep;
      if (r.avg_seconds_to_reply != null && rep > 0) {
        prevTotalWeightedSecs += Number(r.avg_seconds_to_reply) * rep;
        prevTotalRepliedWithAvg += rep;
      }
    }
    const prev_avg_seconds =
      prevTotalRepliedWithAvg > 0 ? Math.round(prevTotalWeightedSecs / prevTotalRepliedWithAvg) : null;
    const prev_replied_pct =
      prevSumInbound > 0 ? Math.round((prevSumReplied / prevSumInbound) * 1000) / 10 : 0;

    const previousTotals = {
      messages_in: Number(prevRow?.messages_in) || 0,
      bot_replies: Number(prevRow?.bot_replies) || 0,
      staff_replies: Number(prevRow?.staff_replies) || 0,
      new_contacts: Number(prevRow?.new_contacts) || 0,
      ad_leads: Number(prevRow?.ad_leads) || 0,
      bookings_created: Number(prevRow?.bookings_created) || 0,
      bookings_by_bot: Number(prevRow?.bookings_by_bot) || 0,
      avg_seconds_to_reply: prev_avg_seconds,
      replied_pct: prev_replied_pct,
    };

    // 5. Funnel
    const funnelRows = await q<{
      lead_source: string;
      contacts: number;
      engaged: number;
      booked: number;
      completed: number;
      needed_human: number;
    }>(
      `SELECT lead_source,
              count(*)::int AS contacts,
              count(*) FILTER (WHERE inbound_messages >= 2)::int AS engaged,
              count(*) FILTER (WHERE booked)::int AS booked,
              count(*) FILTER (WHERE completed)::int AS completed,
              count(*) FILTER (WHERE needed_human)::int AS needed_human
         FROM wa_v_contact_funnel
        WHERE tenant_id = $1
          AND (created_at AT TIME ZONE COALESCE((SELECT timezone FROM wa_bot_settings WHERE tenant_id = $1), 'Asia/Qatar'))::date >= $2::date
          AND (created_at AT TIME ZONE COALESCE((SELECT timezone FROM wa_bot_settings WHERE tenant_id = $1), 'Asia/Qatar'))::date <= $3::date
        GROUP BY lead_source`,
      [tenantId, current.start, current.end]
    );

    const bySource: Record<string, { contacts: number; engaged: number; booked: number; completed: number }> = {
      organic: { contacts: 0, engaged: 0, booked: 0, completed: 0 },
      ad: { contacts: 0, engaged: 0, booked: 0, completed: 0 },
    };

    let totalContacts = 0;
    let totalEngaged = 0;
    let totalBooked = 0;
    let totalCompleted = 0;
    let totalNeededHuman = 0;

    for (const r of funnelRows) {
      const src = r.lead_source === "ad" ? "ad" : "organic";
      bySource[src] = {
        contacts: Number(r.contacts) || 0,
        engaged: Number(r.engaged) || 0,
        booked: Number(r.booked) || 0,
        completed: Number(r.completed) || 0,
      };
      totalContacts += Number(r.contacts) || 0;
      totalEngaged += Number(r.engaged) || 0;
      totalBooked += Number(r.booked) || 0;
      totalCompleted += Number(r.completed) || 0;
      totalNeededHuman += Number(r.needed_human) || 0;
    }

    return Response.json({
      ok: true,
      range,
      daily,
      totals,
      previous: previousTotals,
      response: {
        avg_seconds_to_reply,
        median_seconds_to_reply,
        replied_pct,
      },
      funnel: {
        contacts: totalContacts,
        engaged: totalEngaged,
        booked: totalBooked,
        completed: totalCompleted,
        by_source: bySource,
      },
      human: totalNeededHuman,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
