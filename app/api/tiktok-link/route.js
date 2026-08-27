// Generates a real, commission-tracked TikTok Shop affiliate link for a
// product returned by /api/tiktok-search (whose detail_link is just the
// plain product page). Called lazily when the user picks a product, not
// for every search result, to avoid burning API calls on products nobody
// chooses.
//
// CAVEAT: the research pass that verified /api/tiktok-search's request/
// response schema against live docs did NOT get a confirmed response
// field name for the generated link on this endpoint — verify
// `data.data.links[0]` against your own response before relying on this
// in production; the field-name fallbacks below are a best guess.
import { getValidTikTokAuth } from "../../lib/tiktokAuth";
import { signTikTokRequest } from "../../lib/tiktokSign";

const API_BASE = process.env.TIKTOK_API_BASE || "https://open-api.tiktokglobalshop.com";
const LINK_PATH = "/affiliate_creator/202505/affiliate_sharing_links/general_publishers/generate_batch";

export async function POST(request) {
  const appKey = process.env.TIKTOK_APP_KEY;
  const appSecret = process.env.TIKTOK_APP_SECRET;
  if (!appKey || !appSecret) {
    return Response.json({ error: "ยังไม่ได้ตั้งค่า TIKTOK_APP_KEY / TIKTOK_APP_SECRET" }, { status: 400 });
  }

  let auth;
  try {
    auth = await getValidTikTokAuth();
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 401 });
  }

  let body = {};
  try {
    body = await request.json();
  } catch {}
  const { productId } = body;
  if (!productId) {
    return Response.json({ error: "ต้องระบุ productId" }, { status: 400 });
  }

  const requestBody = JSON.stringify({ materials: [{ product_id: String(productId) }] });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const query = { app_key: appKey, timestamp };
  const sign = signTikTokRequest({ path: LINK_PATH, query, body: requestBody, appSecret });

  const url = new URL(`${API_BASE}${LINK_PATH}`);
  Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v));
  url.searchParams.set("sign", sign);

  try {
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { "content-type": "application/json", "x-tts-access-token": auth.accessToken },
      body: requestBody,
    });
    const data = await res.json();
    if (!res.ok || data.code !== 0) {
      return Response.json({ error: `TikTok API error: ${JSON.stringify(data).slice(0, 500)}` }, { status: 502 });
    }
    const first = data.data?.links?.[0] || {};
    const link = first.share_link || first.link || first.url;
    if (!link) {
      return Response.json({ error: "TikTok ไม่ส่งลิงก์กลับมา — เช็ค response shape จริงเทียบกับโค้ด" }, { status: 502 });
    }
    return Response.json({ link });
  } catch (e) {
    return Response.json({ error: "สร้างลิงก์ไม่สำเร็จ: " + String(e.message || e) }, { status: 502 });
  }
}
