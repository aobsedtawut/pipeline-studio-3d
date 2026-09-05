"use client";

import { useEffect, useRef } from "react";
import { useMotionValue, animate } from "motion/react";

// Count-up number, same pattern as app/components/PipelineHUD.js's
// AnimatedNumber — reused here instead of re-invented.
function AnimatedNumber({ value, decimals = 0, prefix = "", suffix = "" }) {
  const mv = useMotionValue(0);
  const spanRef = useRef(null);

  useEffect(() => {
    const controls = animate(mv, value, {
      duration: 0.6,
      ease: "easeOut",
      onUpdate: (v) => {
        if (spanRef.current) {
          spanRef.current.textContent = prefix + v.toLocaleString("th-TH", { maximumFractionDigits: decimals, minimumFractionDigits: decimals }) + suffix;
        }
      },
    });
    return controls.stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, decimals, prefix, suffix]);

  return <span ref={spanRef}>{prefix + (0).toFixed(decimals) + suffix}</span>;
}

export default function KpiStrip({ totals }) {
  if (!totals) return null;

  const cards = [
    { key: "spend", icon: "💸", label: "งบที่ใช้", value: totals.spend, decimals: 0, suffix: " ฿" },
    {
      key: "results",
      icon: "🎯",
      label: "ผลลัพธ์",
      value: totals.results,
      textValue: totals.hasMixedResultTypes ? "หลายประเภท" : undefined,
      decimals: 0,
    },
    {
      key: "costPerResult",
      icon: "🧮",
      label: "ต้นทุน/ผลลัพธ์",
      value: totals.costPerResult || 0,
      decimals: 1,
      suffix: " ฿",
    },
    { key: "impressions", icon: "👁", label: "การมองเห็น", value: totals.impressions, decimals: 0 },
    { key: "clicks", icon: "👆", label: "คลิก", value: totals.clicks, decimals: 0 },
  ];

  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
      {cards.map((c) => (
        <div
          key={c.key}
          className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[0_6px_20px_var(--shadow)]"
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base leading-none">{c.icon}</span>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-faint)]">{c.label}</span>
          </div>
          <div className="font-[var(--font-display)] font-bold text-xl tabular-nums text-[var(--ink)]">
            {c.textValue || (c.value === null || c.value === undefined ? "—" : <AnimatedNumber value={c.value} decimals={c.decimals} suffix={c.suffix || ""} />)}
          </div>
        </div>
      ))}
    </div>
  );
}
