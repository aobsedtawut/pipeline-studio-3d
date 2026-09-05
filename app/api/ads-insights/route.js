// Live read of Marketing API performance data — one row per day per entity
// (time_increment=1) so the client can render both totals and a trend line
// from a single call. Also best-effort upserts every row into AdSnapshot
// (see prisma/schema.prisma) so history survives past Facebook's own
// insights lookback window — but that upsert is caught and swallowed on
// failure, same degrade-gracefully pattern as app/api/runs/route.js, so
// this route still returns live data with no DATABASE_URL configured.
import { fetchInsightRows } from "../../lib/facebookAds";
import { upsertAdSnapshots } from "../../lib/adSnapshots";

const LEVELS = ["campaign", "adset", "ad"];
const DATE_PRESETS = new Set(["today", "yesterday", "last_7d", "last_30d"]);

export async function GET(request) {
  const token = process.env.FB_USER_ACCESS_TOKEN;
  const adAccountId = process.env.FB_AD_ACCOUNT_ID;
  if (!token || !adAccountId) {
    return Response.json(
      { error: "ยังไม่ได้ตั้งค่า access token FB_USER_ACCESS_TOKEN / FB_AD_ACCOUNT_ID ใน Environment Variables" },
      { status: 400 }
    );
  }
  const act = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;

  const { searchParams } = new URL(request.url);
  const level = LEVELS.includes(searchParams.get("level")) ? searchParams.get("level") : "campaign";
  const requestedDatePreset = searchParams.get("datePreset");
  const datePreset = DATE_PRESETS.has(requestedDatePreset) ? requestedDatePreset : "last_7d";
  const campaignId = searchParams.get("campaignId") || null;

  try {
    const rows = await fetchInsightRows({ act, token, level, dateParams: { date_preset: datePreset }, campaignId });

    const totals = rows.reduce(
      (acc, r) => {
        acc.spend += r.spend;
        acc.impressions += r.impressions;
        acc.clicks += r.clicks;
        if (r.results !== null && r.results !== undefined && r.resultType) {
          acc.results += r.results;
          acc.resultsByType[r.resultType] = (acc.resultsByType[r.resultType] || 0) + r.results;
        }
        return acc;
      },
      { spend: 0, impressions: 0, clicks: 0, results: 0, resultsByType: {} }
    );
    const resultTypes = Object.keys(totals.resultsByType);
    totals.hasMixedResultTypes = resultTypes.length > 1;
    if (totals.hasMixedResultTypes) totals.results = null;
    totals.costPerResult = !totals.hasMixedResultTypes && totals.results ? totals.spend / totals.results : null;

    // Best-effort history upsert — never lets a DB problem break the live
    // response above.
    try {
      await upsertAdSnapshots(rows, level);
    } catch {
      // history snapshot is best-effort
    }

    return Response.json({ ok: true, level, rows, totals });
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 502 });
  }
}
