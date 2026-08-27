// TikTok Shop Creator Affiliate product search — verified live against
// https://partner.tiktokshop.com/docv2/page/creator-search-open-collaboration-product
// (2026-08). Requires a connected creator (see /api/tiktok-auth/authorize)
// — TikTok Shop's affiliate API is OAuth-based per-creator, not a static
// app secret like Shopee's.
//
// NOTE: this endpoint's `detail_link` is just the plain product page, not a
// commission-tracked affiliate link — that requires a second call, see
// /api/tiktok-link, made lazily when the user actually picks a product.
import { getValidTikTokAuth } from "../../lib/tiktokAuth";
import { signTikTokRequest } from "../../lib/tiktokSign";

const API_BASE = process.env.TIKTOK_API_BASE || "https://open-api.tiktokglobalshop.com";
const SEARCH_PATH = "/affiliate_creator/202405/open_collaborations/products/search";

const SORT_FIELDS = {
  commission: "commission_rate",
  sales: "units_sold",
  price: "product_sales_price",
};

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
  const { keyword, sortBy = "commission", pageSize = 10 } = body;

  const requestBody = JSON.stringify(keyword ? { title_keywords: [keyword] } : {});
  const timestamp = String(Math.floor(Date.now() / 1000));
  const query = {
    app_key: appKey,
    timestamp,
    page_size: String(Math.min(Number(pageSize) || 10, 20)),
    sort_field: SORT_FIELDS[sortBy] || "commission_rate",
    sort_order: "DESC",
  };
  const sign = signTikTokRequest({ path: SEARCH_PATH, query, body: requestBody, appSecret });

  const url = new URL(`${API_BASE}${SEARCH_PATH}`);
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

    // Mapped into the same shape ProductStage/product-curate already use
    // for Shopee results — ratingStar is intentionally omitted, TikTok's
    // search response doesn't include one.
    const products = (data.data?.products || []).map((p) => ({
      itemId: `tiktok-${p.id}`,
      productName: p.title,
      commissionRate: p.commission?.rate != null ? Number(p.commission.rate) / 10000 : undefined,
      price: p.sales_price?.minimum_amount != null ? Number(p.sales_price.minimum_amount) : undefined,
      sales: p.units_sold,
      shopName: p.shop?.name,
      imageUrl: p.main_image_url,
      productLink: p.detail_link,
      offerLink: null,
      platform: "tiktok",
      platformIcon: "🎵",
      _tiktokProductId: p.id,
    }));
    return Response.json({ products });
  } catch (e) {
    return Response.json({ error: "เรียก TikTok API ไม่สำเร็จ: " + String(e.message || e) }, { status: 502 });
  }
}
