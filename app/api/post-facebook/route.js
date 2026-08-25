// Posts to a Facebook Page via the Graph API — Pages are still fully
// supported headlessly (unlike Groups, whose posting API Meta discontinued
// in 2024). Requires FB_PAGE_ID and FB_PAGE_ACCESS_TOKEN as Vercel env vars
// (a Page access token with pages_manage_posts permission).
//
// SCOPE NOTE: this posts text + a single still image (small payload, fits
// well within serverless request-body limits). It does NOT upload the
// rendered video directly — Graph API video upload for a file this size
// needs a resumable (chunked) upload session, which is a meaningfully
// bigger piece of code and hasn't been built/tested in this pass. For now,
// download the clip from Stage 5 and post the video manually; this route
// gets your caption + a cover image up as a real post so the rest of the
// workflow isn't blocked on that.
//
// This endpoint is written from documented Graph API shape but has NOT been
// exercised against a live Page in this environment (no test app/token
// available here) — verify against your app's current permissions and the
// current Graph API version before relying on it.

export async function POST(request) {
  const pageId = process.env.FB_PAGE_ID;
  const token = process.env.FB_PAGE_ACCESS_TOKEN;
  if (!pageId || !token) {
    return Response.json(
      { error: "ยังไม่ได้ตั้งค่า FB_PAGE_ID และ FB_PAGE_ACCESS_TOKEN ใน Vercel Environment Variables" },
      { status: 400 }
    );
  }

  let body = {};
  try {
    body = await request.json();
  } catch {}
  const { message, imageDataUrl } = body;
  if (!message || !message.trim()) {
    return Response.json({ error: "ไม่มีข้อความโพสต์" }, { status: 400 });
  }

  const GRAPH_VERSION = "v21.0"; // verify this is still current before relying on it

  try {
    if (imageDataUrl) {
      const match = imageDataUrl.match(/^data:(.+?);base64,(.+)$/);
      if (!match) throw new Error("รูปภาพไม่ถูกต้อง");
      const [, mime, b64] = match;
      const buf = Buffer.from(b64, "base64");
      const form = new FormData();
      form.append("caption", message);
      form.append("access_token", token);
      form.append("source", new Blob([buf], { type: mime }), "cover.jpg");

      const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/photos`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || `Graph API error ${res.status}`);
      return Response.json({ ok: true, postId: data.post_id || data.id });
    } else {
      const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/feed`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, access_token: token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || `Graph API error ${res.status}`);
      return Response.json({ ok: true, postId: data.id });
    }
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 502 });
  }
}
