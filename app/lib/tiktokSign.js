import { createHmac } from "crypto";

// TikTok Shop's per-request HMAC-SHA256 signing algorithm — verified live
// against https://partner.tiktokshop.com/docv2/page/sign-your-api-request
// (2026-08). Distinct from Shopee's appId+timestamp+payload+secret scheme,
// do not confuse the two.
//
// 1. Sort all query params (excluding sign/access_token) alphabetically,
//    concatenate as key1value1key2value2...
// 2. Prepend the URL path
// 3. Append the exact raw request body string (not re-serialized) unless
//    multipart/form-data
// 4. Wrap: app_secret + input + app_secret
// 5. sign = hex(HMAC-SHA256(key=app_secret, message=wrapped))
export function signTikTokRequest({ path, query, body, appSecret }) {
  const sortedKeys = Object.keys(query)
    .filter((k) => k !== "sign" && k !== "access_token")
    .sort();
  const paramString = sortedKeys.map((k) => `${k}${query[k]}`).join("");
  let base = `${path}${paramString}`;
  if (body) base += body;
  const wrapped = `${appSecret}${base}${appSecret}`;
  return createHmac("sha256", appSecret).update(wrapped, "utf8").digest("hex");
}
