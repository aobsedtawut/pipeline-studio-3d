import SignInButton from "../components/SignInButton";
import Logo from "../components/Logo";

export const metadata = { title: "เข้าสู่ระบบ · Pipeline Studio" };

export default function SignInPage({ searchParams }) {
  const denied = searchParams?.error === "AccessDenied";

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div className="stage unlocked" style={{ maxWidth: 380, width: "100%", textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", color: "var(--accent)", marginBottom: 8 }}>
          <Logo size={56} />
        </div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 24 }}>Pipeline Studio</h1>
        <p className="hint" style={{ marginTop: 6, marginBottom: 20 }}>
          เข้าสู่ระบบด้วยบัญชี Google ที่ได้รับอนุญาตเท่านั้น
        </p>
        {denied && (
          <div className="status-pill err" style={{ marginBottom: 16, justifyContent: "center", width: "100%" }}>
            บัญชีนี้ไม่ได้รับอนุญาตให้เข้าใช้งาน
          </div>
        )}
        <SignInButton />
      </div>
    </div>
  );
}
