import test from "node:test";
import assert from "node:assert/strict";
import { computeAggregates } from "../app/lib/adAnalysisAggregate.js";
import { computeRoi } from "../app/lib/roi.js";

test("account aggregates do not add incompatible result types", () => {
  const snapshots = [
    { entityLevel: "campaign", snapshotDate: "2026-09-01", spend: 100, impressions: 1000, clicks: 20, results: 5, resultType: "messages" },
    { entityLevel: "campaign", snapshotDate: "2026-09-01", spend: 50, impressions: 500, clicks: 10, results: 200, resultType: "thruplay" },
  ];
  const { totals, trend } = computeAggregates(snapshots, [], null);
  assert.equal(totals.hasMixedResultTypes, true);
  assert.equal(totals.results, null);
  assert.equal(totals.costPerResult, null);
  assert.equal(trend.resultsChangePct, null);
  assert.deepEqual(totals.resultsByType, { messages: 5, thruplay: 200 });
});

test("ROI includes unit, shipping, COD, and ad costs", () => {
  const roi = computeRoi({
    spend: 1000,
    orders: 20,
    unitCostTHB: 50,
    packagingShippingCostTHB: 10,
    codFeePercent: 2,
    sellingPriceTHB: 150,
  });
  assert.equal(roi.revenue, 3000);
  assert.equal(roi.cogs, 1260);
  assert.equal(roi.grossProfit, 740);
  assert.equal(roi.roas, 3);
});
