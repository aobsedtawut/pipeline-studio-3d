import test from "node:test";
import assert from "node:assert/strict";
import { initialPipelineState, pipelineReducer, pipelineStageIndex } from "../app/lib/pipelineState.js";

const completed = {
  ...initialPipelineState,
  meta: { productName: "เดิม" },
  scenes: [{ scene_id: 1, audioDataUrl: "data:audio/mp3;base64,x" }],
  productDone: true,
  scriptDone: true,
  ttsDone: true,
  videoDone: true,
  videoBlob: { size: 1 },
  videoUrl: "blob:old",
  exportDone: true,
};

test("editing a script invalidates every downstream artifact", () => {
  const next = pipelineReducer(completed, { type: "setScenes", source: "script", scenes: [{ scene_id: 1 }] });
  assert.equal(next.scriptDone, true);
  assert.equal(next.ttsDone, false);
  assert.equal(next.videoDone, false);
  assert.equal(next.videoBlob, null);
  assert.equal(next.videoUrl, null);
  assert.equal(next.exportDone, false);
  assert.equal(pipelineStageIndex(next), 2);
});

test("editing video inputs preserves TTS but invalidates render and export", () => {
  const next = pipelineReducer(completed, { type: "setScenes", source: "video", scenes: completed.scenes });
  assert.equal(next.ttsDone, true);
  assert.equal(next.videoDone, false);
  assert.equal(next.exportDone, false);
  assert.equal(pipelineStageIndex(next), 3);
});

test("resume derives completed stages and drops non-persisted video output", () => {
  const next = pipelineReducer(completed, {
    type: "resume",
    run: { meta: { productName: "สินค้า" }, scenes: [{ scene_id: 1, audioDataUrl: "audio" }] },
  });
  assert.equal(next.productDone, true);
  assert.equal(next.scriptDone, true);
  assert.equal(next.ttsDone, true);
  assert.equal(next.videoDone, false);
  assert.equal(next.videoUrl, null);
});
