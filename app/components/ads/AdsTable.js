"use client";

const STATUS_PILL_CLASS = {
  ACTIVE: "status-pill ok",
  PAUSED: "status-pill pending",
  CAMPAIGN_PAUSED: "status-pill pending",
  ADSET_PAUSED: "status-pill pending",
  DISAPPROVED: "status-pill err",
  PENDING_REVIEW: "status-pill pending",
};

function fmt(n, decimals = 0) {
  if (n === null || n === undefined) return "—";
  return Number(n).toLocaleString("th-TH", { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
}

// Rows come in per-day from /api/ads-insights (time_increment=1) — group
// them into one row per entity for a scannable table; the trend chart
// consumes the per-day shape separately.
function aggregateByEntity(rows, level) {
  const idKey = level === "campaign" ? "campaignId" : level === "adset" ? "adsetId" : "adId";
  const nameKey = level === "campaign" ? "campaignName" : level === "adset" ? "adsetName" : "adName";
  const map = new Map();
  for (const r of rows) {
    const id = r[idKey];
    if (!id) continue;
    if (!map.has(id)) {
      map.set(id, {
        id,
        name: r[nameKey],
        campaignName: r.campaignName,
        effectiveStatus: r.effectiveStatus,
        spend: 0,
        impressions: 0,
        clicks: 0,
        results: 0,
        hasResultsMetric: false,
      });
    }
    const agg = map.get(id);
    agg.spend += r.spend;
    agg.impressions += r.impressions;
    agg.clicks += r.clicks;
    if (r.results !== null && r.results !== undefined) {
      agg.results += r.results;
      agg.hasResultsMetric = true;
    }
    agg.effectiveStatus = r.effectiveStatus || agg.effectiveStatus;
  }
  return [...map.values()]
    .map((a) => ({
      ...a,
      ctr: a.impressions ? (a.clicks / a.impressions) * 100 : null,
      cpm: a.impressions ? (a.spend / a.impressions) * 1000 : null,
      results: a.hasResultsMetric ? a.results : null,
      costPerResult: a.hasResultsMetric && a.results ? a.spend / a.results : null,
    }))
    .sort((a, b) => b.spend - a.spend);
}

export default function AdsTable({ rows, level }) {
  const entities = aggregateByEntity(rows || [], level);

  if (!entities.length) {
    return <div className="hint">ยังไม่มีข้อมูลในช่วงเวลานี้</div>;
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left" }}>
            <th style={{ padding: "8px 10px" }}>ชื่อ</th>
            {level !== "campaign" && <th style={{ padding: "8px 10px" }}>แคมเปญ</th>}
            <th style={{ padding: "8px 10px" }}>สถานะ</th>
            <th style={{ padding: "8px 10px", textAlign: "right" }}>งบที่ใช้</th>
            <th style={{ padding: "8px 10px", textAlign: "right" }}>CTR</th>
            <th style={{ padding: "8px 10px", textAlign: "right" }}>CPM</th>
            <th style={{ padding: "8px 10px", textAlign: "right" }}>ผลลัพธ์</th>
            <th style={{ padding: "8px 10px", textAlign: "right" }}>ต้นทุน/ผลลัพธ์</th>
          </tr>
        </thead>
        <tbody>
          {entities.map((e) => (
            <tr key={e.id} style={{ borderBottom: "1px solid var(--border)" }}>
              <td style={{ padding: "8px 10px", fontWeight: 600 }}>{e.name}</td>
              {level !== "campaign" && <td style={{ padding: "8px 10px", color: "var(--ink-faint)" }}>{e.campaignName}</td>}
              <td style={{ padding: "8px 10px" }}>
                <span className={STATUS_PILL_CLASS[e.effectiveStatus] || "status-pill pending"}>
                  {e.effectiveStatus || "—"}
                </span>
              </td>
              <td style={{ padding: "8px 10px", textAlign: "right" }}>{fmt(e.spend)} ฿</td>
              <td style={{ padding: "8px 10px", textAlign: "right" }}>{e.ctr ? fmt(e.ctr, 2) + "%" : "—"}</td>
              <td style={{ padding: "8px 10px", textAlign: "right" }}>{e.cpm ? fmt(e.cpm, 1) + " ฿" : "—"}</td>
              <td style={{ padding: "8px 10px", textAlign: "right" }}>{fmt(e.results)}</td>
              <td style={{ padding: "8px 10px", textAlign: "right" }}>{e.costPerResult ? fmt(e.costPerResult, 1) + " ฿" : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
