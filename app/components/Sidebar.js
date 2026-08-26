"use client";

import { motion } from "motion/react";
import StageCharacter from "./StageCharacter";

// Left nav — the mascot-per-stage picker that used to sit as a horizontal
// row in the hero, now a persistent sidebar so it's reachable while
// scrolled deep into any stage.
export default function Sidebar({ stageMeta, stageIndex, onNavigate }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand" aria-hidden="true">
        🚀
      </div>
      <nav className="sidebar-nav">
        {stageMeta.map((s, i) => {
          const state = i < stageIndex ? "done" : i === stageIndex ? "active" : "pending";
          return (
            <motion.button
              key={s.key}
              type="button"
              onClick={() => onNavigate(s.key)}
              whileHover={{ x: 3 }}
              whileTap={{ scale: 0.94 }}
              className="sidebar-item"
              title={s.label}
              style={{
                color: `var(${s.accent})`,
                borderColor: state === "done" ? "var(--ok)" : state === "active" ? `var(${s.accent})` : "transparent",
                background: state === "active" ? `color-mix(in srgb, var(${s.accent}) 14%, var(--surface))` : "transparent",
                opacity: state === "pending" ? 0.55 : 1,
              }}
            >
              <StageCharacter kind={s.key} size={26} />
              <span className="sidebar-item-label">{s.label}</span>
            </motion.button>
          );
        })}
      </nav>
    </aside>
  );
}
