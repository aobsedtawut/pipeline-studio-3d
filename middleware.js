export { default } from "next-auth/middleware";

// Everything requires a signed-in, allowlisted Google account except
// NextAuth's own routes and the sign-in page itself (excluding /signin would
// otherwise create a redirect loop).
export const config = {
  matcher: ["/((?!api/auth|signin|_next/static|_next/image|favicon.ico).*)"],
};
