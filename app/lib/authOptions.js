import GoogleProvider from "next-auth/providers/google";

// Access is gated to a fixed email allowlist — this is a single-owner tool,
// not a public sign-up app. Defaults to the owner's own email if
// ALLOWED_EMAILS isn't set, so Google login works out of the box for them
// while still rejecting every other Google account.
const allowedEmails = (process.env.ALLOWED_EMAILS || "sedtawut.aob@gmail.com")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  pages: {
    signIn: "/signin",
  },
  callbacks: {
    async signIn({ user }) {
      return allowedEmails.includes((user.email || "").toLowerCase());
    },
  },
};
