import { NextResponse } from "next/server";
import { randomBytes } from "crypto";

// Step 1 of TikTok Shop's Creator OAuth flow — redirects the browser to
// TikTok's own login/consent screen. The creator must be an approved
// TikTok Shop Creator Affiliate account; this can't be done server-side
// with just app credentials the way Shopee's static-secret auth works.
// See https://partner.tiktokshop.com/docv2/page/creator-authorization-guide
export async function GET() {
  const appKey = process.env.TIKTOK_APP_KEY;
  if (!appKey) {
    return Response.json({ error: "ยังไม่ได้ตั้งค่า TIKTOK_APP_KEY ใน Environment Variables" }, { status: 400 });
  }
  const state = randomBytes(16).toString("hex");
  const authUrl = `https://shop.tiktok.com/alliance/creator/auth?app_key=${encodeURIComponent(appKey)}&state=${state}`;
  const res = NextResponse.redirect(authUrl);
  res.cookies.set("tiktok_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return res;
}
