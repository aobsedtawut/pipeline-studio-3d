// Optional AI polish pass for the template-generated script. Purely additive:
// Stage 1 works fully without this route (the client-side template generator
// in lib/pipeline.js is the default path). This only runs if the user has
// added ANTHROPIC_API_KEY as a Vercel environment variable.
//
// Model id: set ANTHROPIC_MODEL to override; defaults to a Claude Sonnet
// alias. Verify the current model id in your Anthropic console before
// relying on this in production — model ids are versioned and change over
// time, and this code was written without the ability to call the live API
// to confirm the exact current id.
export async function POST(request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "ยังไม่ได้ตั้งค่า ANTHROPIC_API_KEY ใน Vercel Environment Variables — ใช้สคริปต์จากเทมเพลตได้เลย ฟีเจอร์นี้เป็นแค่ตัวเสริม" },
      { status: 400 }
    );
  }

  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";

  let body = {};
  try {
    body = await request.json();
  } catch {}
  const { productName, points, style, scenes } = body;

  const prompt = `You are polishing a Thai-language short-form video script for an affiliate product review.
Product: ${productName}
Key points: ${points}
Style: ${style === "punchy" ? "punchy, fragment-style, short phrases" : "narrative, full sentences"}

Current scenes (JSON): ${JSON.stringify(scenes)}

Rewrite each scene's "voiceover_text" and "caption_text" to be more natural, credible Thai (not exaggerated clickbait), keeping the same scene_id/start_sec/end_sec/template values unchanged. Respond with ONLY a JSON array of scene objects, no prose, no markdown fences.`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return Response.json({ error: `Anthropic API error (${res.status}): ${text}`.slice(0, 500) }, { status: 502 });
    }

    const data = await res.json();
    const text = data?.content?.[0]?.text || "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return Response.json({ error: "AI ตอบกลับไม่ใช่ JSON ที่คาดไว้ — ลองใหม่อีกครั้ง" }, { status: 502 });
    }
    const rewritten = JSON.parse(jsonMatch[0]);
    return Response.json({ scenes: rewritten });
  } catch (e) {
    return Response.json({ error: "เรียก AI ไม่สำเร็จ: " + String(e.message || e) }, { status: 502 });
  }
}
