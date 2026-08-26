"use client";

import { useState } from "react";
import { buildTemplateScript } from "../lib/pipeline";
import Stage from "./Stage";

export default function ScriptStage({ unlocked, scenes, setScenes, meta, setMeta, onDone, done }) {
  const [productName, setProductName] = useState(meta.productName || "");
  const [points, setPoints] = useState(
    meta.points || "ดึงง่าย ไม่เกะกะโต๊ะ\nหนา 4 ชั้น ไม่เปื่อยเปียก\n1 กล่อง เท่ากับทิชชู่ทั่วไป 7 แพ็ค"
  );
  const [duration, setDuration] = useState(meta.durationTarget || 30);
  const [style, setStyle] = useState(meta.style || "punchy");
  const [aiState, setAiState] = useState(null); // null | "loading" | "ok" | "err"
  const [aiMsg, setAiMsg] = useState("");

  function generate() {
    const result = buildTemplateScript({ productName: productName || "สินค้านี้", points, durationTarget: Number(duration), style });
    setScenes(result.scenes);
    setMeta({ ...meta, productName, points, durationTarget: Number(duration), style, hook: result.hook, cta: result.cta });
  }

  function updateScene(i, field, value) {
    const next = scenes.slice();
    next[i] = { ...next[i], [field]: value };
    setScenes(next);
  }

  async function aiRewrite() {
    setAiState("loading");
    setAiMsg("");
    try {
      const res = await fetch("/api/ai-rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productName, points, style, scenes }),
      });
      const data = await res.json();
      if (res.ok && data.scenes) {
        setScenes(data.scenes);
        setAiState("ok");
        setAiMsg("ปรับสคริปต์ด้วย AI แล้ว");
      } else {
        setAiState("err");
        setAiMsg(data.error || "ยังไม่ได้ตั้งค่า ANTHROPIC_API_KEY — ใช้สคริปต์จากเทมเพลตแทนได้เลย");
      }
    } catch {
      setAiState("err");
      setAiMsg("เชื่อมต่อไม่สำเร็จ");
    }
  }

  return (
    <Stage
      num={2}
      character="script"
      accent="--accent-2"
      title="สคริปต์ (Script)"
      sub="ใส่ชื่อสินค้า + จุดเด่น แล้วสร้างสคริปต์เป็นฉากๆ พร้อมแก้ไขได้ก่อนพากย์เสียง"
      unlocked={unlocked}
    >
      <label className="field-label">ชื่อสินค้า</label>
      <input type="text" value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="เช่น Botare ทิชชู่แขวนผนัง" />

      <label className="field-label">จุดเด่น (บรรทัดละ 1 ข้อ)</label>
      <textarea value={points} onChange={(e) => setPoints(e.target.value)} rows={4} />

      <div className="row">
        <div>
          <label className="field-label">ความยาวเป้าหมาย (วินาที)</label>
          <input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} min={12} max={90} />
        </div>
        <div>
          <label className="field-label">สไตล์</label>
          <select value={style} onChange={(e) => setStyle(e.target.value)}>
            <option value="punchy">Punchy (สั้น กระแทก)</option>
            <option value="narrative">Narrative (เล่าเรื่องเต็มประโยค)</option>
          </select>
        </div>
      </div>

      <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button className="btn" onClick={generate}>สร้างสคริปต์</button>
        {scenes.length > 0 && (
          <button className="btn secondary" onClick={aiRewrite} disabled={aiState === "loading"}>
            {aiState === "loading" ? "กำลังปรับ…" : "✨ ปรับด้วย AI (ถ้าตั้ง API key ไว้)"}
          </button>
        )}
      </div>
      {aiMsg && <div className={`hint ${aiState === "err" ? "warn" : ""}`}>{aiMsg}</div>}

      {scenes.map((s, i) => (
        <div className="scene-card" key={s.scene_id}>
          <div className="scene-card-head">
            <span className="scene-badge">ฉาก {s.scene_id}</span>
          </div>
          <label className="field-label">คำพากย์ (voiceover)</label>
          <textarea value={s.voiceover_text} onChange={(e) => updateScene(i, "voiceover_text", e.target.value)} rows={2} />
          <label className="field-label">แคปชั่นบนจอ</label>
          <input type="text" value={s.caption_text} onChange={(e) => updateScene(i, "caption_text", e.target.value)} />
        </div>
      ))}

      {scenes.length > 0 && !done && (
        <div style={{ marginTop: 18 }}>
          <button className="btn" onClick={onDone}>ไปขั้นตอนถัดไป: พากย์เสียง →</button>
        </div>
      )}
      {done && <div className="status-pill ok" style={{ marginTop: 14 }}>✓ สคริปต์พร้อมแล้ว ({scenes.length} ฉาก)</div>}
    </Stage>
  );
}
