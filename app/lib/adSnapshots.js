import { prisma } from "./db";
import { entityIdForLevel, entityNameForLevel } from "./facebookAds";

function dayKey(dateStr) {
  return new Date(`${dateStr}T00:00:00Z`);
}

// Shared upsert used by both /api/ads-insights (best-effort, swallowed on
// failure) and /api/ads-sync (the route that's allowed to hard-fail) so the
// two never drift on what a snapshot row looks like. `creativeFormatMap`
// (adId -> format string) is only meaningful for level:"ad" rows.
export async function upsertAdSnapshots(rows, level, creativeFormatMap) {
  let count = 0;
  await Promise.all(
    rows.map(async (r) => {
      const entityId = entityIdForLevel(r, level);
      if (!entityId) return;
      const creativeFormat = level === "ad" && creativeFormatMap ? creativeFormatMap.get(r.adId) || null : null;
      await prisma.adSnapshot.upsert({
        where: { entityLevel_entityId_snapshotDate: { entityLevel: level, entityId, snapshotDate: dayKey(r.date) } },
        create: {
          snapshotDate: dayKey(r.date),
          entityLevel: level,
          entityId,
          entityName: entityNameForLevel(r, level),
          campaignId: r.campaignId,
          campaignName: r.campaignName,
          adsetId: r.adsetId,
          adsetName: r.adsetName,
          adId: r.adId,
          adName: r.adName,
          objective: r.objective,
          optimizationGoal: r.optimizationGoal,
          effectiveStatus: r.effectiveStatus,
          creativeFormat,
          spend: r.spend,
          impressions: r.impressions,
          reach: r.reach,
          clicks: r.clicks,
          frequency: r.frequency,
          cpm: r.cpm,
          ctr: r.ctr,
          cpc: r.cpc,
          results: r.results,
          resultType: r.resultType,
          costPerResult: r.costPerResult,
        },
        update: {
          spend: r.spend,
          impressions: r.impressions,
          reach: r.reach,
          clicks: r.clicks,
          frequency: r.frequency,
          cpm: r.cpm,
          ctr: r.ctr,
          cpc: r.cpc,
          results: r.results,
          resultType: r.resultType,
          costPerResult: r.costPerResult,
          effectiveStatus: r.effectiveStatus,
          ...(creativeFormat ? { creativeFormat } : {}),
        },
      });
      count++;
    })
  );
  return count;
}
