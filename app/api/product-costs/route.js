import { prisma } from "../../lib/db";

export async function GET() {
  try {
    const productCosts = await prisma.productCost.findMany({ orderBy: { updatedAt: "desc" } });
    return Response.json({ productCosts });
  } catch {
    return Response.json({ productCosts: [] });
  }
}

// Upsert-by-campaignId — the @@unique constraint on campaignId keeps
// resubmitting the same campaign's cost form idempotent, not duplicative.
export async function POST(request) {
  let body = {};
  try {
    body = await request.json();
  } catch {}
  const { campaignId, productName, unitCostTHB, packagingShippingCostTHB, codFeePercent, sellingPriceTHB, notes } = body;

  if (!campaignId || !productName || unitCostTHB === undefined || sellingPriceTHB === undefined) {
    return Response.json({ error: "ต้องระบุ campaignId, productName, unitCostTHB, sellingPriceTHB" }, { status: 400 });
  }

  try {
    const productCost = await prisma.productCost.upsert({
      where: { campaignId },
      create: {
        campaignId,
        productName,
        unitCostTHB: Number(unitCostTHB),
        packagingShippingCostTHB: Number(packagingShippingCostTHB) || 0,
        codFeePercent: Number(codFeePercent) || 0,
        sellingPriceTHB: Number(sellingPriceTHB),
        notes: notes || null,
      },
      update: {
        productName,
        unitCostTHB: Number(unitCostTHB),
        packagingShippingCostTHB: Number(packagingShippingCostTHB) || 0,
        codFeePercent: Number(codFeePercent) || 0,
        sellingPriceTHB: Number(sellingPriceTHB),
        notes: notes || null,
      },
    });
    return Response.json({ productCost });
  } catch (e) {
    return Response.json({ error: "บันทึกไม่สำเร็จ: " + String(e.message || e) }, { status: 502 });
  }
}
