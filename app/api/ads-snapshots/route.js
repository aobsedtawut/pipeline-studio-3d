// Historical read for trend charts — unlike /api/ads-insights, this route
// hard-requires DATABASE_URL: there's no live fallback for history, since
// Facebook's own insights lookback window is limited and this is the only
// place multi-day trend data exists at all. Returns HTTP 200 with
// ok:false on any DB problem (not 500) so the UI can show a clear hint
// block instead of an error boundary.
import { prisma } from "../../lib/db";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const level = searchParams.get("level") || "campaign";
  const campaignId = searchParams.get("campaignId") || null;
  const days = Number(searchParams.get("days")) > 0 ? Number(searchParams.get("days")) : 30;

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    const snapshots = await prisma.adSnapshot.findMany({
      where: {
        entityLevel: level,
        snapshotDate: { gte: since },
        ...(campaignId ? { campaignId } : {}),
      },
      orderBy: { snapshotDate: "asc" },
      take: 1000,
    });
    return Response.json({ ok: true, snapshots });
  } catch (e) {
    return Response.json({
      ok: false,
      error: "ยังไม่ได้ตั้งค่า DATABASE_URL — ดูเทรนด์ย้อนหลังไม่ได้ (ข้อมูลสดยังใช้งานได้ที่แท็บอื่น)",
      snapshots: [],
    });
  }
}
