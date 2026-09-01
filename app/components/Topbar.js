"use client";

import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import HistoryDrawer from "./HistoryDrawer";

const NAV_ITEMS = [
  { href: "/", label: "🚀 Pipeline" },
  { href: "/post-reel", label: "📹 โพสต์ Reel" },
  { href: "/ads", label: "📣 ยิงแอด Facebook" },
];

// onLoadRun is only meaningful on the home page (it resumes pipeline
// state) — omit it on standalone pages like /post-reel and /ads and the
// History drawer just doesn't render there.
export default function Topbar({ onLoadRun }) {
  const { data: session } = useSession();
  const pathname = usePathname();

  return (
    <header className="topbar">
      <nav className="topbar-nav">
        {NAV_ITEMS.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className={`topbar-nav-link ${pathname === item.href ? "active" : ""}`}
          >
            {item.label}
          </a>
        ))}
      </nav>
      <div className="topbar-actions">
        {onLoadRun && <HistoryDrawer onLoad={onLoadRun} />}
        {session?.user && (
          <div className="topbar-user">
            {session.user.image && <img src={session.user.image} alt="" className="topbar-avatar" />}
            <span className="topbar-email">{session.user.email}</span>
            <button className="btn secondary small" onClick={() => signOut({ callbackUrl: "/signin" })}>
              ออกจากระบบ
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
