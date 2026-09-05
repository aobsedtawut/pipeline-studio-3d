import { prisma } from "../../../lib/db";

const NUMERIC_FIELDS = ["unitCostTHB", "packagingShippingCostTHB", "codFeePercent", "sellingPriceTHB"];

export async function GET(req, { params }) {
  try {
    const productCost = await prisma.productCost.findUnique({ where: { campaignId: params.campaignId } });
    return Response.json({ productCost: productCost || null });
  } catch (e) {
    return Response.json({ error: "อ่านข้อมูลต้นทุนไม่สำเร็จ: " + String(e.message || e) }, { status: 502 });
  }
}

export async function PATCH(req, { params }) {
  try {
    const body = await req.json();
    const data = {};
    for (const key of ["productName", "unitCostTHB", "packagingShippingCostTHB", "codFeePercent", "sellingPriceTHB", "notes"]) {
      if (body[key] !== undefined) {
        data[key] = NUMERIC_FIELDS.includes(key) ? Number(body[key]) : body[key];
      }
    }
    if (!Object.keys(data).length) return Response.json({ error: "ไม่มีข้อมูลที่ต้องอัปเดต" }, { status: 400 });
    if (NUMERIC_FIELDS.some((key) => data[key] !== undefined && !Number.isFinite(data[key]))) {
      return Response.json({ error: "ต้นทุนและราคาต้องเป็นตัวเลข" }, { status: 400 });
    }
    if (
      data.unitCostTHB < 0 ||
      data.packagingShippingCostTHB < 0 ||
      data.sellingPriceTHB <= 0 ||
      data.codFeePercent < 0 ||
      data.codFeePercent > 100
    ) {
      return Response.json({ error: "ต้นทุนต้องไม่ติดลบ ราคาขายต้องมากกว่า 0 และ COD ต้องอยู่ระหว่าง 0–100%" }, { status: 400 });
    }
    if (data.productName !== undefined) {
      if (typeof data.productName !== "string" || !data.productName.trim()) return Response.json({ error: "ต้องระบุชื่อสินค้า" }, { status: 400 });
      data.productName = data.productName.trim();
    }
    if (data.notes !== undefined) data.notes = typeof data.notes === "string" ? data.notes.trim() || null : null;
    const productCost = await prisma.productCost.update({ where: { campaignId: params.campaignId }, data });
    return Response.json({ productCost });
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: e.code === "P2025" ? 404 : 502 });
  }
}

export async function DELETE(req, { params }) {
  try {
    await prisma.productCost.delete({ where: { campaignId: params.campaignId } });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: e.code === "P2025" ? 404 : 502 });
  }
}
