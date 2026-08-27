"use client";

// The app's icon mark — a 7th mascot in the same flat-silhouette +
// dot-eyes family as StageCharacter.js (a rocket), replacing the
// placeholder 🚀 emoji used before. All detail circles are solid
// white/dark like the other mascots' eyes (not background-matched
// cutouts), so this reads correctly on any background.
export default function Logo({ size = 32, color = "currentColor", className = "" }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} className={className} aria-hidden="true">
      <polygon points="20,26 36,34 30,34" fill={color} opacity="0.35" />
      <polygon points="20,26 4,34 10,34" fill={color} opacity="0.35" />
      <path d="M20 4 C 12 4 10 17 10 27 L 30 27 C 30 17 28 4 20 4 Z" fill={color} />
      <polygon points="15,27 25,27 20,35" fill="#d9860e" />
      <circle cx="20" cy="15" r="3.2" fill="#fff" />
      <circle cx="16" cy="22" r="2.6" fill="#fff" />
      <circle cx="24" cy="22" r="2.6" fill="#fff" />
      <circle cx="16.7" cy="22.3" r="1.1" fill="#1a1a2e" />
      <circle cx="24.7" cy="22.3" r="1.1" fill="#1a1a2e" />
    </svg>
  );
}
