// Campaign catalog for selectors in Insights, Analysis, and Profit. This is
// intentionally separate from /api/ads-insights: a campaign with no spend in
// the selected date window must still remain selectable.
import { prisma } from "../../lib/db";
import { fbGraphGetAllPages } from "../../lib/facebookAds";

async function historicalCampaigns() {
  const rows = await prisma.adSnapshot.findMany({
    distinct: ["campaignId"],
    orderBy: { campaignId: "asc" },
    select: { campaignId: true, campaignName: true, effectiveStatus: true },
  });
  return rows.map((row) => ({
    id: row.campaignId,
    name: row.campaignName,
    effectiveStatus: row.effectiveStatus,
  }));
}

export async function GET() {
  const token = process.env.FB_USER_ACCESS_TOKEN;
  const adAccountId = process.env.FB_AD_ACCOUNT_ID;

  if (token && adAccountId) {
    const act = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
    try {
      const rows = await fbGraphGetAllPages(`${act}/campaigns`, {
        fields: "id,name,effective_status",
        limit: 200,
        access_token: token,
      });
      const campaigns = rows
        .map((row) => ({ id: row.id, name: row.name || row.id, effectiveStatus: row.effective_status || null }))
        .sort((a, b) => a.name.localeCompare(b.name, "th"));
      return Response.json({ ok: true, source: "facebook", campaigns });
    } catch {
      // A stored catalog remains useful during a temporary Graph API failure.
    }
  }

  try {
    const campaigns = await historicalCampaigns();
    return Response.json({ ok: true, source: "history", campaigns });
  } catch (e) {
    const missingConfig = !token || !adAccountId;
    return Response.json(
      {
        error: missingConfig
          ? "ยังไม่ได้ตั้งค่า FB_USER_ACCESS_TOKEN / FB_AD_ACCOUNT_ID และไม่พบข้อมูลแคมเปญย้อนหลัง"
          : "โหลดรายชื่อแคมเปญจาก Facebook และฐานข้อมูลไม่สำเร็จ",
      },
      { status: missingConfig ? 400 : 502 }
    );
  }
}
