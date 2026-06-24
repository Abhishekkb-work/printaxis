import { createContext, useContext, useMemo, useReducer, type Dispatch, type ReactNode } from "react";
import type { Layer, Project, Unit } from "./types";
import { getPaper, PAPERS } from "./papers";
import type { Template } from "./templates";

export type State = {
  past: Project[];
  present: Project;
  future: Project[];
  selectedId: string | null;
};

export type Action =
  | { type: "set"; updater: (p: Project) => Project; transient?: boolean }
  | { type: "select"; id: string | null }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "load"; project: Project };

const MAX_HISTORY = 60;

function defaultProject(): Project {
  return {
    id: crypto.randomUUID(),
    name: "Untitled",
    paperId: "a4",
    customW: 210,
    customH: 297,
    orientation: "portrait",
    marginMm: 5,
    layers: [],
    showGrid: false,
    gridMm: 10,
    snap: true,
    unit: "mm",
    updatedAt: Date.now(),
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "set": {
      const next = { ...action.updater(state.present), updatedAt: Date.now() };
      if (action.transient) {
        return { ...state, present: next };
      }
      const past = [...state.past, state.present].slice(-MAX_HISTORY);
      return { past, present: next, future: [], selectedId: state.selectedId };
    }
    case "select":
      return { ...state, selectedId: action.id };
    case "undo": {
      if (!state.past.length) return state;
      const prev = state.past[state.past.length - 1];
      return {
        past: state.past.slice(0, -1),
        present: prev,
        future: [state.present, ...state.future],
        selectedId: state.selectedId,
      };
    }
    case "redo": {
      if (!state.future.length) return state;
      const [next, ...rest] = state.future;
      return {
        past: [...state.past, state.present],
        present: next,
        future: rest,
        selectedId: state.selectedId,
      };
    }
    case "load":
      return { past: [], present: action.project, future: [], selectedId: null };
  }
}

const EditorCtx = createContext<{ state: State; dispatch: Dispatch<Action> } | null>(null);

export function EditorProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    past: [],
    present: defaultProject(),
    future: [],
    selectedId: null,
  }));
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <EditorCtx.Provider value={value}>{children}</EditorCtx.Provider>;
}

export function useEditor() {
  const ctx = useContext(EditorCtx);
  if (!ctx) throw new Error("useEditor outside provider");
  return ctx;
}

// Helpers

export function paperDims(p: Project) {
  const paper = getPaper(p.paperId);
  let w = paper.id === "custom" ? p.customW : paper.widthMm;
  let h = paper.id === "custom" ? p.customH : paper.heightMm;
  if (p.orientation === "landscape") [w, h] = [h, w];
  return { wMm: w, hMm: h, paperName: paper.name };
}

export function newLayerFromImage(opts: {
  src: string;
  intrinsicW: number;
  intrinsicH: number;
  paperWmm: number;
  paperHmm: number;
}): Layer {
  // Default size: fit within paper at native pixel ratio (assume 96 dpi src).
  // Constrain to half the page for sane initial placement.
  const aspect = opts.intrinsicW / opts.intrinsicH;
  const maxW = opts.paperWmm * 0.5;
  const maxH = opts.paperHmm * 0.5;
  let wMm = maxW;
  let hMm = wMm / aspect;
  if (hMm > maxH) {
    hMm = maxH;
    wMm = hMm * aspect;
  }
  return {
    id: crypto.randomUUID(),
    name: "Image",
    src: opts.src,
    intrinsicW: opts.intrinsicW,
    intrinsicH: opts.intrinsicH,
    xMm: (opts.paperWmm - wMm) / 2,
    yMm: (opts.paperHmm - hMm) / 2,
    wMm,
    hMm,
    rotation: 0,
    flipH: false,
    flipV: false,
    locked: false,
    hidden: false,
    brightness: 100,
    contrast: 100,
    saturation: 100,
    grayscale: 0,
  };
}

export function applyTemplate(p: Project, tpl: Template, src: string | null, intrinsic?: { w: number; h: number }): Project {
  const paper = PAPERS.find((x) => x.id === tpl.paperId) ?? getPaper("a4");
  const orientation = tpl.orientation;
  let pageW = paper.widthMm;
  let pageH = paper.heightMm;
  if (orientation === "landscape") [pageW, pageH] = [pageH, pageW];
  const totalW = tpl.cols * tpl.slotW + (tpl.cols - 1) * tpl.gapMm;
  const totalH = tpl.rows * tpl.slotH + (tpl.rows - 1) * tpl.gapMm;
  const offX = (pageW - totalW) / 2;
  const offY = (pageH - totalH) / 2;
  const layers: Layer[] = [];
  const aspect = intrinsic ? intrinsic.w / intrinsic.h : tpl.slotW / tpl.slotH;
  for (let r = 0; r < tpl.rows; r++) {
    for (let c = 0; c < tpl.cols; c++) {
      const x = offX + c * (tpl.slotW + tpl.gapMm);
      const y = offY + r * (tpl.slotH + tpl.gapMm);
      // Cover-fit image into slot
      let wMm = tpl.slotW;
      let hMm = tpl.slotH;
      if (src && intrinsic) {
        const slotAspect = tpl.slotW / tpl.slotH;
        if (aspect > slotAspect) {
          hMm = tpl.slotH;
          wMm = hMm * aspect;
        } else {
          wMm = tpl.slotW;
          hMm = wMm / aspect;
        }
      }
      layers.push({
        id: crypto.randomUUID(),
        name: tpl.name,
        src: src ?? "",
        intrinsicW: intrinsic?.w ?? tpl.slotW,
        intrinsicH: intrinsic?.h ?? tpl.slotH,
        xMm: x + (tpl.slotW - wMm) / 2,
        yMm: y + (tpl.slotH - hMm) / 2,
        wMm,
        hMm,
        rotation: 0,
        flipH: false,
        flipV: false,
        locked: false,
        hidden: false,
        brightness: 100,
        contrast: 100,
        saturation: 100,
        grayscale: 0,
      });
    }
  }
  return {
    ...p,
    paperId: tpl.paperId,
    orientation,
    layers,
    updatedAt: Date.now(),
  };
}

export { defaultProject };
export type { Unit };
