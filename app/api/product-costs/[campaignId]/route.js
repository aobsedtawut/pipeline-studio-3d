import { prisma } from "../../../lib/db";

export async function GET(req, { params }) {
  try {
    const productCost = await prisma.productCost.findUnique({ where: { campaignId: params.campaignId } });
    return Response.json({ productCost: productCost || null });
  } catch {
    return Response.json({ productCost: null });
  }
}

export async function PATCH(req, { params }) {
  try {
    const body = await req.json();
    const data = {};
    for (const key of ["productName", "unitCostTHB", "packagingShippingCostTHB", "codFeePercent", "sellingPriceTHB", "notes"]) {
      if (body[key] !== undefined) {
        data[key] = ["unitCostTHB", "packagingShippingCostTHB", "codFeePercent", "sellingPriceTHB"].includes(key)
          ? Number(body[key])
          : body[key];
      }
    }
    const productCost = await prisma.productCost.update({ where: { campaignId: params.campaignId }, data });
    return Response.json({ productCost });
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 200 });
  }
}

export async function DELETE(req, { params }) {
  try {
    await prisma.productCost.delete({ where: { campaignId: params.campaignId } });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 200 });
  }
}
