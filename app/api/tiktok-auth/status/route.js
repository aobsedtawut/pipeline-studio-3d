import { prisma } from "../../../lib/db";

// Without this, Next.js statically optimizes this route at build time
// (no request-dependent APIs used) and would freeze the "connected"
// response forever instead of checking the DB on every request.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await prisma.tikTokAuth.findFirst({ orderBy: { updatedAt: "desc" } });
    return Response.json({ connected: !!auth });
  } catch {
    // No DATABASE_URL configured, or table doesn't exist yet — treat as
    // not connected rather than erroring the UI.
    return Response.json({ connected: false });
  }
}
