"use client";

import { signIn } from "next-auth/react";

export default function SignInButton() {
  return (
    <button className="btn" style={{ width: "100%", justifyContent: "center" }} onClick={() => signIn("google", { callbackUrl: "/" })}>
      เข้าสู่ระบบด้วย Google
    </button>
  );
}
