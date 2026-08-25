"use client";

import { useState } from "react";

export default function PostStage({ unlocked, meta, scenes, videoUrl }) {
  const [caption, setCaption] = useState(
    `${meta.hook || ""}\n\n${meta.cta || "กดลิงก์ช้อปเลย"}\n\n#รีวิว #ของใช้ในบ้าน`
  );
  const [status, setStatus] = useState(null);
  const [msg, setMsg] = useState("");

  const coverImage = scenes.find((s) => s.imageDataUrl)?.imageDataUrl;

  async function postToFacebook() {
    setStatus("loading");
    setMsg("");
    try {
      const res = await fetch("/api/post-facebook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: caption, imageDataUrl: coverImage }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus("ok");
        setMsg(`โพสต์แล้ว (id: ${data.postId})`);
      } else {
        setStatus("err");
        setMsg(data.error);
      }
    } catch (e) {
      setStatus("err");
      setMsg(String(e.message || e));
    }
  }

  function downloadVideo() {
    if (!videoUrl) return;
    const a = document.createElement("a");
    a.href = videoUrl;
    a.download = "clip_final.webm";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <div className={`stage ${unlocked ? "unlocked" : ""}`}>
      <div className="stage-head">
        <div className="stage-num">6</div>
        <h2>โพสต์ (Post)</h2>
      </div>
      <div className="stage-sub">
        โพสต์แคปชั่น + ภาพหน้าปกลง Facebook Page จริงผ่าน Graph API — ส่วนวิดีโอเต็มยังต้องดาวน์โหลดไปโพสต์เองก่อน
        (resumable video upload ยังไม่รวมในเวอร์ชันนี้ เพราะไฟล์วิดีโอใหญ่กว่าที่ serverless function รับได้ในครั้งเดียว)
      </div>

      <label className="field-label">แคปชั่น</label>
      <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={5} />

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
        <button className="btn" onClick={postToFacebook} disabled={status === "loading"}>
          {status === "loading" ? "กำลังโพสต์…" : "📘 โพสต์ลง Facebook Page (ข้อความ + ภาพปก)"}
        </button>
        <button className="btn secondary" onClick={downloadVideo} disabled={!videoUrl}>
          ⬇️ ดาวน์โหลดวิดีโอเพื่อโพสต์เอง
        </button>
      </div>
      {status === "ok" && <div className="status-pill ok" style={{ marginTop: 10 }}>{msg}</div>}
      {status === "err" && <div className="status-pill err" style={{ marginTop: 10 }}>{msg}</div>}

      <div className="hint" style={{ marginTop: 14 }}>
        ต้องตั้งค่า FB_PAGE_ID และ FB_PAGE_ACCESS_TOKEN ใน Vercel Environment Variables ก่อน (Page ที่มีสิทธิ์
        pages_manage_posts) — Facebook Group ไม่มี API โพสต์อัตโนมัติแล้วตั้งแต่ปี 2024 ต้องโพสต์เองผ่านเบราว์เซอร์
      </div>
    </div>
  );
}
