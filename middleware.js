export { default } from "next-auth/middleware";

// Everything requires a signed-in, allowlisted Google account except
// NextAuth's own routes, the sign-in page (excluding /signin would
// otherwise create a redirect loop), /api/blob-upload — Vercel Blob's own
// onUploadCompleted webhook calls back into that route with no user
// session, so it checks auth manually instead (see its own file) — and
// /api/ads-sync, which Vercel Cron also calls with no session; that route
// checks a CRON_SECRET bearer token itself (see its own file).
export const config = {
  matcher: ["/((?!api/auth|api/blob-upload|api/ads-sync|signin|_next/static|_next/image|favicon.ico).*)"],
};
