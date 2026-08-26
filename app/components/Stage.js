"use client";

import { motion } from "motion/react";
import StageCharacter from "./StageCharacter";

// Entrance variants — the parent stage list in page.js sets `staggerChildren`
// so cards fade+rise in one after another, matching the old GSAP stagger.
export const stageCardVariants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 24 } },
};

// Shared shell for every pipeline stage card — staggered entrance + a subtle
// hover lift once unlocked. Keeps the existing .stage/.stage-head/.stage-num
// CSS (globals.css) as the visual base so it stays theme-consistent with the
// legacy stage components; motion only adds movement on top.
//
// `character` + `accent` give each stage its own mascot + color identity
// (matches the character-per-stage nav in page.js); `num` is a plain
// fallback badge for anywhere a character isn't set.
export default function Stage({ num, character, accent, title, sub, unlocked, children }) {
  return (
    <motion.div
      className={`stage ${unlocked ? "unlocked" : ""}`}
      style={accent ? { "--stage-accent": `var(${accent})` } : undefined}
      variants={stageCardVariants}
      whileHover={unlocked ? { y: -3 } : undefined}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
    >
      <div className="stage-head">
        <div className="stage-num">{character ? <StageCharacter kind={character} size={26} /> : num}</div>
        <h2>{title}</h2>
      </div>
      {sub && <div className="stage-sub">{sub}</div>}
      {children}
    </motion.div>
  );
}
