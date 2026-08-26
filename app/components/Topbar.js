"use client";

import { useSession, signOut } from "next-auth/react";
import HistoryDrawer from "./HistoryDrawer";

export default function Topbar({ onLoadRun }) {
  const { data: session } = useSession();

  return (
    <header className="topbar">
      <span className="topbar-title">Pipeline Studio</span>
      <div className="topbar-actions">
        <HistoryDrawer onLoad={onLoadRun} />
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
