"use client";

import { useEffect, useState } from "react";

const SEVERITY_PILL = { high: "status-pill err", medium: "status-pill pending", low: "status-pill ok" };
const GOAL_STORAGE_KEY = "pipeline-studio:dailyOrderGoal";

export default function AnalysisPanel({ campaigns }) {
  const [scope, setScope] = useState("account");
  const [campaignId, setCampaignId] = useState("");
  const [lookbackDays, setLookbackDays] = useState(7);
  const [dailyOrderGoal, setDailyOrderGoal] = useState(100);

  const [status, setStatus] = useState(null); // null | running | ok | err
  const [msg, setMsg] = useState("");
  const [result, setResult] = useState(null);

  const [history, setHistory] = useState([]);
  const [historyStatus, setHistoryStatus] = useState("loading");
  const [selected, setSelected] = useState(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(GOAL_STORAGE_KEY);
      if (saved) setDailyOrderGoal(Number(saved));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(GOAL_STORAGE_KEY, String(dailyOrderGoal));
    } catch {}
  }, [dailyOrderGoal]);

  async function loadHistory() {
    setHistoryStatus("loading");
    const params = new URLSearchParams({ take: "20" });
    if (scope === "campaign" && campaignId) params.set("campaignId", campaignId);
    try {
      const res = await fetch(`/api/ads-analysis?${params.toString()}`);
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "โหลดประวัติไม่สำเร็จ");
      setHistory(data.analyses || []);
      setHistoryStatus("ok");
    } catch {
      setHistory([]);
      setHistoryStatus("err");
    }
  }

  useEffect(loadHistory, [scope, campaignId]);

  async function runAnalysis() {
    if (scope === "campaign" && !campaignId) {
      setStatus("err");
      setMsg("เลือกแคมเปญก่อน");
      return;
    }
    setStatus("running");
    setMsg("");
    setResult(null);
    try {
      const res = await fetch("/api/ads-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope,
          campaignId: scope === "campaign" ? campaignId : undefined,
          lookbackDays: Number(lookbackDays),
          dailyOrderGoal: Number(dailyOrderGoal),
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "วิเคราะห์ไม่สำเร็จ");
      setResult(data.analysis);
      setStatus("ok");
      loadHistory();
    } catch (e) {
      setStatus("err");
      setMsg(String(e.message || e));
    }
  }

  async function openHistoryItem(id) {
    try {
      const res = await fetch(`/api/ads-analysis/${id}`);
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "เปิดผลวิเคราะห์ไม่สำเร็จ");
      if (data.analysis) {
        setSelected(data.analysis);
        setResult(null);
        setNote(data.analysis.userNote || "");
      }
    } catch (e) {
      setStatus("err");
      setMsg(String(e.message || e));
    }
  }

  async function saveNote(id, newStatus) {
    try {
      const res = await fetch(`/api/ads-analysis/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userNote: note, ...(newStatus ? { status: newStatus } : {}) }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      setSelected(data.analysis);
      setStatus("ok");
      loadHistory();
    } catch (e) {
      setStatus("err");
      setMsg(String(e.message || e));
    }
  }

  const shown = result || selected;

  return (
    <div>
      <div className="flex gap-2" style={{ flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        {[
          { value: "account", label: "ทั้งบัญชี" },
          { value: "campaign", label: "รายแคมเปญ" },
        ].map((s) => (
          <button
            key={s.value}
            type="button"
            className="btn small secondary"
            style={scope === s.value ? { borderColor: "var(--accent-5)", color: "var(--accent-5)" } : undefined}
            onClick={() => setScope(s.value)}
          >
            {s.label}
          </button>
        ))}
        {scope === "campaign" && (
          <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} style={{ maxWidth: 220 }}>
            <option value="">เลือกแคมเปญ</option>
            {(campaigns || []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
        <label className="hint" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          ย้อนหลัง
          <input
            type="number"
            value={lookbackDays}
            onChange={(e) => setLookbackDays(e.target.value)}
            style={{ width: 60 }}
            min={1}
            max={30}
          />
          วัน
        </label>
        <label className="hint" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          เป้าหมาย
          <input
            type="number"
            value={dailyOrderGoal}
            onChange={(e) => setDailyOrderGoal(e.target.value)}
            style={{ width: 70 }}
            min={1}
          />
          ออเดอร์/วัน
        </label>
        <button className="btn small" onClick={runAnalysis} disabled={status === "running"}>
          {status === "running" ? "กำลังวิเคราะห์…" : "🧠 วิเคราะห์ตอนนี้"}
        </button>
      </div>

      {status === "err" && <div className="hint warn" style={{ marginBottom: 12 }}>{msg}</div>}

      {shown && (
        <div className="scene-card" style={{ marginBottom: 20 }}>
          <div className="scene-card-head">
            <span className="scene-badge">
              สุขภาพแคมเปญ: {shown.healthScore ?? "—"}/100
            </span>
          </div>
          <p style={{ margin: "8px 0" }}>{shown.summary}</p>

          {shown.blindSpots?.length > 0 && (
            <>
              <div className="field-label" style={{ marginTop: 10 }}>จุดบอดที่พบ</div>
              <div className="flex flex-col gap-2" style={{ marginTop: 6 }}>
                {shown.blindSpots.map((b, i) => (
                  <div key={i} className="scene-card">
                    <div className="scene-card-head">
                      <span className={SEVERITY_PILL[b.severity] || "status-pill pending"}>{b.severity}</span>
                      <span style={{ fontWeight: 700 }}>{b.title}</span>
                    </div>
                    <div className="hint" style={{ marginTop: 4 }}>{b.detail}</div>
                    {b.evidence && <div className="hint" style={{ marginTop: 2, fontStyle: "italic" }}>อ้างอิง: {b.evidence}</div>}
                  </div>
                ))}
              </div>
            </>
          )}

          {shown.recommendedActions?.length > 0 && (
            <>
              <div className="field-label" style={{ marginTop: 14 }}>คำแนะนำ</div>
              <div className="flex flex-col gap-2" style={{ marginTop: 6 }}>
                {shown.recommendedActions.map((a, i) => (
                  <div key={i} className="scene-card">
                    <div className="scene-card-head">
                      <span className="scene-badge">{a.priority}</span>
                      <span style={{ fontWeight: 700 }}>{a.title}</span>
                    </div>
                    <div className="hint" style={{ marginTop: 4 }}>{a.detail}</div>
                    {a.rationale && <div className="hint" style={{ marginTop: 2, fontStyle: "italic" }}>เหตุผล: {a.rationale}</div>}
                  </div>
                ))}
              </div>
            </>
          )}

          {shown.budgetPlan && (
            <>
              <div className="field-label" style={{ marginTop: 14 }}>แผนงบประมาณแนะนำ</div>
              <div className="hint" style={{ marginTop: 4 }}>
                Proven {shown.budgetPlan.provenSharePct}% / Testing {shown.budgetPlan.testingSharePct}% — {shown.budgetPlan.note}
              </div>
            </>
          )}

          {selected && (
            <>
              <div className="field-label" style={{ marginTop: 14 }}>โน้ตของคุณ</div>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
              <div className="flex gap-2" style={{ marginTop: 8 }}>
                <button className="btn small secondary" onClick={() => saveNote(selected.id)}>
                  บันทึกโน้ต
                </button>
                <button className="btn small secondary" onClick={() => saveNote(selected.id, "reviewed")}>
                  ✓ ทบทวนแล้ว
                </button>
                <button className="btn small secondary" onClick={() => saveNote(selected.id, "applied")}>
                  ✓ ทำตามแล้ว
                </button>
                <button className="btn small secondary" onClick={() => saveNote(selected.id, "dismissed")}>
                  ✕ ไม่ใช้
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <div className="field-label">ประวัติการวิเคราะห์</div>
      {historyStatus === "loading" && <div className="hint">กำลังโหลด…</div>}
      {historyStatus === "err" && <div className="hint warn">โหลดประวัติไม่ได้ — ยังไม่ได้ตั้งค่า DATABASE_URL หรือฐานข้อมูลไม่พร้อม</div>}
      {historyStatus === "ok" && history.length === 0 && <div className="hint">ยังไม่มีประวัติการวิเคราะห์</div>}
      <div className="flex flex-col gap-2" style={{ marginTop: 8 }}>
        {history.map((h) => (
          <button
            key={h.id}
            onClick={() => openHistoryItem(h.id)}
            className="text-left scene-card hover:border-[var(--accent)] transition-colors"
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 600 }}>{h.summary?.slice(0, 60) || "(ไม่มีสรุป)"}</span>
              <span className="status-pill pending">{h.status}</span>
            </div>
            <div className="hint">
              {new Date(h.createdAt).toLocaleString("th-TH")} · สุขภาพ {h.healthScore ?? "—"}/100
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
