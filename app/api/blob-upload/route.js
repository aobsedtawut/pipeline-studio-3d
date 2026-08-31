import { handleUpload } from "@vercel/blob/client";
import { getServerSession } from "next-auth";
import { authOptions } from "../../lib/authOptions";

// Excluded from middleware.js's Google-auth gate (see its matcher) because
// Vercel Blob's own onUploadCompleted webhook calls back into this same
// route with no user session attached — the middleware would block it.
// Auth is checked manually below, on the token-generation step only,
// which is the step that actually needs it.
export async function POST(request) {
  const body = await request.json();

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        const session = await getServerSession(authOptions);
        if (!session) throw new Error("ยังไม่ได้เข้าสู่ระบบ");
        return {
          allowedContentTypes: ["video/mp4", "video/webm", "video/quicktime"],
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {},
    });
    return Response.json(jsonResponse);
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 400 });
  }
}
