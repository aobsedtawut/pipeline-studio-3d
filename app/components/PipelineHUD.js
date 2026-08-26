"use client";

import { useEffect, useRef } from "react";
import { motion, useMotionValue, animate } from "motion/react";

function AnimatedNumber({ value, decimals = 0, suffix = "" }) {
  const mv = useMotionValue(0);
  const spanRef = useRef(null);

  useEffect(() => {
    const controls = animate(mv, value, {
      duration: 0.6,
      ease: "easeOut",
      onUpdate: (v) => {
        if (spanRef.current) spanRef.current.textContent = v.toFixed(decimals) + suffix;
      },
    });
    return controls.stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, decimals, suffix]);

  return <span ref={spanRef}>{(0).toFixed(decimals) + suffix}</span>;
}

const ROWS = [
  { key: "scenes", icon: "🎬", label: "ฉาก", max: 6, suffix: "" },
  { key: "duration", icon: "⏱", label: "ความยาว", max: 90, suffix: "s", decimals: 1 },
  { key: "words", icon: "✍️", label: "คำ", max: 60, suffix: "" },
  { key: "progress", icon: "✅", label: "ความคืบหน้า", max: 100, suffix: "%" },
];

// Cute animated stat panel, inspired by the city-builder-style HUD reference
// the user shared: rounded glass card, icon + label + count-up value + mini
// progress bar per row.
export default function PipelineHUD({ scenes, stageIndex, totalStages = 6 }) {
  const scenesCount = scenes.length;
  const totalDuration = scenesCount ? scenes[scenesCount - 1].end_sec : 0;
  const wordsCount = scenes.reduce(
    (sum, s) => sum + (s.voiceover_text || "").trim().split(/\s+/).filter(Boolean).length,
    0
  );
  const progress = Math.round((stageIndex / (totalStages - 1)) * 100);
  const values = { scenes: scenesCount, duration: totalDuration, words: wordsCount, progress };

  return (
    <div className="animate-in fade-in slide-in-from-top-4 duration-500 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur-md p-4 shadow-[0_10px_30px_var(--shadow)] max-w-xs">
      <div className="grid grid-cols-[auto_1fr_auto] gap-x-3 gap-y-2.5 items-center">
        {ROWS.map((r) => {
          const v = values[r.key];
          const max = Math.max(r.max, v);
          return (
            <div className="contents" key={r.key}>
              <span className="text-base leading-none">{r.icon}</span>
              <div className="flex flex-col gap-1 min-w-0">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-faint)]">
                  {r.label}
                </span>
                <div className="h-1.5 w-full rounded-full bg-[var(--surface-2)] overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent-2)]"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, (v / max) * 100)}%` }}
                    transition={{ type: "spring", stiffness: 120, damping: 20 }}
                  />
                </div>
              </div>
              <span className="font-[var(--font-display)] font-bold text-sm tabular-nums text-[var(--ink)]">
                <AnimatedNumber value={v} decimals={r.decimals || 0} suffix={r.suffix} />
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
