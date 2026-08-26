// Optional AI curation pass over an already-fetched Shopee candidate list.
// Purely additive: Stage 1 works fully without this (manual sort/filter is
// the default path). Only runs if ANTHROPIC_API_KEY is set — same pattern
// as app/api/ai-rewrite/route.js.
export async function POST(request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "ยังไม่ได้ตั้งค่า ANTHROPIC_API_KEY ใน Vercel Environment Variables — เรียงเองด้วยตัวกรองด้านบนได้เลย ฟีเจอร์นี้เป็นแค่ตัวเสริม" },
      { status: 400 }
    );
  }

  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";

  let body = {};
  try {
    body = await request.json();
  } catch {}
  const { products, keyword } = body;

  if (!Array.isArray(products) || products.length === 0) {
    return Response.json({ error: "ไม่มีสินค้าให้เลือก — ค้นหาก่อน" }, { status: 400 });
  }

  // Only send the fields the model needs to judge — keep the prompt small
  // and avoid leaking full offer links into the completion unnecessarily.
  const candidates = products.map((p) => ({
    itemId: p.itemId,
    productName: p.productName,
    commissionRate: p.commissionRate,
    price: p.price,
    sales: p.sales,
    ratingStar: p.ratingStar,
  }));

  const prompt = `You are an affiliate marketer picking which Shopee products are worth making a short-form video about for the search term "${keyword || ""}".

Candidates (JSON): ${JSON.stringify(candidates)}

Pick up to 5 of the best candidates to promote, balancing: commission rate (higher = more profit per sale), sales (proof of real demand — avoid 0-sales items even if commission is high), and rating (avoid anything below ~4.0 if alternatives exist). Rank best first.

Respond with ONLY a JSON array, no prose, no markdown fences, in this exact shape:
[{"itemId": "...", "reason": "one short Thai sentence explaining the pick"}]`;

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
        max_tokens: 1000,
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
    const picks = JSON.parse(jsonMatch[0]);
    return Response.json({ picks });
  } catch (e) {
    return Response.json({ error: "เรียก AI ไม่สำเร็จ: " + String(e.message || e) }, { status: 502 });
  }
}
