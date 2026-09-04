"use client";

const SUM_METRICS = new Set(["spend", "results", "impressions", "clicks"]);

function aggregateByDate(rows, metric) {
  const byDate = new Map();
  for (const r of rows) {
    const v = r[metric];
    if (v === null || v === undefined) continue;
    if (!byDate.has(r.date)) byDate.set(r.date, { sum: 0, count: 0 });
    const e = byDate.get(r.date);
    e.sum += v;
    e.count += 1;
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, e]) => ({ date, value: SUM_METRICS.has(metric) ? e.sum : e.sum / e.count }));
}

// No charting dependency — a hand-rolled inline-SVG polyline is enough for
// one account's daily data (matches this codebase's existing preference
// for CSS/motion over new libraries, see app/components/PipelineHUD.js).
export default function TrendChart({ rows, metric, label, decimals = 0, height = 120 }) {
  const points = aggregateByDate(rows || [], metric);
  if (points.length < 2) {
    return <div className="hint">ต้องมีข้อมูลอย่างน้อย 2 วันถึงจะแสดงกราฟเทรนด์ได้</div>;
  }

  const width = 600;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const padY = 12;

  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * width;
    const y = height - padY - ((p.value - min) / range) * (height - padY * 2);
    return [x, y];
  });
  const path = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const last = points[points.length - 1].value;

  return (
    <div>
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-faint)]">{label}</span>
        <span className="font-[var(--font-display)] font-bold text-sm text-[var(--ink)]">
          {last.toLocaleString("th-TH", { maximumFractionDigits: decimals })}
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height }} preserveAspectRatio="none">
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        {coords.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={2.5} fill="var(--accent-2)" />
        ))}
      </svg>
    </div>
  );
}
