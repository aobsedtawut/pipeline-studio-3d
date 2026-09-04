import { prisma } from "../../../lib/db";

export async function GET(req, { params }) {
  try {
    const analysis = await prisma.adAnalysis.findUnique({ where: { id: params.id } });
    return Response.json({ analysis: analysis || null });
  } catch {
    return Response.json({ analysis: null });
  }
}

export async function PATCH(req, { params }) {
  try {
    const { status, userNote } = await req.json();
    const analysis = await prisma.adAnalysis.update({
      where: { id: params.id },
      data: {
        ...(status !== undefined ? { status } : {}),
        ...(userNote !== undefined ? { userNote } : {}),
      },
    });
    return Response.json({ analysis });
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 200 });
  }
}
