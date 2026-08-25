// Renders one scene's voiceover text to audio (base64 mp3).
//
// Primary path: ElevenLabs, if ELEVENLABS_API_KEY (and optionally
// ELEVENLABS_VOICE_ID) are set as Vercel env vars — paid, higher quality.
//
// Fallback path: Google Translate's unofficial TTS endpoint (the same
// technique the free `gTTS` Python library uses) — no API key needed, but
// it is NOT an official Google API: it can rate-limit, block non-browser
// requests, or change without notice. Treat it as a "works today, might not
// tomorrow" fallback, not something to depend on for production posting.

const GOOGLE_TTS_MAX_CHARS = 200;

function chunkText(text, maxLen) {
  const sentences = text.split(/(?<=[.!?ๆฯ])\s+|\n+/).filter(Boolean);
  const chunks = [];
  let cur = "";
  for (const s of sentences) {
    if ((cur + " " + s).trim().length > maxLen) {
      if (cur) chunks.push(cur.trim());
      if (s.length > maxLen) {
        for (let i = 0; i < s.length; i += maxLen) chunks.push(s.slice(i, i + maxLen));
        cur = "";
      } else {
        cur = s;
      }
    } else {
      cur = (cur + " " + s).trim();
    }
  }
  if (cur) chunks.push(cur.trim());
  return chunks.length ? chunks : [text.slice(0, maxLen)];
}

async function googleTranslateTts(text, lang) {
  const chunks = chunkText(text, GOOGLE_TTS_MAX_CHARS);
  const buffers = [];
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    const url =
      `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob` +
      `&tl=${encodeURIComponent(lang)}&q=${encodeURIComponent(c)}` +
      `&idx=${i}&total=${chunks.length}&textlen=${c.length}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Referer: "https://translate.google.com/",
      },
    });
    if (!res.ok) {
      throw new Error(`Google Translate TTS chunk ${i} failed: HTTP ${res.status}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    buffers.push(buf);
  }
  return Buffer.concat(buffers);
}

async function elevenLabsTts(text, apiKey, voiceId) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "content-type": "application/json",
      accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`ElevenLabs error ${res.status}: ${errText.slice(0, 300)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

export async function POST(request) {
  let body = {};
  try {
    body = await request.json();
  } catch {}
  const { text, lang } = body;
  if (!text || !text.trim()) {
    return Response.json({ error: "ไม่มีข้อความให้พากย์" }, { status: 400 });
  }

  const elevenKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;

  try {
    let buf, provider;
    if (elevenKey && voiceId) {
      buf = await elevenLabsTts(text, elevenKey, voiceId);
      provider = "elevenlabs";
    } else {
      buf = await googleTranslateTts(text, lang || "th");
      provider = "google-translate-unofficial";
    }
    return Response.json({
      audioBase64: `data:audio/mpeg;base64,${buf.toString("base64")}`,
      provider,
    });
  } catch (e) {
    return Response.json(
      {
        error:
          String(e.message || e) +
          (elevenKey ? "" : " — ตั้งค่า ELEVENLABS_API_KEY + ELEVENLABS_VOICE_ID เพื่อใช้เสียงคุณภาพสูงกว่านี้"),
      },
      { status: 502 }
    );
  }
}
