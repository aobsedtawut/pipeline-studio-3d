// AI analysis over synced ad performance data — POST generates a new
// analysis (Andromeda/Advantage+-aligned recommendations, see
// app/lib/adAnalysisPrompt.js), GET lists past ones. Follows the exact
// same request/parsing pattern as app/api/ai-rewrite/route.js (plain
// fetch to the Messages API, no SDK), except the model is asked for a
// JSON *object* (parsed via /\{[\s\S]*\}/) instead of ai-rewrite's JSON
// *array* — the object shape lets the UI render blind spots and
// recommended actions as distinct cards.
import { prisma } from "../../lib/db";
import { buildAnalysisPrompt } from "../../lib/adAnalysisPrompt";
import { computeAggregates } from "../../lib/adAnalysisAggregate";

const MODEL_FALLBACK = "claude-sonnet-4-5"; // same fallback as ai-rewrite/route.js — unverified, check before relying on it
const PROMPT_VERSION = "v1";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get("campaignId") || undefined;
    const requestedTake = Number(searchParams.get("take"));
    const take = Number.isFinite(requestedTake) && requestedTake > 0 ? Math.min(Math.floor(requestedTake), 100) : 20;
    const analyses = await prisma.adAnalysis.findMany({
      where: campaignId ? { campaignId } : {},
      orderBy: { createdAt: "desc" },
      take,
      select: { id: true, createdAt: true, campaignId: true, summary: true, healthScore: true, status: true },
    });
    return Response.json({ analyses });
  } catch (e) {
    return Response.json({ error: "อ่านประวัติการวิเคราะห์ไม่สำเร็จ: " + String(e.message || e) }, { status: 502 });
  }
}

export async function POST(request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "ยังไม่ได้ตั้งค่า ANTHROPIC_API_KEY ใน Environment Variables" }, { status: 400 });
  }

  let body = {};
  try {
    body = await request.json();
  } catch {}
  const scope = body.scope === "campaign" ? "campaign" : "account";
  const campaignId = scope === "campaign" ? body.campaignId : undefined;
  const requestedLookback = Number(body.lookbackDays);
  const lookbackDays = Number.isFinite(requestedLookback) && requestedLookback > 0 ? Math.min(Math.floor(requestedLookback), 90) : 7;
  const requestedGoal = Number(body.dailyOrderGoal);
  const dailyOrderGoal = Number.isFinite(requestedGoal) && requestedGoal > 0 ? Math.floor(requestedGoal) : null;

  if (scope === "campaign" && !campaignId) {
    return Response.json({ error: "ต้องระบุ campaignId เมื่อเลือกวิเคราะห์รายแคมเปญ" }, { status: 400 });
  }

  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
  const whereBase = campaignId ? { campaignId } : {};

  let snapshots, editEvents, productCost;
  try {
    [snapshots, editEvents, productCost] = await Promise.all([
      prisma.adSnapshot.findMany({ where: { ...whereBase, snapshotDate: { gte: since } }, orderBy: { snapshotDate: "asc" } }),
      prisma.adEditEvent.findMany({ where: { ...whereBase, eventTime: { gte: since } } }),
      campaignId ? prisma.productCost.findUnique({ where: { campaignId } }) : Promise.resolve(null),
    ]);
  } catch (e) {
    return Response.json({ error: "อ่านข้อมูลจากฐานข้อมูลไม่สำเร็จ: " + String(e.message || e) }, { status: 502 });
  }

  if (!snapshots.length) {
    return Response.json({ error: "ยังไม่มีข้อมูลเพียงพอ — ซิงค์ข้อมูลก่อนแล้วค่อยวิเคราะห์" }, { status: 400 });
  }

  const aggregates = computeAggregates(snapshots, editEvents, productCost);
  const prompt = buildAnalysisPrompt({ scope, campaignId, lookbackDays, dailyOrderGoal, aggregates });
  const model = process.env.ANTHROPIC_MODEL || MODEL_FALLBACK;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model, max_tokens: 3000, messages: [{ role: "user", content: prompt }] }),
    });
    const data = await res.json();
    if (!res.ok) {
      return Response.json({ error: data.error?.message || `เรียก AI ไม่สำเร็จ (HTTP ${res.status})` }, { status: 502 });
    }

    const text = data?.content?.[0]?.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return Response.json({ error: "AI ตอบกลับไม่ใช่ JSON ที่คาดไว้ — ลองใหม่อีกครั้ง" }, { status: 502 });
    }
    let parsed;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return Response.json({ error: "AI ตอบกลับไม่ใช่ JSON ที่คาดไว้ — ลองใหม่อีกครั้ง" }, { status: 502 });
    }

    let persisted = false;
    let id = null;
    try {
      const created = await prisma.adAnalysis.create({
        data: {
          scopeLevel: scope,
          campaignId: campaignId || null,
          lookbackDays,
          dailyOrderGoal,
          model,
          promptVersion: PROMPT_VERSION,
          summary: parsed.summary || "",
          healthScore: parsed.healthScore ?? null,
          blindSpots: parsed.blindSpots || [],
          recommendedActions: parsed.recommendedActions || [],
          budgetPlan: parsed.budgetPlan || null,
          rawResponseText: text,
        },
      });
      persisted = true;
      id = created.id;
    } catch {
      // persistence is best-effort — the analysis below is still returned
    }

    return Response.json({ ok: true, persisted, analysis: { id, ...parsed } });
  } catch (e) {
    return Response.json({ error: "เรียก AI ไม่สำเร็จ: " + String(e.message || e) }, { status: 502 });
  }
}
