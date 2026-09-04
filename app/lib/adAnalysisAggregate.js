// Turns raw AdSnapshot/AdEditEvent/ProductCost rows into the pre-computed
// aggregates the AI prompt reasons over — kept out of the route file since
// this is the part most worth testing/reading in isolation.

function round2(n) {
  return Math.round(n * 100) / 100;
}

function dateKey(d) {
  return new Date(d).toISOString().slice(0, 10);
}

function groupSumByDate(rows, field) {
  const m = new Map();
  for (const r of rows) {
    const key = dateKey(r.snapshotDate);
    m.set(key, (m.get(key) || 0) + (r[field] || 0));
  }
  return m;
}

function firstVsSecondHalfChangePct(rows, field) {
  const byDate = groupSumByDate(rows, field);
  const dates = [...byDate.keys()].sort();
  if (dates.length < 2) return null;
  const mid = Math.floor(dates.length / 2) || 1;
  const first = dates.slice(0, mid).reduce((s, d) => s + byDate.get(d), 0);
  const second = dates.slice(mid).reduce((s, d) => s + byDate.get(d), 0);
  if (!first) return null;
  return round2(((second - first) / first) * 100);
}

export function computeAggregates(snapshots, editEvents, productCost) {
  const campaignRows = snapshots.filter((s) => s.entityLevel === "campaign");
  const adsetRows = snapshots.filter((s) => s.entityLevel === "adset");
  const adRows = snapshots.filter((s) => s.entityLevel === "ad");
  // Fall back to whatever level was actually synced if campaign-level rows
  // aren't present yet (e.g. sync ran but campaign-level insights call
  // failed for some reason).
  const baseRows = campaignRows.length ? campaignRows : adsetRows.length ? adsetRows : adRows;

  const totals = baseRows.reduce(
    (acc, r) => {
      acc.spend += r.spend;
      acc.impressions += r.impressions;
      acc.clicks += r.clicks;
      acc.results += r.results || 0;
      return acc;
    },
    { spend: 0, impressions: 0, clicks: 0, results: 0 }
  );
  totals.spend = round2(totals.spend);
  totals.costPerResult = totals.results ? round2(totals.spend / totals.results) : null;

  const spendChangePct = firstVsSecondHalfChangePct(baseRows, "spend");
  const resultsChangePct = firstVsSecondHalfChangePct(baseRows, "results");
  const trend = {
    spendChangePct,
    resultsChangePct,
    direction: resultsChangePct === null ? "unknown" : resultsChangePct > 5 ? "up" : resultsChangePct < -5 ? "down" : "flat",
  };

  const editMap = new Map();
  for (const e of editEvents) {
    if (!editMap.has(e.entityId)) {
      editMap.set(e.entityId, { entityId: e.entityId, entityName: e.entityName, entityLevel: e.entityLevel, count: 0 });
    }
    editMap.get(e.entityId).count++;
  }
  const editCounts = [...editMap.values()].sort((a, b) => b.count - a.count);

  const formatsByCampaign = new Map();
  for (const r of adRows) {
    if (!r.creativeFormat) continue;
    if (!formatsByCampaign.has(r.campaignId)) {
      formatsByCampaign.set(r.campaignId, { campaignId: r.campaignId, campaignName: r.campaignName, formats: new Set() });
    }
    formatsByCampaign.get(r.campaignId).formats.add(r.creativeFormat);
  }
  const creativeFormats = [...formatsByCampaign.values()].map((c) => ({
    campaignId: c.campaignId,
    campaignName: c.campaignName,
    formats: [...c.formats],
  }));

  const adsetMap = new Map();
  for (const r of adsetRows) {
    if (!adsetMap.has(r.adsetId)) {
      adsetMap.set(r.adsetId, {
        adsetId: r.adsetId,
        adsetName: r.adsetName,
        spend: 0,
        results: 0,
        firstSeen: r.snapshotDate,
        lastSeen: r.snapshotDate,
      });
    }
    const a = adsetMap.get(r.adsetId);
    a.spend += r.spend;
    a.results += r.results || 0;
    if (new Date(r.snapshotDate) < new Date(a.firstSeen)) a.firstSeen = r.snapshotDate;
    if (new Date(r.snapshotDate) > new Date(a.lastSeen)) a.lastSeen = r.snapshotDate;
  }
  const totalAdsetSpend = [...adsetMap.values()].reduce((s, a) => s + a.spend, 0);
  const spendShareByAdset = [...adsetMap.values()]
    .map((a) => {
      const daysRunning = Math.max(1, Math.round((new Date(a.lastSeen) - new Date(a.firstSeen)) / 86400000) + 1);
      return {
        adsetId: a.adsetId,
        adsetName: a.adsetName,
        spend: round2(a.spend),
        sharePct: totalAdsetSpend ? round2((a.spend / totalAdsetSpend) * 100) : 0,
        daysRunning,
        results: a.results,
        tier: a.results >= 10 && daysRunning >= 3 ? "proven" : "testing",
      };
    })
    .sort((a, b) => b.spend - a.spend);

  return {
    totals,
    trend,
    editCounts,
    creativeFormats,
    spendShareByAdset,
    productCost: productCost
      ? {
          unitCostTHB: productCost.unitCostTHB,
          packagingShippingCostTHB: productCost.packagingShippingCostTHB,
          codFeePercent: productCost.codFeePercent,
          sellingPriceTHB: productCost.sellingPriceTHB,
        }
      : null,
  };
}
