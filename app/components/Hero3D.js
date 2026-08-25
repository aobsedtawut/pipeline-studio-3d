"use client";

import { useEffect, useRef } from "react";

// Animated particle field behind the hero, built with Three.js (loaded via
// CDN <script> in layout.js, exposed as window.THREE). Purely decorative —
// if THREE hasn't loaded yet (slow network) the canvas just stays empty and
// the page still works fine.
export default function Hero3D() {
  const mountRef = useRef(null);

  useEffect(() => {
    let raf;
    let renderer, scene, camera, points, cleanupResize;
    let cancelled = false;

    function waitForThree(retries = 40) {
      if (cancelled) return;
      if (typeof window !== "undefined" && window.THREE) {
        init();
      } else if (retries > 0) {
        setTimeout(() => waitForThree(retries - 1), 100);
      }
    }

    function init() {
      const THREE = window.THREE;
      const mount = mountRef.current;
      if (!mount || cancelled) return;

      const width = mount.clientWidth || 800;
      const height = mount.clientHeight || 420;

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100);
      camera.position.z = 18;

      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height);
      mount.innerHTML = "";
      mount.appendChild(renderer.domElement);

      const COUNT = 900;
      const positions = new Float32Array(COUNT * 3);
      for (let i = 0; i < COUNT; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 40;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 22;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 30;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

      const mat = new THREE.PointsMaterial({
        size: 0.11,
        color: 0x8f6fff,
        transparent: true,
        opacity: 0.85,
      });
      points = new THREE.Points(geo, mat);
      scene.add(points);

      const mat2 = new THREE.PointsMaterial({ size: 0.07, color: 0x26e8da, transparent: true, opacity: 0.7 });
      const points2 = new THREE.Points(geo, mat2);
      points2.rotation.z = 0.4;
      scene.add(points2);

      let t = 0;
      function animate() {
        if (cancelled) return;
        t += 0.0022;
        points.rotation.y = t;
        points.rotation.x = Math.sin(t * 0.6) * 0.15;
        points2.rotation.y = -t * 0.7;
        renderer.render(scene, camera);
        raf = requestAnimationFrame(animate);
      }
      animate();

      const onResize = () => {
        if (!mount) return;
        const w = mount.clientWidth || width;
        const h = mount.clientHeight || height;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };
      window.addEventListener("resize", onResize);
      cleanupResize = () => window.removeEventListener("resize", onResize);
    }

    waitForThree();

    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      if (cleanupResize) cleanupResize();
      if (renderer) renderer.dispose();
    };
  }, []);

  return <div ref={mountRef} className="hero-canvas" aria-hidden="true" />;
}
