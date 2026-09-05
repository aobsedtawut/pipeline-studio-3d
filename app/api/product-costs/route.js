import { prisma } from "../../lib/db";

export async function GET() {
  try {
    const productCosts = await prisma.productCost.findMany({ orderBy: { updatedAt: "desc" } });
    return Response.json({ productCosts });
  } catch (e) {
    return Response.json({ error: "อ่านข้อมูลต้นทุนไม่สำเร็จ: " + String(e.message || e) }, { status: 502 });
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

  if (typeof campaignId !== "string" || typeof productName !== "string" || !campaignId.trim() || !productName.trim() || unitCostTHB === undefined || sellingPriceTHB === undefined) {
    return Response.json({ error: "ต้องระบุ campaignId, productName, unitCostTHB, sellingPriceTHB" }, { status: 400 });
  }

  const values = {
    unitCostTHB: Number(unitCostTHB),
    packagingShippingCostTHB: packagingShippingCostTHB === undefined || packagingShippingCostTHB === "" ? 0 : Number(packagingShippingCostTHB),
    codFeePercent: codFeePercent === undefined || codFeePercent === "" ? 0 : Number(codFeePercent),
    sellingPriceTHB: Number(sellingPriceTHB),
  };
  if (
    !Object.values(values).every(Number.isFinite) ||
    values.unitCostTHB < 0 ||
    values.packagingShippingCostTHB < 0 ||
    values.codFeePercent < 0 ||
    values.codFeePercent > 100 ||
    values.sellingPriceTHB <= 0
  ) {
    return Response.json({ error: "กรอกต้นทุน/ราคาเป็นตัวเลขที่ถูกต้อง และค่าธรรมเนียม COD ระหว่าง 0–100%" }, { status: 400 });
  }

  const cleanCampaignId = campaignId.trim();
  const cleanProductName = productName.trim();

  try {
    const productCost = await prisma.productCost.upsert({
      where: { campaignId: cleanCampaignId },
      create: {
        campaignId: cleanCampaignId,
        productName: cleanProductName,
        ...values,
        notes: notes ? String(notes).trim() : null,
      },
      update: {
        productName: cleanProductName,
        ...values,
        notes: notes ? String(notes).trim() : null,
      },
    });
    return Response.json({ productCost });
  } catch (e) {
    return Response.json({ error: "บันทึกไม่สำเร็จ: " + String(e.message || e) }, { status: 502 });
  }
}
