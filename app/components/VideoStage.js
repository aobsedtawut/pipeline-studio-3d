"use client";

import { useRef, useState } from "react";
import { SCENE_TEMPLATES, ZOOM_FROM, ZOOM_TO, clamp } from "../lib/pipeline";
import Stage from "./Stage";

const W = 1080, H = 1920;

async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function loadVideoEl(src) {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.src = src;
    video.onloadeddata = () => resolve(video);
    video.onerror = reject;
  });
}

// Loads each scene's media (image or uploaded video clip) as either an
// <img> or a playing (muted) <video> element, so the render loop can
// ctx.drawImage() either one the same way.
async function loadSceneMedia(scenes) {
  return Promise.all(
    scenes.map(async (s) => {
      if (s.mediaKind === "video" && s.videoDataUrl) {
        const el = await loadVideoEl(s.videoDataUrl);
        return { kind: "video", el };
      }
      const el = await loadImage(s.imageDataUrl);
      return { kind: "image", el };
    })
  );
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? cur + " " + w : w;
    if (ctx.measureText(test).width > maxWidth && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function drawCaption(ctx, text, alpha, yOffset) {
  if (!text || alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = "800 58px Sarabun, sans-serif";
  ctx.textAlign = "center";
  ctx.lineJoin = "round";
  const maxWidth = W * 0.86;
  const lines = wrapText(ctx, text, maxWidth);
  const lineHeight = 70;
  const startY = H * 0.82 - (lines.length - 1) * lineHeight + yOffset;
  lines.forEach((line, i) => {
    const y = startY + i * lineHeight;
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 10;
    ctx.strokeText(line, W / 2, y);
    ctx.fillStyle = "#fff";
    ctx.fillText(line, W / 2, y);
  });
  ctx.restore();
}

// --- Three.js helpers (window.THREE, loaded via CDN in layout.js) ---
function makeThreeRig() {
  const THREE = window.THREE;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: false, antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(W, H, false);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0c16);
  const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 100);
  camera.position.set(0, 0, 6);

  const ambient = new THREE.AmbientLight(0xffffff, 0.8);
  scene.add(ambient);
  const key = new THREE.PointLight(0x8f6fff, 1.4, 20);
  key.position.set(3, 3, 5);
  scene.add(key);
  const rim = new THREE.PointLight(0x26e8da, 1.2, 20);
  rim.position.set(-3, -2, 4);
  scene.add(rim);

  // particle field, reused for the "particles" template
  const COUNT = 500;
  const positions = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 12;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 20;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 10 - 2;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const particleMat = new THREE.PointsMaterial({ size: 0.09, color: 0x8f6fff, transparent: true, opacity: 0.8 });
  const particles = new THREE.Points(geo, particleMat);
  particles.visible = false;
  scene.add(particles);

  return { THREE, renderer, scene, camera, particles, cardMesh: null, cardTexCache: new Map() };
}

async function ensureCardMesh(rig, media, sceneId) {
  const { THREE, scene, cardTexCache } = rig;
  if (rig.cardMesh) {
    scene.remove(rig.cardMesh);
    rig.cardMesh = null;
  }
  const { kind, el } = media;
  let tex = cardTexCache.get(sceneId);
  if (!tex) {
    tex = kind === "video" ? new THREE.VideoTexture(el) : new THREE.Texture(el);
    if (kind !== "video") tex.needsUpdate = true;
    tex.colorSpace = THREE.SRGBColorSpace || tex.colorSpace;
    cardTexCache.set(sceneId, tex);
  }
  const aspect = kind === "video" ? el.videoWidth / el.videoHeight : el.width / el.height;
  const h = 3.6;
  const w = h * Math.min(aspect, 0.9);
  const geo = new THREE.PlaneGeometry(w, h, 1, 1);
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35, metalness: 0.15 });
  const mesh = new THREE.Mesh(geo, mat);
  scene.add(mesh);
  rig.cardMesh = mesh;
  return mesh;
}

export default function VideoStage({ unlocked, scenes, setScenes, onDone, done }) {
  const [rendering, setRendering] = useState(false);
  const [progress, setProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState(null);
  const [errMsg, setErrMsg] = useState("");
  const videoBlobRef = useRef(null);
  const rigRef = useRef(null);

  // "scenes" = existing per-scene image/video → 3D template pipeline.
  // "attach" = drop in one already-edited clip, skip per-scene media
  // entirely — audio either kept (ducked) from the clip itself, or
  // swapped out for the Stage 3 voiceover with the clip looping as a
  // silent background visual.
  const [mode, setMode] = useState("scenes");
  const [attachedVideoUrl, setAttachedVideoUrl] = useState(null);
  const [attachedVideoName, setAttachedVideoName] = useState("");
  const [audioMode, setAudioMode] = useState("replace"); // "keep" | "replace"
  const [keepVolume, setKeepVolume] = useState(60);
  const [useCaptions, setUseCaptions] = useState(true);

  async function onAttachUpload(file) {
    const dataUrl = await fileToDataUrl(file);
    setAttachedVideoUrl(dataUrl);
    setAttachedVideoName(file.name);
    setVideoUrl(null);
  }

  async function renderAttachedVideo() {
    setErrMsg("");
    setRendering(true);
    setProgress(0);
    setVideoUrl(null);

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioCtx();

      const video = document.createElement("video");
      video.src = attachedVideoUrl;
      video.playsInline = true;
      video.muted = audioMode === "replace";
      video.loop = audioMode === "replace";
      await new Promise((resolve, reject) => {
        video.onloadedmetadata = resolve;
        video.onerror = reject;
      });

      const dest = audioCtx.createMediaStreamDestination();
      let totalDuration;
      const sceneStarts = [];
      const sceneDurs = [];

      if (audioMode === "replace") {
        const audioBuffers = await Promise.all(
          scenes.map(async (s) => {
            const resp = await fetch(s.audioDataUrl);
            const arr = await resp.arrayBuffer();
            return audioCtx.decodeAudioData(arr.slice(0));
          })
        );
        let t = 0;
        audioBuffers.forEach((b) => {
          sceneStarts.push(t);
          sceneDurs.push(b.duration);
          t += b.duration;
        });
        totalDuration = t;

        const clockStart0 = audioCtx.currentTime + 0.25;
        audioBuffers.forEach((buf, i) => {
          const src = audioCtx.createBufferSource();
          src.buffer = buf;
          src.connect(dest);
          src.start(clockStart0 + sceneStarts[i]);
        });
      } else {
        // Keep the clip's own audio, ducked to keepVolume, playing once
        // at its natural length. Captions (if any) are spread across
        // that length proportional to each scene's script-voiceover
        // duration, since there's no per-scene audio driving timing here.
        totalDuration = video.duration;
        const weights = scenes.map((s) => s.audioDuration || 1);
        const totalWeight = weights.reduce((a, b) => a + b, 0) || 1;
        let t = 0;
        weights.forEach((w) => {
          const dur = (w / totalWeight) * totalDuration;
          sceneStarts.push(t);
          sceneDurs.push(dur);
          t += dur;
        });

        const srcNode = audioCtx.createMediaElementSource(video);
        const gain = audioCtx.createGain();
        gain.gain.value = keepVolume / 100;
        srcNode.connect(gain);
        gain.connect(dest);
      }

      const compositeCanvas = document.createElement("canvas");
      compositeCanvas.width = W;
      compositeCanvas.height = H;
      const ctx = compositeCanvas.getContext("2d");

      const videoStream = compositeCanvas.captureStream(30);
      const combined = new MediaStream([...videoStream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : "video/webm";
      const recorder = new MediaRecorder(combined, { mimeType, videoBitsPerSecond: 6_000_000 });
      const chunks = [];
      recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      const stopped = new Promise((res) => (recorder.onstop = res));

      const clockStart = audioCtx.currentTime + 0.25;
      video.currentTime = 0;
      await video.play().catch(() => {});
      recorder.start();

      await new Promise((resolve) => {
        function draw() {
          const now = audioCtx.currentTime - clockStart;
          if (now >= totalDuration + 0.15) {
            recorder.stop();
            video.pause();
            resolve();
            return;
          }

          ctx.fillStyle = "#000";
          ctx.fillRect(0, 0, W, H);

          const iw = video.videoWidth, ih = video.videoHeight;
          const targetAR = W / H;
          let dw, dh;
          if (iw / ih > targetAR) { dh = H; dw = dh * (iw / ih); }
          else { dw = W; dh = dw * (ih / iw); }
          const dx = (W - dw) / 2, dy = (H - dh) / 2;
          ctx.drawImage(video, dx, dy, dw, dh);

          if (useCaptions && sceneStarts.length) {
            let idx = 0;
            for (let i = 0; i < sceneStarts.length; i++) if (now >= sceneStarts[i]) idx = i;
            const s = scenes[idx];
            const sceneStart = sceneStarts[idx];
            const sceneDur = sceneDurs[idx];
            const localT = clamp(now - sceneStart, 0, sceneDur);
            const fadeIn = clamp(localT / 0.25, 0, 1);
            const fadeOut = clamp((sceneDur - localT) / 0.3, 0, 1);
            const capAlpha = Math.min(fadeIn, fadeOut);
            if (s) drawCaption(ctx, s.caption_text, capAlpha, 20 * (1 - fadeIn));
          }

          setProgress(now / totalDuration);
          requestAnimationFrame(draw);
        }
        requestAnimationFrame(draw);
      });

      await stopped;
      const blob = new Blob(chunks, { type: "video/webm" });
      videoBlobRef.current = blob;
      setVideoUrl(URL.createObjectURL(blob));
    } catch (e) {
      setErrMsg("เรนเดอร์วิดีโอไม่สำเร็จ: " + String(e.message || e));
    } finally {
      setRendering(false);
    }
  }

  async function onMediaUpload(i, file) {
    const dataUrl = await fileToDataUrl(file);
    const isVideo = file.type.startsWith("video/");
    const next = scenes.slice();
    next[i] = {
      ...next[i],
      mediaKind: isVideo ? "video" : "image",
      imageDataUrl: isVideo ? undefined : dataUrl,
      videoDataUrl: isVideo ? dataUrl : undefined,
    };
    setScenes(next);
  }

  function setTemplate(i, template) {
    const next = scenes.slice();
    next[i] = { ...next[i], template };
    setScenes(next);
  }

  const allImagesReady =
    scenes.length > 0 && scenes.every((s) => (s.mediaKind === "video" ? s.videoDataUrl : s.imageDataUrl));

  async function renderVideo() {
    if (!window.THREE) {
      setErrMsg("Three.js ยังโหลดไม่เสร็จ ลองรออีกสักครู่แล้วกดใหม่");
      return;
    }
    setErrMsg("");
    setRendering(true);
    setProgress(0);
    setVideoUrl(null);

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioCtx();

      const media = await loadSceneMedia(scenes);
      const audioBuffers = await Promise.all(
        scenes.map(async (s) => {
          const resp = await fetch(s.audioDataUrl);
          const arr = await resp.arrayBuffer();
          return audioCtx.decodeAudioData(arr.slice(0));
        })
      );

      let t = 0;
      const starts = audioBuffers.map((b) => {
        const s = t;
        t += b.duration;
        return s;
      });
      const totalDuration = t;

      const dest = audioCtx.createMediaStreamDestination();
      const startTime = audioCtx.currentTime + 0.25;
      audioBuffers.forEach((buf, i) => {
        const src = audioCtx.createBufferSource();
        src.buffer = buf;
        src.connect(dest);
        src.start(startTime + starts[i]);
      });

      const compositeCanvas = document.createElement("canvas");
      compositeCanvas.width = W;
      compositeCanvas.height = H;
      const ctx = compositeCanvas.getContext("2d");

      const rig = makeThreeRig();
      rigRef.current = rig;

      const videoStream = compositeCanvas.captureStream(30);
      const combined = new MediaStream([...videoStream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : "video/webm";
      const recorder = new MediaRecorder(combined, { mimeType, videoBitsPerSecond: 6_000_000 });
      const chunks = [];
      recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      const stopped = new Promise((res) => (recorder.onstop = res));
      recorder.start();

      let lastSceneKey = null;
      let activeVideoIdx = -1;

      await new Promise((resolve) => {
        function draw() {
          const now = audioCtx.currentTime - startTime;
          if (now >= totalDuration + 0.15) {
            recorder.stop();
            if (activeVideoIdx >= 0) media[activeVideoIdx].el.pause();
            resolve();
            return;
          }
          let idx = 0;
          for (let i = 0; i < starts.length; i++) if (now >= starts[i]) idx = i;
          const s = scenes[idx];

          if (media[idx].kind === "video" && activeVideoIdx !== idx) {
            if (activeVideoIdx >= 0 && media[activeVideoIdx].kind === "video") media[activeVideoIdx].el.pause();
            const v = media[idx].el;
            v.currentTime = 0;
            v.play().catch(() => {});
            activeVideoIdx = idx;
          }
          const sceneStart = starts[idx];
          const sceneDur = audioBuffers[idx].duration;
          const localT = clamp(now - sceneStart, 0, sceneDur);
          const p = sceneDur > 0 ? localT / sceneDur : 0;
          const fadeIn = clamp(localT / 0.25, 0, 1);
          const fadeOut = clamp((sceneDur - localT) / 0.3, 0, 1);
          const capAlpha = Math.min(fadeIn, fadeOut);

          ctx.fillStyle = "#000";
          ctx.fillRect(0, 0, W, H);

          if (s.template === "kenburns" || !s.template) {
            const scale = ZOOM_FROM + (ZOOM_TO - ZOOM_FROM) * p;
            const { kind, el } = media[idx];
            const iw = kind === "video" ? el.videoWidth : el.width;
            const ih = kind === "video" ? el.videoHeight : el.height;
            const targetAR = W / H;
            let dw, dh;
            if (iw / ih > targetAR) { dh = H * scale; dw = dh * (iw / ih); }
            else { dw = W * scale; dh = dw * (ih / iw); }
            const dx = (W - dw) / 2;
            const dy = (H - dh) / 2 - p * 14;
            ctx.drawImage(el, dx, dy, dw, dh);
          } else if (s.template === "particles") {
            rig.particles.visible = true;
            if (rig.cardMesh) rig.cardMesh.visible = false;
            rig.particles.rotation.y = now * 0.15;
            rig.particles.rotation.x = Math.sin(now * 0.2) * 0.1;
            rig.renderer.render(rig.scene, rig.camera);
            ctx.drawImage(rig.renderer.domElement, 0, 0, W, H);
            // floating product card on top
            const { kind, el: img } = media[idx];
            const imgH = kind === "video" ? img.videoHeight : img.height;
            const imgW = kind === "video" ? img.videoWidth : img.width;
            const cw = W * 0.62, ch = cw * (imgH / imgW);
            const cx = (W - cw) / 2, cy = H * 0.32 + Math.sin(now * 1.2) * 10;
            ctx.save();
            ctx.shadowColor = "rgba(0,0,0,0.5)";
            ctx.shadowBlur = 40;
            ctx.shadowOffsetY = 20;
            const r = 28;
            ctx.beginPath();
            ctx.moveTo(cx + r, cy);
            ctx.arcTo(cx + cw, cy, cx + cw, cy + ch, r);
            ctx.arcTo(cx + cw, cy + ch, cx, cy + ch, r);
            ctx.arcTo(cx, cy + ch, cx, cy, r);
            ctx.arcTo(cx, cy, cx + cw, cy, r);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(img, cx, cy, cw, ch);
            ctx.restore();
          } else if (s.template === "spin-card") {
            rig.particles.visible = false;
            const key = `spin-${idx}`;
            if (lastSceneKey !== key) {
              ensureCardMesh(rig, media[idx], s.scene_id);
              lastSceneKey = key;
            }
            if (rig.cardMesh) {
              rig.cardMesh.visible = true;
              rig.cardMesh.rotation.y = Math.sin(now * 0.8) * 0.55 + localT * 0.4;
              rig.cardMesh.rotation.x = Math.sin(now * 0.5) * 0.08;
              rig.cardMesh.position.y = Math.sin(now * 1.1) * 0.15;
            }
            rig.renderer.render(rig.scene, rig.camera);
            ctx.drawImage(rig.renderer.domElement, 0, 0, W, H);
          }

          drawCaption(ctx, s.caption_text, capAlpha, 20 * (1 - fadeIn));

          setProgress(now / totalDuration);
          requestAnimationFrame(draw);
        }
        requestAnimationFrame(draw);
      });

      await stopped;
      const blob = new Blob(chunks, { type: "video/webm" });
      videoBlobRef.current = blob;
      setVideoUrl(URL.createObjectURL(blob));
    } catch (e) {
      setErrMsg("เรนเดอร์วิดีโอไม่สำเร็จ: " + String(e.message || e));
    } finally {
      setRendering(false);
    }
  }

  return (
    <Stage
      num="4-5"
      character="video"
      accent="--accent-4"
      title="ตัดต่อวิดีโอ + ซับไตเติล (3D Templates)"
      sub="อัปโหลดภาพหรือวิดีโอต่อฉากแล้วเรนเดอร์จากเทมเพลต 3D หรือแนบวิดีโอที่ตัดต่อมาแล้ว 1 คลิปแทนก็ได้ — ทั้งหมดเรนเดอร์ในเบราว์เซอร์ของคุณเอง"
      unlocked={unlocked}
    >
      <div className="flex gap-2" style={{ marginBottom: 16 }}>
        <button
          type="button"
          className="btn small secondary"
          style={mode === "scenes" ? { borderColor: "var(--accent-4)", color: "var(--accent-4)" } : undefined}
          onClick={() => setMode("scenes")}
        >
          🎬 ต่อฉากจากรูป/เทมเพลต
        </button>
        <button
          type="button"
          className="btn small secondary"
          style={mode === "attach" ? { borderColor: "var(--accent-4)", color: "var(--accent-4)" } : undefined}
          onClick={() => setMode("attach")}
        >
          📎 แนบวิดีโอที่ตัดต่อแล้ว
        </button>
      </div>

      {mode === "scenes" && (
        <>
          {scenes.map((s, i) => (
            <div className="scene-card" key={s.scene_id}>
              <div className="scene-card-head">
                <span className="scene-badge">ฉาก {s.scene_id}</span>
                <span className="scene-dur">{s.audioDuration ? s.audioDuration.toFixed(1) + "s" : "-"}</span>
              </div>
              <div className="row" style={{ marginTop: 10 }}>
                <div>
                  <label className="field-label">ภาพประกอบ / วิดีโอ</label>
                  <input
                    type="file"
                    accept="image/*,video/*"
                    onChange={(e) => e.target.files[0] && onMediaUpload(i, e.target.files[0])}
                  />
                  {s.mediaKind === "video" && s.videoDataUrl && (
                    <video src={s.videoDataUrl} muted loop autoPlay style={{ width: 90, marginTop: 8, borderRadius: 8 }} />
                  )}
                  {s.mediaKind !== "video" && s.imageDataUrl && (
                    <img src={s.imageDataUrl} alt="" style={{ width: 90, marginTop: 8, borderRadius: 8 }} />
                  )}
                </div>
                <div>
                  <label className="field-label">เทมเพลต</label>
                  <select value={s.template || "kenburns"} onChange={(e) => setTemplate(i, e.target.value)}>
                    {SCENE_TEMPLATES.map((t) => (
                      <option key={t.id} value={t.id}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ))}

          {unlocked && (
            <div style={{ marginTop: 18 }}>
              <button className="btn" onClick={renderVideo} disabled={!allImagesReady || rendering}>
                {rendering ? `กำลังเรนเดอร์… ${(progress * 100).toFixed(0)}%` : "🎬 เรนเดอร์วิดีโอ"}
              </button>
              {!allImagesReady && <div className="hint">อัปโหลดภาพหรือวิดีโอให้ครบทุกฉากก่อน</div>}
              {rendering && (
                <div className="progress-bar"><div className="progress-bar-fill" style={{ width: `${progress * 100}%` }} /></div>
              )}
            </div>
          )}
        </>
      )}

      {mode === "attach" && (
        <div className="scene-card">
          <label className="field-label">วิดีโอที่ตัดต่อมาแล้ว (1 ไฟล์)</label>
          <input
            type="file"
            accept="video/*"
            onChange={(e) => e.target.files[0] && onAttachUpload(e.target.files[0])}
          />
          {attachedVideoUrl && (
            <video src={attachedVideoUrl} muted controls style={{ width: 160, marginTop: 8, borderRadius: 8 }} />
          )}

          <label className="field-label" style={{ marginTop: 14 }}>เสียงในคลิป</label>
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              className="btn small secondary"
              style={audioMode === "replace" ? { borderColor: "var(--accent-4)", color: "var(--accent-4)" } : undefined}
              onClick={() => setAudioMode("replace")}
            >
              🎙️ ตัดเสียงเดิม ใช้เสียงพากย์จาก Stage 3 แทน
            </button>
            <button
              type="button"
              className="btn small secondary"
              style={audioMode === "keep" ? { borderColor: "var(--accent-4)", color: "var(--accent-4)" } : undefined}
              onClick={() => setAudioMode("keep")}
            >
              🔊 เก็บเสียงเดิม (ลดระดับเสียง)
            </button>
          </div>
          {audioMode === "replace" && (
            <div className="hint">คลิปจะวนซ้ำเป็นพื้นหลังเงียบๆ ความยาวเท่าเสียงพากย์รวมจากทุกฉาก</div>
          )}
          {audioMode === "keep" && (
            <>
              <label className="field-label">ระดับเสียงเดิม ({keepVolume}%)</label>
              <input
                type="range"
                min={0}
                max={100}
                value={keepVolume}
                onChange={(e) => setKeepVolume(Number(e.target.value))}
              />
              <div className="hint">ความยาววิดีโอเท่าคลิปต้นฉบับ ไม่วนซ้ำ</div>
            </>
          )}

          <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14 }}>
            <input
              type="checkbox"
              checked={useCaptions}
              onChange={(e) => setUseCaptions(e.target.checked)}
              disabled={scenes.length === 0}
            />
            ใส่ซับจากสคริปต์ (Stage 2)
          </label>
          {scenes.length === 0 && <div className="hint">ยังไม่มีสคริปต์ — ข้ามไปก่อนได้ หรือย้อนไปทำ Stage 2</div>}

          {unlocked && (
            <div style={{ marginTop: 18 }}>
              <button className="btn" onClick={renderAttachedVideo} disabled={!attachedVideoUrl || rendering}>
                {rendering ? `กำลังเรนเดอร์… ${(progress * 100).toFixed(0)}%` : "🎬 เรนเดอร์วิดีโอ"}
              </button>
              {!attachedVideoUrl && <div className="hint">แนบวิดีโอก่อน</div>}
              {rendering && (
                <div className="progress-bar"><div className="progress-bar-fill" style={{ width: `${progress * 100}%` }} /></div>
              )}
            </div>
          )}
        </div>
      )}
      {errMsg && <div className="hint warn">{errMsg}</div>}

      {videoUrl && (
        <>
          <video className="preview" src={videoUrl} controls />
          {!done && (
            <div style={{ marginTop: 14 }}>
              <button className="btn" onClick={() => onDone(videoBlobRef.current, videoUrl)}>ไปขั้นตอนถัดไป: Export →</button>
            </div>
          )}
        </>
      )}
      {done && <div className="status-pill ok" style={{ marginTop: 14 }}>✓ วิดีโอเรนเดอร์เสร็จแล้ว</div>}
    </Stage>
  );
}
