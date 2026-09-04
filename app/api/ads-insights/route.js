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

export async function GET(request) {
  const token = process.env.FB_USER_ACCESS_TOKEN;
  const adAccountId = process.env.FB_AD_ACCOUNT_ID;
  if (!token || !adAccountId) {
    return Response.json(
      { error: "ยังไม่ได้ตั้งค่า FB_USER_ACCESS_TOKEN / FB_AD_ACCOUNT_ID ใน Environment Variables" },
      { status: 400 }
    );
  }
  const act = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;

  const { searchParams } = new URL(request.url);
  const level = LEVELS.includes(searchParams.get("level")) ? searchParams.get("level") : "campaign";
  const datePreset = searchParams.get("datePreset") || "last_7d";
  const campaignId = searchParams.get("campaignId") || null;

  try {
    const rows = await fetchInsightRows({ act, token, level, dateParams: { date_preset: datePreset }, campaignId });

    const totals = rows.reduce(
      (acc, r) => {
        acc.spend += r.spend;
        acc.impressions += r.impressions;
        acc.clicks += r.clicks;
        acc.results += r.results || 0;
        return acc;
      },
      { spend: 0, impressions: 0, clicks: 0, results: 0 }
    );
    totals.costPerResult = totals.results ? totals.spend / totals.results : null;

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
