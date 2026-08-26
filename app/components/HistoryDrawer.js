"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

// Slide-in panel listing saved PipelineRun rows from /api/runs. Both API
// calls degrade gracefully (see app/api/runs) if DATABASE_URL isn't set, so
// this just shows a friendly empty/error state instead of breaking.
export default function HistoryDrawer({ onLoad }) {
  const [open, setOpen] = useState(false);
  const [runs, setRuns] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | loading | ok | empty | err

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setStatus("loading");
    fetch("/api/runs")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const list = data.runs || [];
        setRuns(list);
        setStatus(list.length ? "ok" : "empty");
      })
      .catch(() => !cancelled && setStatus("err"));
    return () => {
      cancelled = true;
    };
  }, [open]);

  async function loadRun(id) {
    try {
      const res = await fetch(`/api/runs/${id}`);
      const data = await res.json();
      if (data.run) {
        onLoad(data.run);
        setOpen(false);
      }
    } catch {
      // ignore — resume just won't happen this click
    }
  }

  return (
    <>
      <button className="btn secondary small" onClick={() => setOpen(true)}>
        🕘 History
      </button>
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/40 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.div
              className="fixed top-0 right-0 h-full w-full max-w-sm bg-[var(--surface)] border-l border-[var(--border)] z-50 p-5 overflow-y-auto"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 32 }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-[var(--font-display)] font-bold text-lg text-[var(--ink)]">Run ก่อนหน้า</h3>
                <button className="btn ghost small" onClick={() => setOpen(false)}>
                  ✕
                </button>
              </div>

              {status === "loading" && <div className="hint">กำลังโหลด…</div>}
              {status === "err" && (
                <div className="hint">โหลดประวัติไม่ได้ — ยังไม่ได้ตั้งค่า DATABASE_URL หรือฐานข้อมูลไม่พร้อม</div>
              )}
              {status === "empty" && <div className="hint">ยังไม่มี run ที่บันทึกไว้</div>}

              <div className="flex flex-col gap-2">
                {runs.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => loadRun(r.id)}
                    className="text-left scene-card hover:border-[var(--accent)] transition-colors"
                  >
                    <div className="font-semibold text-sm text-[var(--ink)]">{r.productName || "(ไม่ระบุชื่อ)"}</div>
                    <div className="hint">
                      {r.stage} · {new Date(r.updatedAt).toLocaleString("th-TH")}
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
