// Stage 0 — Shopee affiliate product search (productOfferV2 GraphQL query).
// Ported from shopee_pipeline/shopee_client.py so the whole pipeline runs as
// one Vercel app instead of a separate local Python script.
//
// Requires SHOPEE_APP_ID + SHOPEE_APP_SECRET as Vercel Environment Variables.
// Optional SHOPEE_API_BASE to switch region (defaults to Thailand).
//
// NOTE: field names / auth scheme were written from memory of Shopee's docs,
// not a live schema pull — if this errors, check the response body (returned
// as-is on failure below) against the current schema in your Shopee
// Affiliate Open API dashboard.

import { createHash } from "crypto";

const DEFAULT_API_BASE = "https://open-api.affiliate.shopee.co.th/graphql";

const PRODUCT_OFFER_QUERY = `
query($keyword: String, $page: Int, $limit: Int) {
  productOfferV2(keyword: $keyword, page: $page, limit: $limit) {
    nodes {
      itemId
      productName
      commissionRate
      commission
      price
      priceMin
      priceMax
      sales
      ratingStar
      shopName
      imageUrl
      productLink
      offerLink
    }
    pageInfo {
      page
      limit
      hasNextPage
    }
  }
}
`;

function sign(appId, secret, payload) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const baseString = `${appId}${timestamp}${payload}${secret}`;
  const signature = createHash("sha256").update(baseString, "utf8").digest("hex");
  return { timestamp, signature };
}

const SORT_KEYS = {
  commission: (n) => Number(n.commissionRate || 0),
  sales: (n) => Number(n.sales || 0),
  price: (n) => Number(n.price || 0),
  rating: (n) => Number(n.ratingStar || 0),
};

export async function POST(request) {
  const appId = process.env.SHOPEE_APP_ID;
  const secret = process.env.SHOPEE_APP_SECRET;
  const apiBase = process.env.SHOPEE_API_BASE || DEFAULT_API_BASE;

  if (!appId || !secret) {
    return Response.json(
      { error: "ยังไม่ได้ตั้งค่า SHOPEE_APP_ID / SHOPEE_APP_SECRET ใน Vercel Environment Variables" },
      { status: 400 }
    );
  }

  let body = {};
  try {
    body = await request.json();
  } catch {}
  const { keyword, sortBy = "commission", limit = 10 } = body;

  if (!keyword) {
    return Response.json({ error: "ต้องระบุ keyword" }, { status: 400 });
  }
  const sortKey = SORT_KEYS[sortBy];
  if (!sortKey) {
    return Response.json({ error: `sortBy ต้องเป็น commission, sales, price, หรือ rating (ได้ ${sortBy})` }, { status: 400 });
  }

  const fetchLimit = Math.max(Number(limit) || 10, 50); // over-fetch so client-side sort is meaningful
  const variables = { keyword, page: 1, limit: fetchLimit };
  const payload = JSON.stringify({ query: PRODUCT_OFFER_QUERY, variables });
  const { timestamp, signature } = sign(appId, secret, payload);

  try {
    const res = await fetch(apiBase, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`,
      },
      body: payload,
    });

    const text = await res.text();
    if (!res.ok) {
      return Response.json({ error: `Shopee API HTTP error ${res.status}: ${text}`.slice(0, 800) }, { status: 502 });
    }

    const data = JSON.parse(text);
    if (data.errors && data.errors.length) {
      return Response.json({ error: `Shopee API returned errors: ${JSON.stringify(data.errors)}`.slice(0, 800) }, { status: 502 });
    }

    const nodes = data?.data?.productOfferV2?.nodes || [];
    nodes.sort((a, b) => sortKey(b) - sortKey(a));

    return Response.json({ products: nodes.slice(0, Number(limit) || 10) });
  } catch (e) {
    return Response.json({ error: "เรียก Shopee API ไม่สำเร็จ: " + String(e.message || e) }, { status: 502 });
  }
}
