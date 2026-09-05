export const initialPipelineState = {
  scenes: [],
  meta: {},
  productDone: false,
  scriptDone: false,
  ttsDone: false,
  videoDone: false,
  videoBlob: null,
  videoUrl: null,
  exportDone: false,
};

export function pipelineReducer(state, action) {
  switch (action.type) {
    case "setMeta":
      return { ...state, meta: action.meta };
    case "setScenes":
      return { ...state, scenes: action.scenes };
    case "completeStage":
      return { ...state, [`${action.stage}Done`]: true };
    case "videoReady":
      return {
        ...state,
        videoDone: true,
        videoBlob: action.blob,
        videoUrl: action.url,
      };
    case "resume": {
      const scenes = action.run.scenes || [];
      const meta = action.run.meta || {};
      return {
        ...initialPipelineState,
        meta,
        scenes,
        productDone: Boolean(meta.chosenProduct || meta.productName),
        scriptDone: scenes.length > 0,
        ttsDone: scenes.length > 0 && scenes.every((scene) => scene.audioDataUrl),
      };
    }
    default:
      return state;
  }
}

export function pipelineStageIndex(state) {
  return state.exportDone ? 5 : state.videoDone ? 4 : state.ttsDone ? 3 : state.scriptDone ? 2 : state.productDone ? 1 : 0;
}
