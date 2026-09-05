"use client";

import { useEffect, useRef, useState } from "react";
import Logo from "../../components/Logo";
import Topbar from "../../components/Topbar";
import KpiStrip from "../../components/ads/KpiStrip";
import AdsTable from "../../components/ads/AdsTable";
import TrendChart from "../../components/ads/TrendChart";
import AnalysisPanel from "../../components/ads/AnalysisPanel";
import ProfitPanel from "../../components/ads/ProfitPanel";

const TABS = [
  { key: "insights", label: "📈 Insights" },
  { key: "analysis", label: "🧠 Analysis" },
  { key: "profit", label: "💰 Profit" },
];

const LEVELS = [
  { key: "campaign", label: "แคมเปญ" },
  { key: "adset", label: "ชุดโฆษณา" },
  { key: "ad", label: "โฆษณา" },
];

const DATE_PRESETS = [
  { key: "today", label: "วันนี้" },
  { key: "yesterday", label: "เมื่อวาน" },
  { key: "last_7d", label: "7 วันล่าสุด" },
  { key: "last_30d", label: "30 วันล่าสุด" },
];

export default function AdsDashboardPage() {
  const [tab, setTab] = useState("insights");
  const [level, setLevel] = useState("campaign");
  const [datePreset, setDatePreset] = useState("last_7d");
  const [campaignId, setCampaignId] = useState("");
  const [campaigns, setCampaigns] = useState([]);
  const [campaignsStatus, setCampaignsStatus] = useState("loading");

  const [status, setStatus] = useState("loading"); // loading | ok | err
  const [msg, setMsg] = useState("");
  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState(null);

  const [syncStatus, setSyncStatus] = useState(null); // null | syncing | ok | err
  const [syncMsg, setSyncMsg] = useState("");
  const insightsRequest = useRef(0);

  async function loadInsights() {
    const requestId = ++insightsRequest.current;
    setStatus("loading");
    try {
      const params = new URLSearchParams({ level, datePreset });
      if (campaignId) params.set("campaignId", campaignId);
      const res = await fetch(`/api/ads-insights?${params.toString()}`);
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "ดึงข้อมูลไม่สำเร็จ");
      if (requestId !== insightsRequest.current) return;
      setRows(data.rows || []);
      setTotals(data.totals || null);
      setStatus("ok");

    } catch (e) {
      if (requestId !== insightsRequest.current) return;
      setStatus("err");
      setMsg(String(e.message || e));
    }
  }

  useEffect(() => {
    loadInsights();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, datePreset, campaignId]);

  useEffect(() => {
    let active = true;
    fetch("/api/ads-campaigns")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || "โหลดรายชื่อแคมเปญไม่สำเร็จ");
        return data;
      })
      .then((data) => {
        if (!active) return;
        setCampaigns(data.campaigns || []);
        setCampaignsStatus("ok");
      })
      .catch(() => {
        if (!active) return;
        setCampaigns([]);
        setCampaignsStatus("err");
      });
    return () => {
      active = false;
    };
  }, []);

  async function syncNow() {
    setSyncStatus("syncing");
    setSyncMsg("");
    try {
      const res = await fetch("/api/ads-sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "ซิงค์ไม่สำเร็จ");
      setSyncStatus("ok");
      setSyncMsg(`ซิงค์แล้ว ${data.upserted.snapshots} snapshot, ${data.upserted.editEvents} เหตุการณ์แก้ไข`);
      loadInsights();
    } catch (e) {
      setSyncStatus("err");
      setSyncMsg(String(e.message || e));
    }
  }

  return (
    <>
      <Topbar />
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "48px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <span style={{ color: "var(--accent)" }}>
            <Logo size={32} />
          </span>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 22 }}>Ads Dashboard</h1>
        </div>
        <p className="hint" style={{ marginBottom: 20 }}>
          ดูผลลัพธ์แคมเปญจริง วิเคราะห์จุดบอด และคำนวณกำไร — ทั้งหมดเป็นการอ่านข้อมูลเท่านั้น ไม่มีการเปิดใช้งานแคมเปญอัตโนมัติ
        </p>

        <div className="flex gap-2" style={{ marginBottom: 16 }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className="btn small secondary"
              style={tab === t.key ? { borderColor: "var(--accent-5)", color: "var(--accent-5)" } : undefined}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "insights" && (
          <div className="stage unlocked">
            <div className="flex gap-2" style={{ flexWrap: "wrap", marginBottom: 14, alignItems: "center" }}>
              {LEVELS.map((l) => (
                <button
                  key={l.key}
                  type="button"
                  className="btn small secondary"
                  style={level === l.key ? { borderColor: "var(--accent-5)", color: "var(--accent-5)" } : undefined}
                  onClick={() => setLevel(l.key)}
                >
                  {l.label}
                </button>
              ))}
              <span style={{ width: 1, height: 20, background: "var(--border)", margin: "0 4px" }} />
              {DATE_PRESETS.map((d) => (
                <button
                  key={d.key}
                  type="button"
                  className="btn small secondary"
                  style={datePreset === d.key ? { borderColor: "var(--accent-5)", color: "var(--accent-5)" } : undefined}
                  onClick={() => setDatePreset(d.key)}
                >
                  {d.label}
                </button>
              ))}
              {campaigns.length > 0 && (
                <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} style={{ maxWidth: 220 }}>
                  <option value="">ทุกแคมเปญ</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
              {campaignsStatus === "err" && <span className="hint warn">โหลดรายชื่อแคมเปญไม่ได้</span>}
              <button className="btn small" onClick={syncNow} disabled={syncStatus === "syncing"} style={{ marginLeft: "auto" }}>
                {syncStatus === "syncing" ? "กำลังซิงค์…" : "🔄 ซิงค์ข้อมูลล่าสุด"}
              </button>
            </div>
            {syncStatus === "ok" && <div className="status-pill ok" style={{ marginBottom: 12 }}>{syncMsg}</div>}
            {syncStatus === "err" && <div className="status-pill err" style={{ marginBottom: 12 }}>{syncMsg}</div>}

            {status === "loading" && <div className="hint">กำลังโหลดข้อมูล…</div>}
            {status === "err" && <div className="hint warn">{msg}</div>}
            {status === "ok" && (
              <>
                <KpiStrip totals={totals} />
                <div style={{ marginTop: 20, marginBottom: 20 }}>
                  <TrendChart rows={rows} metric="spend" label="งบที่ใช้ต่อวัน (฿)" decimals={0} />
                </div>
                <AdsTable rows={rows} level={level} />
              </>
            )}
          </div>
        )}

        {tab === "analysis" && (
          <div className="stage unlocked">
            <AnalysisPanel campaigns={campaigns} />
          </div>
        )}

        {tab === "profit" && (
          <div className="stage unlocked">
            <ProfitPanel campaigns={campaigns} />
          </div>
        )}
      </div>
    </>
  );
}
