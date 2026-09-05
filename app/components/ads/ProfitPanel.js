"use client";

import { useEffect, useState } from "react";

const EMPTY_COST = { productName: "", unitCostTHB: "", packagingShippingCostTHB: "0", codFeePercent: "0", sellingPriceTHB: "", notes: "" };

function fmt(n, decimals = 0) {
  if (n === null || n === undefined) return "—";
  return Number(n).toLocaleString("th-TH", { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
}

export default function ProfitPanel({ campaigns }) {
  const [campaignId, setCampaignId] = useState("");
  const [days, setDays] = useState(30);
  const [cost, setCost] = useState(EMPTY_COST);
  const [saveStatus, setSaveStatus] = useState(null); // null | saving | ok | err
  const [roi, setRoi] = useState(null);
  const [roiStatus, setRoiStatus] = useState("idle"); // idle | loading | ok | err
  const [ordersOverride, setOrdersOverride] = useState("");

  function selectCampaign(nextCampaignId) {
    setCampaignId(nextCampaignId);
    setCost(EMPTY_COST);
    setRoi(null);
    setRoiStatus(nextCampaignId ? "loading" : "idle");
    setOrdersOverride("");
    setSaveStatus(null);
  }

  useEffect(() => {
    if (!campaignId) return;
    fetch(`/api/product-costs/${campaignId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.productCost) {
          setCost({
            productName: d.productCost.productName,
            unitCostTHB: String(d.productCost.unitCostTHB),
            packagingShippingCostTHB: String(d.productCost.packagingShippingCostTHB),
            codFeePercent: String(d.productCost.codFeePercent),
            sellingPriceTHB: String(d.productCost.sellingPriceTHB),
            notes: d.productCost.notes || "",
          });
        } else {
          setCost(EMPTY_COST);
        }
      });
  }, [campaignId]);

  function loadRoi() {
    if (!campaignId) return;
    setRoiStatus("loading");
    const params = new URLSearchParams({ campaignId, days: String(days) });
    if (ordersOverride !== "") params.set("ordersOverride", ordersOverride);
    fetch(`/api/ads-roi?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) throw new Error(d.error || "โหลดข้อมูลไม่สำเร็จ");
        setRoi(d);
        if (ordersOverride === "") setOrdersOverride(String(d.orders));
        setRoiStatus("ok");
      })
      .catch(() => setRoiStatus("err"));
  }

  useEffect(() => {
    loadRoi();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, days]);

  async function saveCost() {
    if (!campaignId) return;
    setSaveStatus("saving");
    try {
      const res = await fetch("/api/product-costs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, ...cost }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      setSaveStatus("ok");
      loadRoi();
    } catch {
      setSaveStatus("err");
    }
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
          <input type="number" value={days} onChange={(e) => setDays(e.target.value)} style={{ width: 60 }} min={1} />
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
              <button className="btn small" onClick={saveCost} disabled={saveStatus === "saving"}>
                {saveStatus === "saving" ? "กำลังบันทึก…" : "💾 บันทึกต้นทุน/ราคา"}
              </button>
              {saveStatus === "ok" && <span className="status-pill ok" style={{ marginLeft: 10 }}>บันทึกแล้ว</span>}
              {saveStatus === "err" && <span className="status-pill err" style={{ marginLeft: 10 }}>บันทึกไม่สำเร็จ</span>}
            </div>
          </div>

          {roiStatus === "loading" && <div className="hint">กำลังคำนวณ…</div>}
          {roiStatus === "err" && (
            <div className="hint warn">ยังไม่ได้ตั้งค่า DATABASE_URL หรือดึงข้อมูลไม่สำเร็จ — ฟีเจอร์นี้ต้องมีฐานข้อมูลเสมอ</div>
          )}
          {roiStatus === "ok" && roi && (
            <>
              <label className="field-label">
                จำนวนออเดอร์จริง (ค่าเริ่มต้นดึงจาก "ผลลัพธ์" ของแอด ซึ่งคือจำนวนแชทที่เริ่มคุย ไม่ใช่ยอดขายจริง — แก้ไขให้ตรงได้)
              </label>
              <div className="flex gap-2" style={{ alignItems: "center", marginBottom: 14 }}>
                <input
                  type="number"
                  value={ordersOverride}
                  onChange={(e) => setOrdersOverride(e.target.value)}
                  style={{ width: 100 }}
                />
                <button className="btn small secondary" onClick={loadRoi}>คำนวณใหม่</button>
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
