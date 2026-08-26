"use client";

import { useState } from "react";
import Stage from "./Stage";

// Current (approximate) organic sweet spots — verify against each platform's
// live guidance before treating these as authoritative; they change.
const SPECS = [
  { key: "tiktok", label: "TikTok", sweetMin: 21, sweetMax: 34, hardMax: 600 },
  { key: "reels", label: "Instagram Reels", sweetMin: 15, sweetMax: 30, hardMax: 90 },
  { key: "shorts", label: "YouTube Shorts", sweetMin: 15, sweetMax: 60, hardMax: 180 },
];

export default function ExportStage({ unlocked, videoBlob, videoUrl, duration, onDone, done }) {
  const [downloaded, setDownloaded] = useState({});

  function download(platformKey) {
    if (!videoBlob) return;
    const a = document.createElement("a");
    a.href = videoUrl;
    a.download = `clip_${platformKey}.webm`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setDownloaded((d) => ({ ...d, [platformKey]: true }));
  }

  const allDownloaded = SPECS.every((s) => downloaded[s.key]);

  return (
    <Stage
      num={6}
      character="export"
      accent="--accent-5"
      title="Export"
      sub="ตรวจความยาวเทียบแต่ละแพลตฟอร์ม แล้วดาวน์โหลดไฟล์สำหรับโพสต์"
      unlocked={unlocked}
    >
      {duration && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
          {SPECS.map((s) => {
            const inSweet = duration >= s.sweetMin && duration <= s.sweetMax;
            const overHard = duration > s.hardMax;
            return (
              <div key={s.key} className="scene-card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <strong style={{ fontFamily: "var(--font-display)" }}>{s.label}</strong>
                  <div className="hint">
                    ความยาว {duration.toFixed(1)}s · sweet spot ~{s.sweetMin}-{s.sweetMax}s (ประมาณการ, เช็คของจริงอีกที)
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {overHard ? (
                    <span className="status-pill err">เกินขีดจำกัด</span>
                  ) : inSweet ? (
                    <span className="status-pill ok">อยู่ในช่วงที่ดี</span>
                  ) : (
                    <span className="status-pill pending">นอก sweet spot แต่โพสต์ได้</span>
                  )}
                  <button className="btn small secondary" onClick={() => download(s.key)} disabled={!videoBlob}>
                    {downloaded[s.key] ? "✓ ดาวน์โหลดแล้ว" : "ดาวน์โหลด .webm"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="hint" style={{ marginTop: 14 }}>
        ไฟล์ export เป็น .webm (VP9/Opus) — เล่นได้ปกติและอัปโหลดได้กับแพลตฟอร์มส่วนใหญ่ ยังไม่มีการแปลงเป็น .mp4
        อัตโนมัติในเวอร์ชันนี้ ถ้าแพลตฟอร์มปฏิเสธไฟล์ .webm ให้แปลงด้วยเครื่องมืออื่นก่อนโพสต์
      </div>

      {videoBlob && !done && (
        <div style={{ marginTop: 18 }}>
          <button className="btn" onClick={onDone}>ไปขั้นตอนถัดไป: โพสต์ →</button>
        </div>
      )}
      {done && <div className="status-pill ok" style={{ marginTop: 14 }}>✓ Export พร้อมแล้ว</div>}
    </Stage>
  );
}
