"use client";

import { useEffect, useRef, useState } from "react";
import Hero3D from "./components/Hero3D";
import ScriptStage from "./components/ScriptStage";
import TtsStage from "./components/TtsStage";
import VideoStage from "./components/VideoStage";
import ExportStage from "./components/ExportStage";
import PostStage from "./components/PostStage";

const STAGE_LABELS = ["สคริปต์", "พากย์เสียง", "ตัดต่อ+ซับ", "Export", "โพสต์"];

export default function Page() {
  const [scenes, setScenes] = useState([]);
  const [meta, setMeta] = useState({});
  const [scriptDone, setScriptDone] = useState(false);
  const [ttsDone, setTtsDone] = useState(false);
  const [videoDone, setVideoDone] = useState(false);
  const [videoBlob, setVideoBlob] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [exportDone, setExportDone] = useState(false);
  const wrapRef = useRef(null);

  const stageIndex = exportDone ? 4 : videoDone ? 3 : ttsDone ? 2 : scriptDone ? 1 : 0;
  const totalDuration = scenes.length ? scenes[scenes.length - 1].end_sec : 0;

  useEffect(() => {
    let tries = 0;
    const id = setInterval(() => {
      tries++;
      if (window.gsap && wrapRef.current) {
        window.gsap.fromTo(
          ".stage",
          { opacity: 0, y: 24 },
          { opacity: (i, el) => (el.classList.contains("unlocked") ? 1 : 0.55), y: 0, duration: 0.6, stagger: 0.08, ease: "power2.out" }
        );
        clearInterval(id);
      } else if (tries > 40) {
        clearInterval(id);
      }
    }, 100);
    return () => clearInterval(id);
  }, []);

  return (
    <div ref={wrapRef}>
      <header className="hero">
        <Hero3D />
        <div className="wrap hero-inner">
          <span className="eyebrow">🚀 Pipeline Studio — All-in-one, client-rendered</span>
          <h1 className="title">สคริปต์ → เสียง → วิดีโอ 3D → Export → โพสต์ ในหน้าเดียว</h1>
          <p className="dek">
            ทุกขั้นตอนของ affiliate content pipeline รวมในหน้าเดียว วิดีโอเรนเดอร์ในเบราว์เซอร์คุณเอง
            (ไม่ติด serverless time limit) ด้วยเทมเพลต 3D ที่สร้างจาก Three.js
          </p>
          <div className="stage-track">
            {STAGE_LABELS.map((label, i) => (
              <span key={label} className={`stage-chip ${i < stageIndex ? "done" : i === stageIndex ? "active" : ""}`}>
                {i + 1}. {label}
              </span>
            ))}
          </div>
        </div>
      </header>

      <div className="wrap">
        <ScriptStage
          unlocked={true}
          scenes={scenes}
          setScenes={setScenes}
          meta={meta}
          setMeta={setMeta}
          done={scriptDone}
          onDone={() => setScriptDone(true)}
        />

        <TtsStage
          unlocked={scriptDone}
          scenes={scenes}
          setScenes={setScenes}
          done={ttsDone}
          onDone={() => setTtsDone(true)}
        />

        <VideoStage
          unlocked={ttsDone}
          scenes={scenes}
          setScenes={setScenes}
          done={videoDone}
          onDone={(blob, url) => {
            setVideoBlob(blob);
            setVideoUrl(url);
            setVideoDone(true);
          }}
        />

        <ExportStage
          unlocked={videoDone}
          videoBlob={videoBlob}
          videoUrl={videoUrl}
          duration={totalDuration}
          done={exportDone}
          onDone={() => setExportDone(true)}
        />

        <PostStage unlocked={exportDone} meta={meta} scenes={scenes} videoUrl={videoUrl} />

        <footer>
          Pipeline Studio · เรนเดอร์ทุกอย่างในเบราว์เซอร์ ยกเว้นสคริปต์ AI-assist / TTS / โพสต์ Facebook ที่ผ่าน
          serverless routes
        </footer>
      </div>
    </div>
  );
}
