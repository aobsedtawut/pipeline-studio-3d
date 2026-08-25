"use client";

import { useRef, useState } from "react";
import { SCENE_TEMPLATES, ZOOM_FROM, ZOOM_TO, clamp } from "../lib/pipeline";

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

async function ensureCardMesh(rig, img, sceneId) {
  const { THREE, scene, cardTexCache } = rig;
  if (rig.cardMesh) {
    scene.remove(rig.cardMesh);
    rig.cardMesh = null;
  }
  let tex = cardTexCache.get(sceneId);
  if (!tex) {
    tex = new THREE.Texture(img);
    tex.needsUpdate = true;
    tex.colorSpace = THREE.SRGBColorSpace || tex.colorSpace;
    cardTexCache.set(sceneId, tex);
  }
  const aspect = img.width / img.height;
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

  async function onImageUpload(i, file) {
    const dataUrl = await fileToDataUrl(file);
    const next = scenes.slice();
    next[i] = { ...next[i], imageDataUrl: dataUrl };
    setScenes(next);
  }

  function setTemplate(i, template) {
    const next = scenes.slice();
    next[i] = { ...next[i], template };
    setScenes(next);
  }

  const allImagesReady = scenes.length > 0 && scenes.every((s) => s.imageDataUrl);

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

      const images = await Promise.all(scenes.map((s) => loadImage(s.imageDataUrl)));
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

      await new Promise((resolve) => {
        function draw() {
          const now = audioCtx.currentTime - startTime;
          if (now >= totalDuration + 0.15) {
            recorder.stop();
            resolve();
            return;
          }
          let idx = 0;
          for (let i = 0; i < starts.length; i++) if (now >= starts[i]) idx = i;
          const s = scenes[idx];
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
            const img = images[idx];
            const iw = img.width, ih = img.height;
            const targetAR = W / H;
            let dw, dh;
            if (iw / ih > targetAR) { dh = H * scale; dw = dh * (iw / ih); }
            else { dw = W * scale; dh = dw * (ih / iw); }
            const dx = (W - dw) / 2;
            const dy = (H - dh) / 2 - p * 14;
            ctx.drawImage(img, dx, dy, dw, dh);
          } else if (s.template === "particles") {
            rig.particles.visible = true;
            if (rig.cardMesh) rig.cardMesh.visible = false;
            rig.particles.rotation.y = now * 0.15;
            rig.particles.rotation.x = Math.sin(now * 0.2) * 0.1;
            rig.renderer.render(rig.scene, rig.camera);
            ctx.drawImage(rig.renderer.domElement, 0, 0, W, H);
            // floating product card on top
            const img = images[idx];
            const cw = W * 0.62, ch = cw * (img.height / img.width);
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
              ensureCardMesh(rig, images[idx], s.scene_id);
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
    <div className={`stage ${unlocked ? "unlocked" : ""}`}>
      <div className="stage-head">
        <div className="stage-num">3-4</div>
        <h2>ตัดต่อวิดีโอ + ซับไตเติล (3D Templates)</h2>
      </div>
      <div className="stage-sub">
        อัปโหลดภาพต่อฉาก เลือกเทมเพลต แล้วเรนเดอร์วิดีโอในเบราว์เซอร์ของคุณเอง (ไม่ต้องรอเซิร์ฟเวอร์)
      </div>

      {scenes.map((s, i) => (
        <div className="scene-card" key={s.scene_id}>
          <div className="scene-card-head">
            <span className="scene-badge">ฉาก {s.scene_id}</span>
            <span className="scene-dur">{s.audioDuration ? s.audioDuration.toFixed(1) + "s" : "-"}</span>
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <div>
              <label className="field-label">ภาพประกอบ</label>
              <input type="file" accept="image/*" onChange={(e) => e.target.files[0] && onImageUpload(i, e.target.files[0])} />
              {s.imageDataUrl && <img src={s.imageDataUrl} alt="" style={{ width: 90, marginTop: 8, borderRadius: 8 }} />}
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
          {!allImagesReady && <div className="hint">อัปโหลดภาพให้ครบทุกฉากก่อน</div>}
          {rendering && (
            <div className="progress-bar"><div className="progress-bar-fill" style={{ width: `${progress * 100}%` }} /></div>
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
    </div>
  );
}
