"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchJson } from "../../lib/clientApi";

const EMPTY_COST = { productName: "", unitCostTHB: "", packagingShippingCostTHB: "0", codFeePercent: "0", sellingPriceTHB: "", notes: "" };

function fmt(n, decimals = 0) {
  if (n === null || n === undefined) return "—";
  return Number(n).toLocaleString("th-TH", { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
}

export default function ProfitPanel({ campaigns }) {
  const queryClient = useQueryClient();
  const [campaignId, setCampaignId] = useState("");
  const [days, setDays] = useState(30);
  const [cost, setCost] = useState(EMPTY_COST);
  const [ordersDraft, setOrdersDraft] = useState("");
  const [appliedOrdersOverride, setAppliedOrdersOverride] = useState(null);

  function selectCampaign(nextCampaignId) {
    setCampaignId(nextCampaignId);
    setCost(EMPTY_COST);
    setOrdersDraft("");
    setAppliedOrdersOverride(null);
  }

  const costQuery = useQuery({
    queryKey: ["ads", "product-cost", campaignId],
    queryFn: () => fetchJson(`/api/product-costs/${campaignId}`),
    enabled: Boolean(campaignId),
  });

  useEffect(() => {
    if (costQuery.data) {
      if (costQuery.data.productCost) {
        const saved = costQuery.data.productCost;
          setCost({
            productName: saved.productName,
            unitCostTHB: String(saved.unitCostTHB),
            packagingShippingCostTHB: String(saved.packagingShippingCostTHB),
            codFeePercent: String(saved.codFeePercent),
            sellingPriceTHB: String(saved.sellingPriceTHB),
            notes: saved.notes || "",
          });
      } else setCost(EMPTY_COST);
    }
  }, [costQuery.data]);

  const roiQuery = useQuery({
    queryKey: ["ads", "roi", campaignId, Number(days), appliedOrdersOverride],
    queryFn: () => {
    const params = new URLSearchParams({ campaignId, days: String(days) });
      if (appliedOrdersOverride !== null) params.set("ordersOverride", String(appliedOrdersOverride));
      return fetchJson(`/api/ads-roi?${params.toString()}`);
    },
    enabled: Boolean(campaignId),
  });
  const roi = roiQuery.data || null;

  useEffect(() => {
    if (roi && appliedOrdersOverride === null) setOrdersDraft(String(roi.orders));
  }, [roi, appliedOrdersOverride]);

  const saveMutation = useMutation({
    mutationFn: (payload) =>
      fetchJson("/api/product-costs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(["ads", "product-cost", campaignId], { productCost: data.productCost });
      queryClient.invalidateQueries({ queryKey: ["ads", "roi", campaignId] });
    },
  });

  async function saveCost() {
    if (!campaignId) return;
    saveMutation.mutate({ campaignId, ...cost });
  }

  return (
    <div>
      <div className="flex gap-2" style={{ flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
        <select value={campaignId} onChange={(e) => selectCampaign(e.target.value)} style={{ maxWidth: 260 }}>
          <option value="">เลือกแคมเปญ</option>
          {(campaigns || []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <label className="hint" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          ช่วง
          <input
            type="number"
            value={days}
            onChange={(e) => {
              setDays(e.target.value);
              setOrdersDraft("");
              setAppliedOrdersOverride(null);
            }}
            style={{ width: 60 }}
            min={1}
          />
          วัน
        </label>
      </div>

      {!campaignId && <div className="hint">เลือกแคมเปญเพื่อดูกำไร/ROI</div>}

      {campaignId && (
        <>
          <div className="scene-card" style={{ marginBottom: 16 }}>
            <div className="scene-card-head">
              <span className="scene-badge">ต้นทุน/ราคาขาย</span>
            </div>
            {costQuery.isPending && <div className="hint" style={{ marginTop: 8 }}>กำลังโหลดต้นทุน…</div>}
            {costQuery.isError && <div className="hint warn" style={{ marginTop: 8 }}>{costQuery.error.message}</div>}
            <label className="field-label" style={{ marginTop: 10 }}>ชื่อสินค้า</label>
            <input type="text" value={cost.productName} onChange={(e) => setCost({ ...cost, productName: e.target.value })} />
            <div className="row" style={{ marginTop: 10 }}>
              <div>
                <label className="field-label">ต้นทุนต่อชิ้น (฿)</label>
                <input
                  type="number"
                  value={cost.unitCostTHB}
                  onChange={(e) => setCost({ ...cost, unitCostTHB: e.target.value })}
                />
              </div>
              <div>
                <label className="field-label">ค่าแพ็ค/ส่งต่อชิ้น (฿)</label>
                <input
                  type="number"
                  value={cost.packagingShippingCostTHB}
                  onChange={(e) => setCost({ ...cost, packagingShippingCostTHB: e.target.value })}
                />
              </div>
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <div>
                <label className="field-label">ค่าธรรมเนียม COD (%)</label>
                <input
                  type="number"
                  value={cost.codFeePercent}
                  onChange={(e) => setCost({ ...cost, codFeePercent: e.target.value })}
                />
              </div>
              <div>
                <label className="field-label">ราคาขายต่อชิ้น (฿)</label>
                <input
                  type="number"
                  value={cost.sellingPriceTHB}
                  onChange={(e) => setCost({ ...cost, sellingPriceTHB: e.target.value })}
                />
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <button className="btn small" onClick={saveCost} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "กำลังบันทึก…" : "💾 บันทึกต้นทุน/ราคา"}
              </button>
              {saveMutation.isSuccess && <span className="status-pill ok" style={{ marginLeft: 10 }}>บันทึกแล้ว</span>}
              {saveMutation.isError && <span className="status-pill err" style={{ marginLeft: 10 }}>{saveMutation.error.message}</span>}
            </div>
          </div>

          {roiQuery.isPending && <div className="hint">กำลังคำนวณ…</div>}
          {roiQuery.isError && <div className="hint warn">{roiQuery.error.message}</div>}
          {roiQuery.isSuccess && roi && (
            <>
              <label className="field-label">
                จำนวนออเดอร์จริง (ค่าเริ่มต้นดึงจาก "ผลลัพธ์" ของแอด ซึ่งคือจำนวนแชทที่เริ่มคุย ไม่ใช่ยอดขายจริง — แก้ไขให้ตรงได้)
              </label>
              <div className="flex gap-2" style={{ alignItems: "center", marginBottom: 14 }}>
                <input
                  type="number"
                  value={ordersDraft}
                  onChange={(e) => setOrdersDraft(e.target.value)}
                  style={{ width: 100 }}
                />
                <button
                  className="btn small secondary"
                  onClick={() => setAppliedOrdersOverride(ordersDraft === "" ? null : Number(ordersDraft))}
                >
                  คำนวณใหม่
                </button>
              </div>

              {!roi.productCost && <div className="hint warn" style={{ marginBottom: 12 }}>ยังไม่ได้กรอกต้นทุน/ราคาขาย — แสดงได้แค่งบที่ใช้กับจำนวนออเดอร์เท่านั้น</div>}

              <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
                {[
                  { label: "งบที่ใช้", value: roi.spend, suffix: " ฿" },
                  { label: "ออเดอร์", value: roi.orders, suffix: "" },
                  { label: "รายได้", value: roi.revenue, suffix: " ฿" },
                  { label: "ต้นทุนรวม", value: roi.cogs, suffix: " ฿" },
                  { label: "กำไรสุทธิ", value: roi.grossProfit, suffix: " ฿" },
                  { label: "ROAS", value: roi.roas, suffix: "x", decimals: 2 },
                  { label: "อัตรากำไร", value: roi.profitMargin !== null ? roi.profitMargin * 100 : null, suffix: "%", decimals: 1 },
                  { label: "ต้นทุน/ออเดอร์", value: roi.costPerOrder, suffix: " ฿" },
                  { label: "จุดคุ้มทุน", value: roi.breakEvenOrders, suffix: " ออเดอร์", decimals: 1 },
                ].map((k) => (
                  <div key={k.label} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-faint)] mb-1">{k.label}</div>
                    <div className="font-[var(--font-display)] font-bold text-lg tabular-nums text-[var(--ink)]">
                      {fmt(k.value, k.decimals || 0)}
                      {k.value !== null && k.suffix}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
