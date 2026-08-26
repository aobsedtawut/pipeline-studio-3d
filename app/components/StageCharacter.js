"use client";

// Tiny cute mascots — one per pipeline stage, in the spirit of the simple
// blob/ghost/slime characters from the reference screenshot: a flat colored
// silhouette + two dot eyes, drawn with plain SVG primitives (no external
// art assets). Color comes from currentColor, so wrap in an element with
// `color` set to the stage's accent.
const SHAPES = {
  product: (
    <>
      <path d="M14 15 Q20 5 26 15" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <rect x="9" y="15" width="22" height="18" rx="5" fill="currentColor" />
    </>
  ),
  script: (
    <>
      <rect x="10" y="7" width="20" height="27" rx="3" fill="currentColor" />
      <rect x="14" y="22.5" width="8" height="2.4" rx="1.2" fill="#fff" opacity="0.55" />
      <rect x="14" y="27" width="12" height="2.4" rx="1.2" fill="#fff" opacity="0.55" />
    </>
  ),
  tts: (
    <>
      <rect x="14" y="5" width="12" height="20" rx="6" fill="currentColor" />
      <rect x="18" y="25" width="4" height="6" fill="currentColor" />
      <rect x="12" y="32" width="16" height="2.6" rx="1.3" fill="currentColor" />
    </>
  ),
  video: (
    <>
      <rect x="7" y="8" width="26" height="7" rx="2" fill="currentColor" />
      <polygon points="10,8 15,8 12,15 7,15" fill="#fff" opacity="0.3" />
      <polygon points="20,8 25,8 22,15 17,15" fill="#fff" opacity="0.3" />
      <rect x="7" y="17" width="26" height="17" rx="3" fill="currentColor" />
    </>
  ),
  export: (
    <>
      <rect x="8" y="12" width="24" height="22" rx="3" fill="currentColor" />
      <rect x="8" y="21" width="24" height="2.4" fill="#fff" opacity="0.3" />
      <rect x="17" y="5" width="6" height="10" rx="2" fill="currentColor" />
    </>
  ),
  post: <polygon points="21,5 33,33 21,26 9,33" fill="currentColor" />,
};

const EYE_Y = { product: 24, script: 17, tts: 15, video: 26, export: 28, post: 20 };

export default function StageCharacter({ kind, size = 34, className = "" }) {
  const ey = EYE_Y[kind] ?? 22;
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} className={className} aria-hidden="true">
      {SHAPES[kind]}
      <circle cx="16" cy={ey} r="2.6" fill="#fff" />
      <circle cx="24" cy={ey} r="2.6" fill="#fff" />
      <circle cx="16.7" cy={ey + 0.3} r="1.1" fill="#1a1a2e" />
      <circle cx="24.7" cy={ey + 0.3} r="1.1" fill="#1a1a2e" />
    </svg>
  );
}
