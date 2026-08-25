// Shared helpers for the pipeline. Deliberately dependency-free (no LLM
// required) so Stage 1 works out of the box; /api/ai-rewrite is an optional
// upgrade if ANTHROPIC_API_KEY is configured.

export function buildTemplateScript({ productName, points, durationTarget, style }) {
  const bullets = points
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const hook =
    style === "punchy"
      ? `${productName} — เจอปัญหานี้ไหม`
      : `เคยเจอปัญหานี้ไหม กับ ${productName}`;

  const cta = style === "punchy" ? "กดลิงก์ช้อปเลย" : "กดลิงก์ด้านล่างเพื่อสั่งซื้อได้เลยครับ";

  const bodyBullets = bullets.length ? bullets : [productName];
  const perScene = Math.max(3, Math.floor(durationTarget / (bodyBullets.length + 2)));

  const scenes = [];
  let t = 0;
  const addScene = (text, caption) => {
    const dur = Math.max(3, Math.min(14, perScene));
    scenes.push({
      scene_id: scenes.length + 1,
      start_sec: t,
      end_sec: t + dur,
      voiceover_text: text,
      caption_text: caption,
      template: "kenburns",
    });
    t += dur;
  };

  addScene(hook, style === "punchy" ? "ปัญหาที่เจอบ่อย" : "ปัญหาที่ทุกคนเจอ");
  bodyBullets.forEach((b) => addScene(b, b.length > 24 ? b.slice(0, 24) + "…" : b));
  addScene(cta, "กดลิงก์ช้อปเลย");

  return { hook, cta, scenes, target_duration_sec: durationTarget };
}

export const SCENE_TEMPLATES = [
  { id: "kenburns", label: "Ken Burns (photo pan/zoom)" },
  { id: "spin-card", label: "3D Spin Card (rotating product)" },
  { id: "particles", label: "3D Particle Backdrop" },
];

export const ZOOM_FROM = 1.0;
export const ZOOM_TO = 1.14;

export function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

// Given the flat list of scenes with per-scene measured audio durations,
// recompute start_sec/end_sec so video timing matches real TTS output
// (mirrors what tts-voiceover-render does server-side in the Claude pipeline).
export function retimeScenes(scenes) {
  let t = 0;
  return scenes.map((s) => {
    const dur = s.audioDuration || s.end_sec - s.start_sec || 4;
    const out = { ...s, start_sec: t, end_sec: t + dur };
    t += dur;
    return out;
  });
}
