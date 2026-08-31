// Lists every Facebook Page the FB_USER_ACCESS_TOKEN account administers —
// one user token instead of a separate page token per page, so adding or
// removing a page you manage doesn't need a code/env change. Page tokens
// themselves are never sent to the client; /api/reel-publish re-fetches
// them server-side at publish time.
const GRAPH_VERSION = "v25.0";

export async function GET() {
  const token = process.env.FB_USER_ACCESS_TOKEN;
  if (!token) {
    return Response.json({ error: "ยังไม่ได้ตั้งค่า FB_USER_ACCESS_TOKEN ใน Environment Variables" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/me/accounts?fields=id,name&access_token=${encodeURIComponent(token)}`
    );
    const data = await res.json();
    if (!res.ok || data.error) {
      return Response.json({ error: data.error?.message || `ดึงรายชื่อเพจไม่สำเร็จ (HTTP ${res.status})` }, { status: 502 });
    }
    const pages = (data.data || []).map((p) => ({ id: p.id, name: p.name }));
    return Response.json({ pages });
  } catch (e) {
    return Response.json({ error: "เรียก Facebook API ไม่สำเร็จ: " + String(e.message || e) }, { status: 502 });
  }
}
