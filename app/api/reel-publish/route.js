// Publishes a video already hosted on Vercel Blob (public URL) as a
// Facebook Page Reel — verified live against
// https://developers.facebook.com/docs/video-api/guides/reels-publishing
// (2026-08). Three-phase flow: start (get a video_id) -> upload (Facebook
// fetches the file itself via file_url, so the video bytes never pass
// through this serverless function) -> finish (publish with the caption).
//
// Recommended source format is .mp4 — Pipeline Studio's own in-browser
// renderer currently outputs .webm (VP9/Opus), which is a listed-supported
// codec but not the recommended container; if Facebook rejects an
// uploaded .webm, convert to .mp4 first.
const GRAPH_VERSION = "v25.0";

async function getPageAccessToken(pageId, userToken) {
  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/me/accounts?fields=id,access_token&access_token=${encodeURIComponent(userToken)}`
  );
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error?.message || `ดึง page access token ไม่สำเร็จ (HTTP ${res.status})`);
  }
  const page = (data.data || []).find((p) => p.id === pageId);
  if (!page) throw new Error("ไม่พบเพจนี้ในรายชื่อเพจที่บัญชีนี้ดูแล");
  return page.access_token;
}

export async function POST(request) {
  const userToken = process.env.FB_USER_ACCESS_TOKEN;
  if (!userToken) {
    return Response.json({ error: "ยังไม่ได้ตั้งค่า FB_USER_ACCESS_TOKEN ใน Environment Variables" }, { status: 400 });
  }

  let body = {};
  try {
    body = await request.json();
  } catch {}
  const { pageId, videoUrl, caption } = body;
  if (!pageId || !videoUrl) {
    return Response.json({ error: "ต้องระบุ pageId และ videoUrl" }, { status: 400 });
  }

  try {
    const pageToken = await getPageAccessToken(pageId, userToken);

    // Phase 1: start
    const startRes = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/video_reels`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ upload_phase: "start", access_token: pageToken }),
    });
    const startData = await startRes.json();
    if (!startRes.ok || startData.error) {
      throw new Error(startData.error?.message || `เริ่ม upload session ไม่สำเร็จ (HTTP ${startRes.status})`);
    }
    const videoId = startData.video_id;

    // Phase 2: hand Facebook the Blob URL — it fetches the file itself
    const uploadRes = await fetch(`https://rupload.facebook.com/video-upload/${GRAPH_VERSION}/${videoId}`, {
      method: "POST",
      headers: {
        Authorization: `OAuth ${pageToken}`,
        file_url: videoUrl,
      },
    });
    const uploadData = await uploadRes.json().catch(() => ({}));
    if (!uploadRes.ok || uploadData.error) {
      throw new Error(uploadData.error?.message || `อัปโหลดวิดีโอไม่สำเร็จ (HTTP ${uploadRes.status})`);
    }

    // Phase 3: finish/publish
    const finishRes = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/video_reels`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        video_id: videoId,
        upload_phase: "finish",
        video_state: "PUBLISHED",
        description: caption || "",
        access_token: pageToken,
      }),
    });
    const finishData = await finishRes.json();
    if (!finishRes.ok || finishData.error) {
      throw new Error(finishData.error?.message || `โพสต์ Reel ไม่สำเร็จ (HTTP ${finishRes.status})`);
    }

    return Response.json({ videoId });
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 502 });
  }
}
