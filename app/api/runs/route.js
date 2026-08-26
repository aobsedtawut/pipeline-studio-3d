import { NextResponse } from "next/server";
import { prisma } from "../../lib/db";

// History is an optional feature — if DATABASE_URL isn't configured (or the
// DB is unreachable), these degrade to empty/no-op responses instead of
// throwing, same pattern as /api/product-search and /api/tts.

export async function GET() {
  try {
    const runs = await prisma.pipelineRun.findMany({
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: { id: true, productName: true, stage: true, updatedAt: true },
    });
    return NextResponse.json({ runs });
  } catch {
    return NextResponse.json({ runs: [] });
  }
}

export async function POST(req) {
  try {
    const { meta, scenes, stage } = await req.json();
    const run = await prisma.pipelineRun.create({
      data: { productName: meta?.productName || null, meta: meta || {}, scenes: scenes || [], stage: stage || "product" },
    });
    return NextResponse.json({ run });
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 200 });
  }
}
