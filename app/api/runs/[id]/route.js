import { NextResponse } from "next/server";
import { prisma } from "../../../lib/db";

export async function GET(req, { params }) {
  try {
    const { id } = await params;
    const run = await prisma.pipelineRun.findUnique({ where: { id } });
    return NextResponse.json({ run: run || null });
  } catch {
    return NextResponse.json({ run: null });
  }
}

export async function PATCH(req, { params }) {
  try {
    const { id } = await params;
    const { meta, scenes, stage } = await req.json();
    const run = await prisma.pipelineRun.update({
      where: { id },
      data: {
        ...(meta !== undefined ? { productName: meta?.productName || null, meta } : {}),
        ...(scenes !== undefined ? { scenes } : {}),
        ...(stage !== undefined ? { stage } : {}),
      },
    });
    return NextResponse.json({ run });
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 200 });
  }
}
