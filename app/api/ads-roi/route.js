// Combines synced ad spend/results with manually-logged product economics
// to compute real profit — not just ad metrics. Hard-requires DB (no live
// fallback, unlike /api/ads-insights): there's no way to reconstruct
// historical spend or cost data from Facebook's API alone.
import { prisma } from "../../lib/db";
import { computeRoi } from "../../lib/roi";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const campaignId = searchParams.get("campaignId");
  if (!campaignId) {
    return Response.json({ error: "ต้องระบุ campaignId" }, { status: 400 });
  }
  const requestedDays = Number(searchParams.get("days"));
  const days = Number.isFinite(requestedDays) && requestedDays > 0 ? Math.min(Math.floor(requestedDays), 365) : 30;
  const since = searchParams.get("since") ? new Date(searchParams.get("since")) : new Date(Date.now() - days * 86400000);
  const until = searchParams.get("until") ? new Date(searchParams.get("until")) : new Date();
  const rawOrdersOverride = searchParams.get("ordersOverride");
  const ordersOverride = rawOrdersOverride === null || rawOrdersOverride === "" ? null : Number(rawOrdersOverride);

  if (Number.isNaN(since.getTime()) || Number.isNaN(until.getTime()) || since > until) {
    return Response.json({ error: "ช่วงวันที่ไม่ถูกต้อง" }, { status: 400 });
  }
  if (ordersOverride !== null && (!Number.isFinite(ordersOverride) || ordersOverride < 0)) {
    return Response.json({ error: "จำนวนออเดอร์ต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป" }, { status: 400 });
  }

  try {
    const [snapshots, productCost] = await Promise.all([
      prisma.adSnapshot.findMany({
        where: { campaignId, entityLevel: "campaign", snapshotDate: { gte: since, lte: until } },
      }),
      prisma.productCost.findUnique({ where: { campaignId } }),
    ]);

    const spend = snapshots.reduce((s, r) => s + r.spend, 0);
    const resultsTotal = snapshots.reduce((s, r) => s + (r.results || 0), 0);
    const orders = ordersOverride !== null ? ordersOverride : resultsTotal;

    if (!productCost) {
      return Response.json({
        ok: true,
        campaignId,
        range: { since, until },
        spend: Math.round(spend * 100) / 100,
        orders,
        productCost: null,
        revenue: null,
        cogs: null,
        grossProfit: null,
        roas: null,
        profitMargin: null,
        costPerOrder: orders ? Math.round((spend / orders) * 100) / 100 : null,
        breakEvenOrders: null,
      });
    }

    const roi = computeRoi({
      spend,
      orders,
      unitCostTHB: productCost.unitCostTHB,
      packagingShippingCostTHB: productCost.packagingShippingCostTHB,
      codFeePercent: productCost.codFeePercent,
      sellingPriceTHB: productCost.sellingPriceTHB,
    });

    return Response.json({
      ok: true,
      campaignId,
      range: { since, until },
      spend: Math.round(spend * 100) / 100,
      orders,
      productCost,
      ...roi,
    });
  } catch (e) {
    return Response.json({ error: "อ่านข้อมูลไม่สำเร็จ: " + String(e.message || e) }, { status: 502 });
  }
}
