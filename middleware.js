export { default } from "next-auth/middleware";

// Everything requires a signed-in, allowlisted Google account except
// NextAuth's own routes, the sign-in page (excluding /signin would
// otherwise create a redirect loop), and /api/blob-upload — Vercel Blob's
// own onUploadCompleted webhook calls back into that route with no user
// session, so it checks auth manually instead (see its own file).
export const config = {
  matcher: ["/((?!api/auth|api/blob-upload|signin|_next/static|_next/image|favicon.ico).*)"],
};
