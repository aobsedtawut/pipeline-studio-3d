import { prisma } from "../../../lib/db";

const ANALYSIS_STATUSES = new Set(["generated", "reviewed", "applied", "dismissed"]);

export async function GET(req, { params }) {
  try {
    const analysis = await prisma.adAnalysis.findUnique({ where: { id: params.id } });
    return Response.json({ analysis: analysis || null });
  } catch (e) {
    return Response.json({ error: "อ่านผลวิเคราะห์ไม่สำเร็จ: " + String(e.message || e) }, { status: 502 });
  }
}

export async function PATCH(req, { params }) {
  try {
    const { status, userNote } = await req.json();
    if (status !== undefined && !ANALYSIS_STATUSES.has(status)) {
      return Response.json({ error: "สถานะผลวิเคราะห์ไม่ถูกต้อง" }, { status: 400 });
    }
    if (userNote !== undefined && typeof userNote !== "string") {
      return Response.json({ error: "โน้ตต้องเป็นข้อความ" }, { status: 400 });
    }
    const analysis = await prisma.adAnalysis.update({
      where: { id: params.id },
      data: {
        ...(status !== undefined ? { status } : {}),
        ...(userNote !== undefined ? { userNote: userNote.trim().slice(0, 5000) || null } : {}),
      },
    });
    return Response.json({ analysis });
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: e.code === "P2025" ? 404 : 502 });
  }
}
