"use client";

import { useEffect, useState } from "react";
import { upload } from "@vercel/blob/client";
import Logo from "../components/Logo";

export default function PostReelPage() {
  const [pages, setPages] = useState([]);
  const [pagesStatus, setPagesStatus] = useState("loading"); // loading | ok | err
  const [pagesMsg, setPagesMsg] = useState("");
  const [selectedPageId, setSelectedPageId] = useState("");
  const [file, setFile] = useState(null);
  const [caption, setCaption] = useState("");
  const [status, setStatus] = useState(null); // null | uploading | publishing | ok | err
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/facebook-pages")
      .then((r) => r.json())
      .then((d) => {
        if (d.pages) {
          setPages(d.pages);
          setPagesStatus("ok");
          if (d.pages.length) setSelectedPageId(d.pages[0].id);
        } else {
          setPagesStatus("err");
          setPagesMsg(d.error || "ดึงรายชื่อเพจไม่สำเร็จ");
        }
      })
      .catch((e) => {
        setPagesStatus("err");
        setPagesMsg(String(e.message || e));
      });
  }, []);

  async function publish() {
    if (!file || !selectedPageId) return;
    setStatus("uploading");
    setMsg("");
    try {
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/blob-upload",
      });

      setStatus("publishing");
      const res = await fetch("/api/reel-publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId: selectedPageId, videoUrl: blob.url, caption }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "โพสต์ไม่สำเร็จ");
      setStatus("ok");
      setMsg(`โพสต์ Reel สำเร็จ (video id: ${data.videoId})`);
    } catch (e) {
      setStatus("err");
      setMsg(String(e.message || e));
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "48px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <span style={{ color: "var(--accent)" }}>
          <Logo size={32} />
        </span>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 22 }}>โพสต์ Reel ลง Facebook</h1>
      </div>
      <p className="hint" style={{ marginBottom: 20 }}>
        อัปโหลดวิดีโอ + แคปชั่น เลือกเพจที่จะโพสต์ แล้วกดโพสต์เป็น Reel ได้ทันที — แยกต่างหากจาก pipeline หลัก ใช้กับไฟล์วิดีโอไหนก็ได้
      </p>

      <div className="stage unlocked">
        <label className="field-label">เลือกเพจ</label>
        {pagesStatus === "loading" && <div className="hint">กำลังโหลดรายชื่อเพจ…</div>}
        {pagesStatus === "err" && <div className="hint warn">{pagesMsg}</div>}
        {pagesStatus === "ok" && pages.length === 0 && (
          <div className="hint warn">บัญชีนี้ไม่ได้ดูแลเพจไหนเลย</div>
        )}
        {pagesStatus === "ok" && pages.length > 0 && (
          <select value={selectedPageId} onChange={(e) => setSelectedPageId(e.target.value)}>
            {pages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}

        <label className="field-label" style={{ marginTop: 14 }}>
          ไฟล์วิดีโอ (แนะนำ .mp4, 9:16, ยาว 3-90 วินาที)
        </label>
        <input type="file" accept="video/*" onChange={(e) => setFile(e.target.files[0] || null)} />

        <label className="field-label" style={{ marginTop: 14 }}>
          แคปชั่น
        </label>
        <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={5} />

        <div style={{ marginTop: 18 }}>
          <button
            className="btn"
            onClick={publish}
            disabled={!file || !selectedPageId || status === "uploading" || status === "publishing"}
          >
            {status === "uploading"
              ? "กำลังอัปโหลดวิดีโอ…"
              : status === "publishing"
                ? "กำลังโพสต์ลง Facebook…"
                : "📹 โพสต์ Reel"}
          </button>
        </div>
        {status === "ok" && (
          <div className="status-pill ok" style={{ marginTop: 12 }}>
            {msg}
          </div>
        )}
        {status === "err" && (
          <div className="status-pill err" style={{ marginTop: 12 }}>
            {msg}
          </div>
        )}
      </div>
    </div>
  );
}
