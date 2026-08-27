import { prisma } from "./db";

const AUTH_BASE = process.env.TIKTOK_AUTH_BASE || "https://auth.tiktok-shops.com";

async function refreshToken(auth) {
  const appKey = process.env.TIKTOK_APP_KEY;
  const appSecret = process.env.TIKTOK_APP_SECRET;
  const url = new URL(`${AUTH_BASE}/api/v2/token/refresh`);
  url.searchParams.set("app_key", appKey);
  url.searchParams.set("app_secret", appSecret);
  url.searchParams.set("refresh_token", auth.refreshToken);
  url.searchParams.set("grant_type", "refresh_token");

  const res = await fetch(url.toString());
  const data = await res.json();
  if (!res.ok || data.code !== 0) {
    throw new Error(`TikTok token refresh failed: ${JSON.stringify(data).slice(0, 300)}`);
  }
  const { access_token, refresh_token, access_token_expire_in } = data.data;
  const expiresAt = new Date(Date.now() + access_token_expire_in * 1000);
  return prisma.tikTokAuth.update({
    where: { id: auth.id },
    data: { accessToken: access_token, refreshToken: refresh_token, expiresAt },
  });
}

// Returns a valid (non-expired) TikTokAuth row for the connected creator,
// refreshing it first if it's within 5 minutes of expiring. Single-owner
// tool, so there's just one connected creator — takes the most recent row.
// Throws if nobody has completed the OAuth connect flow yet.
export async function getValidTikTokAuth() {
  const auth = await prisma.tikTokAuth.findFirst({ orderBy: { updatedAt: "desc" } });
  if (!auth) {
    throw new Error("ยังไม่ได้เชื่อมต่อ TikTok Shop — กดปุ่ม \"เชื่อมต่อ TikTok Shop\" ก่อน");
  }
  const soon = Date.now() + 5 * 60 * 1000;
  if (auth.expiresAt.getTime() < soon) {
    return refreshToken(auth);
  }
  return auth;
}
