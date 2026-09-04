// Explicit sync — pulls a rolling window of insights at all three levels
// (campaign/adset/ad), enriches ad-level rows with creative format, and
// pulls edit history from the Marketing API's /activities edge so Phase 2's
// "editing too often" blind-spot check has data to work with. Called
// either by a human clicking "ซิงค์ข้อมูลล่าสุด" (has a session — this
// route is NOT excluded from middleware for that path) or by Vercel Cron
// (no session — authenticates via CRON_SECRET instead, see middleware.js).
//
// Unlike /api/ads-insights (best-effort DB write), this route's whole job
// IS the DB write — a failure here should be visible, not swallowed.
import { getServerSession } from "next-auth";
import { authOptions } from "../../lib/authOptions";
import { prisma } from "../../lib/db";
import { fetchInsightRows, fbGraphGetAllPages } from "../../lib/facebookAds";
import { upsertAdSnapshots } from "../../lib/adSnapshots";

const LEVELS = ["campaign", "adset", "ad"];

function toDateStr(d) {
  return d.toISOString().slice(0, 10);
}

async function isAuthorized(request) {
  const authHeader = request.headers.get("authorization") || "";
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;
  const session = await getServerSession(authOptions);
  return !!session;
}

export async function POST(request) {
  if (!(await isAuthorized(request))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const token = process.env.FB_USER_ACCESS_TOKEN;
  const adAccountId = process.env.FB_AD_ACCOUNT_ID;
  if (!token || !adAccountId) {
    return Response.json(
      { error: "ยังไม่ได้ตั้งค่า FB_USER_ACCESS_TOKEN / FB_AD_ACCOUNT_ID ใน Environment Variables" },
      { status: 400 }
    );
  }
  const act = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;

  let body = {};
  try {
    body = await request.json();
  } catch {}
  const sinceDaysAgo = Number(body.sinceDaysAgo) > 0 ? Number(body.sinceDaysAgo) : 3;

  const until = new Date();
  const since = new Date(until.getTime() - sinceDaysAgo * 24 * 60 * 60 * 1000);
  const timeRange = JSON.stringify({ since: toDateStr(since), until: toDateStr(until) });

  try {
    // Ad-level creative format enrichment — best-effort; a guessed field
    // shape (creative.object_type) per the plan's own caveat, verify
    // against a real response before trusting it downstream.
    let creativeFormatMap = new Map();
    try {
      const adRows = await fbGraphGetAllPages(`${act}/ads`, {
        fields: "id,creative{object_type}",
        limit: 200,
        access_token: token,
      });
      creativeFormatMap = new Map(adRows.map((a) => [a.id, a.creative?.object_type || null]));
    } catch {
      // enrichment is best-effort — snapshots still save without it
    }

    let snapshotCount = 0;
    for (const level of LEVELS) {
      const rows = await fetchInsightRows({ act, token, level, dateParams: { time_range: timeRange } });
      snapshotCount += await upsertAdSnapshots(rows, level, level === "ad" ? creativeFormatMap : undefined);
    }

    // Edit history — powers Phase 2's over-editing blind spot. Field names
    // and since/until format are a best-effort read of the /activities
    // edge; verify against a live response before relying on it.
    let editEventCount = 0;
    try {
      const activityRows = await fbGraphGetAllPages(`${act}/activities`, {
        since: toDateStr(since),
        until: toDateStr(until),
        fields: "event_type,translated_event_type,event_time,extra_data,actor_name,object_id,object_name,object_type",
        limit: 200,
        access_token: token,
      });

      await Promise.all(
        activityRows.map(async (a) => {
          const entityLevel =
            a.object_type === "CAMPAIGN" ? "campaign" : a.object_type === "AD_SET" ? "adset" : a.object_type === "AD" ? "ad" : "unknown";
          const eventTime = new Date(a.event_time);
          if (!a.object_id || Number.isNaN(eventTime.getTime())) return;
          await prisma.adEditEvent.upsert({
            where: {
              entityId_eventTime_eventType: { entityId: a.object_id, eventTime, eventType: a.event_type || "unknown" },
            },
            create: {
              entityLevel,
              entityId: a.object_id,
              entityName: a.object_name || null,
              campaignId: entityLevel === "campaign" ? a.object_id : null,
              eventType: a.event_type || "unknown",
              translatedEventType: a.translated_event_type || null,
              eventTime,
              actorName: a.actor_name || null,
              extraData: a.extra_data || null,
            },
            update: {},
          });
          editEventCount++;
        })
      );
    } catch {
      // edit-history sync is best-effort — snapshot sync above already succeeded
    }

    return Response.json({
      ok: true,
      upserted: { snapshots: snapshotCount, editEvents: editEventCount },
      window: { since: toDateStr(since), until: toDateStr(until) },
    });
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 502 });
  }
}
