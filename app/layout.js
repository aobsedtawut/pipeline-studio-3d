import "./globals.css";

export const metadata = {
  title: "Pipeline Studio",
  description:
    "One-page affiliate content pipeline: script -> voiceover -> 3D-templated video -> export -> post. Runs client-side, no server render limits.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
        {/* Three.js + GSAP loaded from CDN — this is a real hosted Vercel app
            (not a claude.ai Artifact), so external script tags are fine. */}
        <script src="https://unpkg.com/three@0.160.0/build/three.min.js" defer></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js" defer></script>
      </head>
      <body>{children}</body>
    </html>
  );
}
