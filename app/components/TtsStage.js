"use client";

import { useState } from "react";
import { retimeScenes } from "../lib/pipeline";
import Stage from "./Stage";

function measureAudioDuration(dataUrl) {
  return new Promise((resolve) => {
    const audio = new Audio();
    audio.preload = "metadata";
    audio.src = dataUrl;
    audio.addEventListener("loadedmetadata", () => {
      if (isFinite(audio.duration) && audio.duration > 0) {
        resolve(audio.duration);
      } else {
        // Chrome sometimes reports Infinity for streamed/blob sources until
        // you seek near the end — force it.
        audio.currentTime = 1e9;
        audio.addEventListener(
          "durationchange",
          () => resolve(isFinite(audio.duration) ? audio.duration : 4),
          { once: true }
        );
      }
    });
    audio.addEventListener("error", () => resolve(4));
  });
}

export default function TtsStage({ unlocked, scenes, setScenes, onDone, done }) {
  const [busyId, setBusyId] = useState(null);
  const [busyAll, setBusyAll] = useState(false);
  const [providerNote, setProviderNote] = useState("");
  const [errMsg, setErrMsg] = useState("");

  async function synthesize(scene) {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: scene.voiceover_text, lang: "th" }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "render failed");
    const audioDuration = await measureAudioDuration(data.audioBase64);
    return { audioDataUrl: data.audioBase64, audioDuration, provider: data.provider };
  }

  function noteFor(provider) {
    return provider === "google-translate-unofficial"
      ? "ใช้เสียงฟรีจาก Google Translate (unofficial) — คุณภาพเสียงกลางๆ ตั้ง ELEVENLABS_API_KEY เพื่อเสียงดีขึ้น"
      : "ใช้ ElevenLabs";
  }

  async function renderOne(i) {
    const s = scenes[i];
    setBusyId(s.scene_id);
    setErrMsg("");
    try {
      const { audioDataUrl, audioDuration, provider } = await synthesize(s);
      const next = scenes.slice();
      next[i] = { ...next[i], audioDataUrl, audioDuration };
      setScenes(retimeScenes(next));
      setProviderNote(noteFor(provider));
    } catch (e) {
      setErrMsg(`ฉาก ${s.scene_id}: ${String(e.message || e)}`);
    } finally {
      setBusyId(null);
    }
  }

  // Accumulates into one local array across iterations — calling renderOne in
  // a loop would re-slice the stale `scenes` prop each time (the component
  // can't re-render mid-loop), so every scene would overwrite the previous
  // one and only the last would keep its audio.
  async function renderAll() {
    setBusyAll(true);
    setErrMsg("");
    const working = scenes.slice();
    for (let i = 0; i < working.length; i++) {
      setBusyId(working[i].scene_id);
      try {
        const { audioDataUrl, audioDuration, provider } = await synthesize(working[i]);
        working[i] = { ...working[i], audioDataUrl, audioDuration };
        setScenes(retimeScenes(working.slice()));
        setProviderNote(noteFor(provider));
      } catch (e) {
        setErrMsg(`ฉาก ${working[i].scene_id}: ${String(e.message || e)}`);
      }
    }
    setBusyId(null);
    setBusyAll(false);
  }

  const allRendered = scenes.length > 0 && scenes.every((s) => s.audioDataUrl);

  return (
    <Stage
      num={3}
      character="tts"
      accent="--accent-3"
      title="พากย์เสียง (Voiceover)"
      sub="แปลงคำพากย์แต่ละฉากเป็นเสียง แล้ววัดความยาวจริงเพื่อจับเวลาวิดีโอให้ตรง"
      unlocked={unlocked}
    >
      {unlocked && (
        <button className="btn" onClick={renderAll} disabled={busyAll || scenes.length === 0}>
          {busyAll ? "กำลังพากย์เสียงทั้งหมด…" : "🔊 พากย์เสียงทุกฉาก"}
        </button>
      )}
      {providerNote && <div className="hint">{providerNote}</div>}
      {errMsg && <div className="hint warn">{errMsg}</div>}

      {scenes.map((s, i) => (
        <div className="scene-card" key={s.scene_id}>
          <div className="scene-card-head">
            <span className="scene-badge">ฉาก {s.scene_id}</span>
            {s.audioDuration && <span className="scene-dur">{s.audioDuration.toFixed(1)}s</span>}
          </div>
          <div style={{ fontSize: 13.5, color: "var(--ink-soft)", margin: "8px 0" }}>{s.voiceover_text}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <button className="btn small secondary" onClick={() => renderOne(i)} disabled={busyId === s.scene_id}>
              {busyId === s.scene_id ? "กำลังพากย์…" : s.audioDataUrl ? "พากย์ใหม่" : "พากย์เสียง"}
            </button>
            {s.audioDataUrl && <audio controls src={s.audioDataUrl} style={{ height: 32 }} />}
          </div>
        </div>
      ))}

      {allRendered && !done && (
        <div style={{ marginTop: 18 }}>
          <button className="btn" onClick={onDone}>ไปขั้นตอนถัดไป: ตัดต่อวิดีโอ →</button>
        </div>
      )}
      {done && <div className="status-pill ok" style={{ marginTop: 14 }}>✓ พากย์เสียงครบทุกฉากแล้ว</div>}
    </Stage>
  );
}
