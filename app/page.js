"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import Hero3D from "./components/Hero3D";
import PipelineHUD from "./components/PipelineHUD";
import HistoryDrawer from "./components/HistoryDrawer";
import ProductStage from "./components/ProductStage";
import ScriptStage from "./components/ScriptStage";
import TtsStage from "./components/TtsStage";
import VideoStage from "./components/VideoStage";
import ExportStage from "./components/ExportStage";
import PostStage from "./components/PostStage";

const STAGE_LABELS = ["เลือกสินค้า", "สคริปต์", "พากย์เสียง", "ตัดต่อ+ซับ", "Export", "โพสต์"];

const stageListVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

export default function Page() {
  const [scenes, setScenes] = useState([]);
  const [meta, setMeta] = useState({});
  const [productDone, setProductDone] = useState(false);
  const [scriptDone, setScriptDone] = useState(false);
  const [ttsDone, setTtsDone] = useState(false);
  const [videoDone, setVideoDone] = useState(false);
  const [videoBlob, setVideoBlob] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [exportDone, setExportDone] = useState(false);
  const runIdRef = useRef(null);
  const saveTimerRef = useRef(null);

  const stageIndex = exportDone ? 5 : videoDone ? 4 : ttsDone ? 3 : scriptDone ? 2 : productDone ? 1 : 0;
  const totalDuration = scenes.length ? scenes[scenes.length - 1].end_sec : 0;

  // Autosave run history (Postgres, optional — silently no-ops without
  // DATABASE_URL). Debounced so fast edits (typing a caption, etc.) don't
  // spam the API.
  useEffect(() => {
    if (!meta.productName) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const payload = { meta, scenes, stage: STAGE_LABELS[stageIndex] };
      const req = runIdRef.current
        ? fetch(`/api/runs/${runIdRef.current}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : fetch("/api/runs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      req
        .then((r) => r.json())
        .then((data) => {
          if (!runIdRef.current && data.run?.id) runIdRef.current = data.run.id;
        })
        .catch(() => {});
    }, 800);
    return () => clearTimeout(saveTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta, scenes, stageIndex]);

  function resumeRun(run) {
    runIdRef.current = run.id;
    const restoredScenes = run.scenes || [];
    setMeta(run.meta || {});
    setScenes(restoredScenes);
    setProductDone(!!(run.meta?.chosenProduct || run.meta?.productName));
    setScriptDone(restoredScenes.length > 0);
    setTtsDone(restoredScenes.length > 0 && restoredScenes.every((s) => s.audioDataUrl));
    // Rendered video/export output isn't persisted (blobs don't belong in a
    // JSON column) — media + audio are restored so re-rendering is just one
    // click in VideoStage, not redoing the whole pipeline.
    setVideoDone(false);
    setVideoBlob(null);
    setVideoUrl(null);
    setExportDone(false);
  }

  return (
    <div>
      <header className="hero">
        <Hero3D />
        <div className="wrap hero-inner">
          <span className="eyebrow">🚀 Pipeline Studio — All-in-one, client-rendered</span>
          <h1 className="title">สคริปต์ → เสียง → วิดีโอ 3D → Export → โพสต์ ในหน้าเดียว</h1>
          <p className="dek">
            ทุกขั้นตอนของ affiliate content pipeline รวมในหน้าเดียว วิดีโอเรนเดอร์ในเบราว์เซอร์คุณเอง
            (ไม่ติด serverless time limit) ด้วยเทมเพลต 3D ที่สร้างจาก Three.js
          </p>
          <div className="flex items-start justify-between gap-4 flex-wrap mt-6">
            <div className="stage-track !mt-0">
              {STAGE_LABELS.map((label, i) => (
                <span key={label} className={`stage-chip ${i < stageIndex ? "done" : i === stageIndex ? "active" : ""}`}>
                  {i + 1}. {label}
                </span>
              ))}
            </div>
            <HistoryDrawer onLoad={resumeRun} />
          </div>
          <div className="mt-5">
            <PipelineHUD scenes={scenes} stageIndex={stageIndex} totalStages={STAGE_LABELS.length} />
          </div>
        </div>
      </header>

      <motion.div className="wrap" variants={stageListVariants} initial="hidden" animate="show">
        <ProductStage
          unlocked={true}
          meta={meta}
          setMeta={setMeta}
          done={productDone}
          onDone={() => setProductDone(true)}
        />

        <ScriptStage
          key={meta.productName || "none"}
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
      </motion.div>
    </div>
  );
}
