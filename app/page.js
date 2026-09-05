"use client";

import { useEffect, useReducer, useRef } from "react";
import { motion } from "motion/react";
import Hero3D from "./components/Hero3D";
import PipelineHUD from "./components/PipelineHUD";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import Logo from "./components/Logo";
import ProductStage from "./components/ProductStage";
import ScriptStage from "./components/ScriptStage";
import TtsStage from "./components/TtsStage";
import VideoStage from "./components/VideoStage";
import ExportStage from "./components/ExportStage";
import PostStage from "./components/PostStage";
import { initialPipelineState, pipelineReducer, pipelineStageIndex } from "./lib/pipelineState";

// One mascot + accent color per stage — matches the character-per-stage
// mascot shown in each Stage card's badge (see Stage.js).
const STAGE_META = [
  { key: "product", label: "เลือกสินค้า", accent: "--accent" },
  { key: "script", label: "สคริปต์", accent: "--accent-2" },
  { key: "tts", label: "พากย์เสียง", accent: "--accent-3" },
  { key: "video", label: "ตัดต่อ+ซับ", accent: "--accent-4" },
  { key: "export", label: "Export", accent: "--accent-5" },
  { key: "post", label: "โพสต์", accent: "--accent-6" },
];
const STAGE_LABELS = STAGE_META.map((s) => s.label);

const stageListVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

export default function Page() {
  const [pipeline, dispatch] = useReducer(pipelineReducer, initialPipelineState);
  const { scenes, meta, productDone, scriptDone, ttsDone, videoDone, videoBlob, videoUrl, exportDone } = pipeline;
  const setProductMeta = (meta) => dispatch({ type: "setMeta", source: "product", meta });
  const setScriptMeta = (meta) => dispatch({ type: "setMeta", source: "script", meta });
  const setScriptScenes = (scenes) => dispatch({ type: "setScenes", source: "script", scenes });
  const setTtsScenes = (scenes) => dispatch({ type: "setScenes", source: "tts", scenes });
  const setVideoScenes = (scenes) => dispatch({ type: "setScenes", source: "video", scenes });
  const runIdRef = useRef(null);
  const saveTimerRef = useRef(null);
  const saveQueueRef = useRef(Promise.resolve());
  const saveEpochRef = useRef(0);
  const stageRefs = {
    product: useRef(null),
    script: useRef(null),
    tts: useRef(null),
    video: useRef(null),
    export: useRef(null),
    post: useRef(null),
  };

  function scrollToStage(key) {
    stageRefs[key].current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const stageIndex = pipelineStageIndex(pipeline);
  const totalDuration = scenes.length ? scenes[scenes.length - 1].end_sec : 0;

  // Autosave run history (Postgres, optional — silently no-ops without
  // DATABASE_URL). Debounced so fast edits (typing a caption, etc.) don't
  // spam the API.
  useEffect(() => {
    if (!meta.productName) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const payload = { meta, scenes, stage: STAGE_LABELS[stageIndex] };
      const saveEpoch = saveEpochRef.current;
      saveQueueRef.current = saveQueueRef.current
        .then(async () => {
          if (saveEpoch !== saveEpochRef.current) return;
          const runId = runIdRef.current;
          const response = await fetch(runId ? `/api/runs/${runId}` : "/api/runs", {
            method: runId ? "PATCH" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const data = await response.json();
          if (saveEpoch === saveEpochRef.current && !runIdRef.current && data.run?.id) {
            runIdRef.current = data.run.id;
          }
        })
        .catch(() => {});
    }, 800);
    return () => clearTimeout(saveTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta, scenes, stageIndex]);

  function resumeRun(run) {
    saveEpochRef.current++;
    runIdRef.current = run.id;
    // Rendered video/export output isn't persisted (blobs don't belong in a
    // JSON column) — media + audio are restored so re-rendering is just one
    // click in VideoStage, not redoing the whole pipeline.
    dispatch({ type: "resume", run });
  }

  return (
    <div className="app-shell">
      <Sidebar stageMeta={STAGE_META} stageIndex={stageIndex} onNavigate={scrollToStage} />

      <div className="main-content">
        <Topbar onLoadRun={resumeRun} />

        <header className="hero">
          <Hero3D />
          <div className="wrap hero-inner">
            <span className="eyebrow">
              <Logo size={15} />
              Pipeline Studio — All-in-one, client-rendered
            </span>
            <h1 className="title">สคริปต์ → เสียง → วิดีโอ 3D → Export → โพสต์ ในหน้าเดียว</h1>
            <p className="dek">
              ทุกขั้นตอนของ affiliate content pipeline รวมในหน้าเดียว วิดีโอเรนเดอร์ในเบราว์เซอร์คุณเอง
              (ไม่ติด serverless time limit) ด้วยเทมเพลต 3D ที่สร้างจาก Three.js
            </p>
            <div className="mt-5">
              <PipelineHUD scenes={scenes} stageIndex={stageIndex} totalStages={STAGE_LABELS.length} />
            </div>
          </div>
        </header>

        <motion.div className="wrap" variants={stageListVariants} initial="hidden" animate="show">
          <div ref={stageRefs.product}>
          <ProductStage
            unlocked={true}
            meta={meta}
            setMeta={setProductMeta}
            done={productDone}
            onDone={() => dispatch({ type: "completeStage", stage: "product" })}
          />
        </div>

        <div ref={stageRefs.script}>
          <ScriptStage
            key={meta.productName || "none"}
            unlocked={true}
            scenes={scenes}
            setScenes={setScriptScenes}
            meta={meta}
            setMeta={setScriptMeta}
            done={scriptDone}
            onDone={() => dispatch({ type: "completeStage", stage: "script" })}
          />
        </div>

        <div ref={stageRefs.tts}>
          <TtsStage
            unlocked={scriptDone}
            scenes={scenes}
            setScenes={setTtsScenes}
            done={ttsDone}
            onDone={() => dispatch({ type: "completeStage", stage: "tts" })}
          />
        </div>

        <div ref={stageRefs.video}>
          <VideoStage
            unlocked={ttsDone}
            scenes={scenes}
            setScenes={setVideoScenes}
            done={videoDone}
            onDone={(blob, url) => {
              dispatch({ type: "videoReady", blob, url });
            }}
          />
        </div>

        <div ref={stageRefs.export}>
          <ExportStage
            unlocked={videoDone}
            videoBlob={videoBlob}
            videoUrl={videoUrl}
            duration={totalDuration}
            done={exportDone}
            onDone={() => dispatch({ type: "completeStage", stage: "export" })}
          />
        </div>

        <div ref={stageRefs.post}>
          <PostStage unlocked={exportDone} meta={meta} scenes={scenes} videoUrl={videoUrl} />
        </div>

        <footer>
          Pipeline Studio · เรนเดอร์ทุกอย่างในเบราว์เซอร์ ยกเว้นสคริปต์ AI-assist / TTS / โพสต์ Facebook ที่ผ่าน
          serverless routes
        </footer>
        </motion.div>
      </div>
    </div>
  );
}
