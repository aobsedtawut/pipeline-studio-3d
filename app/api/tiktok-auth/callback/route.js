import { NextResponse } from "next/server";
import { prisma } from "../../../lib/db";

const AUTH_BASE = process.env.TIKTOK_AUTH_BASE || "https://auth.tiktok-shops.com";

// Step 2 of the OAuth flow — TikTok redirects the creator's browser back
// here with a one-time code after they approve the connection. Exchanges
// it for access_token/refresh_token and persists them (Postgres — these
// rotate on refresh, they can't live in a static env var).
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const cookieState = request.cookies.get("tiktok_oauth_state")?.value;

  if (!code || !state || state !== cookieState) {
    return NextResponse.redirect(new URL("/?tiktok=error", request.url));
  }

  const appKey = process.env.TIKTOK_APP_KEY;
  const appSecret = process.env.TIKTOK_APP_SECRET;
  const url = new URL(`${AUTH_BASE}/api/v2/token/get`);
  url.searchParams.set("app_key", appKey);
  url.searchParams.set("app_secret", appSecret);
  url.searchParams.set("auth_code", code);
  url.searchParams.set("grant_type", "authorized_code");

  try {
    const res = await fetch(url.toString());
    const data = await res.json();
    // user_type 1 = creator (as opposed to a seller authorizing the app,
    // which is a different flow we don't want here).
    if (!res.ok || data.code !== 0 || data.data?.user_type !== 1) {
      return NextResponse.redirect(new URL("/?tiktok=error", request.url));
    }
    const { access_token, refresh_token, open_id, access_token_expire_in } = data.data;
    const expiresAt = new Date(Date.now() + access_token_expire_in * 1000);
    await prisma.tikTokAuth.upsert({
      where: { openId: open_id },
      update: { accessToken: access_token, refreshToken: refresh_token, expiresAt },
      create: { openId: open_id, accessToken: access_token, refreshToken: refresh_token, expiresAt },
    });
    const out = NextResponse.redirect(new URL("/?tiktok=connected", request.url));
    out.cookies.delete("tiktok_oauth_state");
    return out;
  } catch {
    return NextResponse.redirect(new URL("/?tiktok=error", request.url));
  }
}
