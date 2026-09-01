"use client";

import { useEffect, useState } from "react";
import { upload } from "@vercel/blob/client";
import Logo from "../components/Logo";
import Topbar from "../components/Topbar";

const EMPTY_CONFIG = {
  campaignName: "",
  pageId: "",
  dailyBudgetTHB: 350,
  ageMin: 20,
  ageMax: 65,
  genders: "all",
};

export default function AdsPage() {
  const [step, setStep] = useState(1);
  const [pages, setPages] = useState([]);
  const [pagesStatus, setPagesStatus] = useState("loading");
  const [pagesMsg, setPagesMsg] = useState("");
  const [config, setConfig] = useState(EMPTY_CONFIG);
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState(null); // null | uploading | creating | ok | err
  const [msg, setMsg] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    fetch("/api/facebook-pages")
      .then((r) => r.json())
      .then((d) => {
        if (d.pages) {
          setPages(d.pages);
          setPagesStatus("ok");
          if (d.pages.length) setConfig((c) => ({ ...c, pageId: d.pages[0].id }));
        } else {
          setPagesStatus("err");
          setPagesMsg(d.error || "ดึงรายชื่อเพจไม่สำเร็จ");
        }
      })
      .catch((e) => {
        setPagesStatus("err");
        setPagesMsg(String(e.message || e));
      });
  }, []);

  function setField(field, value) {
    setConfig((c) => ({ ...c, [field]: value }));
  }

  const step1Valid = config.campaignName.trim() && config.pageId && Number(config.dailyBudgetTHB) > 0;

  async function createDraft() {
    if (!file || !message.trim()) return;
    setStatus("uploading");
    setMsg("");
    try {
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/blob-upload",
      });

      setStatus("creating");
      const res = await fetch("/api/ads-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignName: config.campaignName,
          pageId: config.pageId,
          dailyBudgetTHB: Number(config.dailyBudgetTHB),
          countries: ["TH"],
          ageMin: Number(config.ageMin),
          ageMax: Number(config.ageMax),
          genders: config.genders,
          videoUrl: blob.url,
          message,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "สร้างแคมเปญไม่สำเร็จ");
      setStatus("ok");
      setResult(data);
    } catch (e) {
      setStatus("err");
      setMsg(String(e.message || e));
    }
  }

  return (
    <>
      <Topbar />
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "48px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <span style={{ color: "var(--accent-5)" }}>
            <Logo size={32} />
          </span>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 22 }}>ยิงแอด Facebook</h1>
        </div>
        <p className="hint" style={{ marginBottom: 20 }}>
          สร้างแคมเปญ + ชุดโฆษณา + โฆษณา ให้อัตโนมัติตามรูปแบบที่เคยยิงได้ผล (การมีส่วนร่วม → Messenger) — ทุกอย่างถูกสร้างเป็น
          <strong> สถานะหยุดชั่วคราว (ร่าง) เสมอ ไม่ใช้งบจนกว่าคุณจะกดเปิดใช้งานเองใน Ads Manager</strong>
        </p>

        <div className="flex gap-2" style={{ marginBottom: 16 }}>
          <span
            className="btn small secondary"
            style={step === 1 ? { borderColor: "var(--accent-5)", color: "var(--accent-5)" } : undefined}
          >
            1. แคมเปญ + กลุ่มเป้าหมาย
          </span>
          <span
            className="btn small secondary"
            style={step === 2 ? { borderColor: "var(--accent-5)", color: "var(--accent-5)" } : undefined}
          >
            2. ครีเอทีฟ + สร้างร่าง
          </span>
        </div>

        {step === 1 && (
          <div className="stage unlocked">
            <label className="field-label">ชื่อแคมเปญ</label>
            <input
              type="text"
              value={config.campaignName}
              onChange={(e) => setField("campaignName", e.target.value)}
              placeholder="เช่น แคมเปญกรรไกร - กันยายน"
            />

            <label className="field-label" style={{ marginTop: 14 }}>
              เพจที่จะโฆษณา
            </label>
            {pagesStatus === "loading" && <div className="hint">กำลังโหลดรายชื่อเพจ…</div>}
            {pagesStatus === "err" && <div className="hint warn">{pagesMsg}</div>}
            {pagesStatus === "ok" && pages.length > 0 && (
              <select value={config.pageId} onChange={(e) => setField("pageId", e.target.value)}>
                {pages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}

            <label className="field-label" style={{ marginTop: 14 }}>
              งบประมาณต่อวัน (บาท)
            </label>
            <input
              type="number"
              value={config.dailyBudgetTHB}
              onChange={(e) => setField("dailyBudgetTHB", e.target.value)}
              min={20}
            />

            <div className="row" style={{ marginTop: 14 }}>
              <div>
                <label className="field-label">อายุต่ำสุด</label>
                <input type="number" value={config.ageMin} onChange={(e) => setField("ageMin", e.target.value)} min={13} max={65} />
              </div>
              <div>
                <label className="field-label">อายุสูงสุด</label>
                <input type="number" value={config.ageMax} onChange={(e) => setField("ageMax", e.target.value)} min={13} max={65} />
              </div>
            </div>

            <label className="field-label" style={{ marginTop: 14 }}>
              เพศ
            </label>
            <div className="flex gap-2">
              {[
                { value: "all", label: "ทั้งหมด" },
                { value: "male", label: "ชาย" },
                { value: "female", label: "หญิง" },
              ].map((g) => (
                <button
                  key={g.value}
                  type="button"
                  className="btn small secondary"
                  style={config.genders === g.value ? { borderColor: "var(--accent-5)", color: "var(--accent-5)" } : undefined}
                  onClick={() => setField("genders", g.value)}
                >
                  {g.label}
                </button>
              ))}
            </div>
            <div className="hint">กลุ่มเป้าหมายพื้นที่ล็อกไว้ที่ประเทศไทย ตรงกับแคมเปญที่เคยยิงมา</div>

            <div style={{ marginTop: 18 }}>
              <button className="btn" onClick={() => setStep(2)} disabled={!step1Valid}>
                ถัดไป: ครีเอทีฟ →
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="stage unlocked">
            <button type="button" className="btn small secondary" style={{ marginBottom: 14 }} onClick={() => setStep(1)}>
              ← กลับไปแก้แคมเปญ
            </button>

            <label className="field-label">ไฟล์วิดีโอโฆษณา</label>
            <input type="file" accept="video/*" onChange={(e) => setFile(e.target.files[0] || null)} />

            <label className="field-label" style={{ marginTop: 14 }}>
              ข้อความโฆษณา
            </label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} />

            <div className="scene-card" style={{ marginTop: 14 }}>
              <div className="scene-card-head">
                <span className="scene-badge">สรุปก่อนสร้าง</span>
              </div>
              <div className="hint">
                {config.campaignName || "(ยังไม่ตั้งชื่อ)"} · งบ {config.dailyBudgetTHB} บาท/วัน · อายุ {config.ageMin}-
                {config.ageMax} · {config.genders === "all" ? "ทุกเพศ" : config.genders === "male" ? "ชาย" : "หญิง"} · ปลายทาง
                Messenger
              </div>
            </div>

            <div style={{ marginTop: 18 }}>
              <button
                className="btn"
                onClick={createDraft}
                disabled={!file || !message.trim() || status === "uploading" || status === "creating"}
              >
                {status === "uploading"
                  ? "กำลังอัปโหลดวิดีโอ…"
                  : status === "creating"
                    ? "กำลังสร้างแคมเปญ (ร่าง)…"
                    : "🧾 สร้างแคมเปญ (ร่าง — ยังไม่ใช้งบ)"}
              </button>
            </div>
            {status === "err" && (
              <div className="status-pill err" style={{ marginTop: 12 }}>
                {msg}
              </div>
            )}
            {status === "ok" && result && (
              <div className="status-pill ok" style={{ marginTop: 12, display: "block" }}>
                สร้างร่างแคมเปญสำเร็จ (campaign id: {result.campaignId}) — ยังเป็นสถานะหยุดชั่วคราว ไม่ใช้งบ
                <br />
                <a href={result.manageUrl} target="_blank" rel="noreferrer" style={{ fontWeight: 700 }}>
                  เปิดใน Ads Manager เพื่อตรวจสอบและเปิดใช้งานเอง →
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
