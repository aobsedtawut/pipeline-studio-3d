// Pure profit/ROI math — no Facebook or Prisma imports, so it's easy to
// hand-verify (see the plan's Phase 3 verification example: spend=1000,
// orders=20, unitCost=50, sellingPrice=150 -> profit=1000, roas=3.0).
export function computeRoi({ spend, orders, unitCostTHB, packagingShippingCostTHB = 0, codFeePercent = 0, sellingPriceTHB }) {
  const revenue = sellingPriceTHB * orders;
  const codFeePerUnit = (sellingPriceTHB * codFeePercent) / 100;
  const cogs = (unitCostTHB + packagingShippingCostTHB + codFeePerUnit) * orders;
  const grossProfit = revenue - cogs - spend;
  const roas = spend ? revenue / spend : null;
  const profitMargin = revenue ? grossProfit / revenue : null;
  const costPerOrder = orders ? spend / orders : null;
  const marginPerUnit = sellingPriceTHB - unitCostTHB - packagingShippingCostTHB - codFeePerUnit;
  const breakEvenOrders = marginPerUnit > 0 ? spend / marginPerUnit : null;

  return { revenue, cogs, grossProfit, roas, profitMargin, costPerOrder, breakEvenOrders };
}
