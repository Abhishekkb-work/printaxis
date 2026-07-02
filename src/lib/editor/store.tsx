import { createContext, useContext, useMemo, useReducer, type Dispatch, type ReactNode } from "react";
import type { Layer, Page, Project, Unit } from "./types";
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

function newPage(name = "Page 1"): Page {
  return { id: crypto.randomUUID(), name, layers: [] };
}

function defaultProject(): Project {
  const page = newPage();
  return {
    id: crypto.randomUUID(),
    name: "Print Axis",
    paperId: "a4",
    customW: 210,
    customH: 297,
    orientation: "portrait",
    marginMm: 5,
    pages: [page],
    activePageId: page.id,
    showGrid: false,
    gridMm: 10,
    snap: true,
    unit: "mm",
    updatedAt: Date.now(),
  };
}

function migrate(p: Project | (Project & { layers?: Layer[] })): Project {
  // Back-compat: older saved projects had top-level layers, no pages.
  const anyP = p as Project & { layers?: Layer[] };
  if (!anyP.pages || !Array.isArray(anyP.pages) || !anyP.pages.length) {
    const page: Page = { id: crypto.randomUUID(), name: "Page 1", layers: anyP.layers ?? [] };
    return { ...(anyP as Project), pages: [page], activePageId: page.id };
  }
  if (!anyP.activePageId || !anyP.pages.find((pg) => pg.id === anyP.activePageId)) {
    return { ...(anyP as Project), activePageId: anyP.pages[0].id };
  }
  return anyP as Project;
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "set": {
      const next = { ...action.updater(state.present), updatedAt: Date.now() };
      if (action.transient) return { ...state, present: next };
      const past = [...state.past, state.present].slice(-MAX_HISTORY);
      return { past, present: next, future: [], selectedId: state.selectedId };
    }
    case "select":
      return { ...state, selectedId: action.id };
    case "undo": {
      if (!state.past.length) return state;
      const prev = state.past[state.past.length - 1];
      return { past: state.past.slice(0, -1), present: prev, future: [state.present, ...state.future], selectedId: state.selectedId };
    }
    case "redo": {
      if (!state.future.length) return state;
      const [next, ...rest] = state.future;
      return { past: [...state.past, state.present], present: next, future: rest, selectedId: state.selectedId };
    }
    case "load":
      return { past: [], present: migrate(action.project), future: [], selectedId: null };
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

// --- Helpers ---

export function paperDims(p: Project) {
  const paper = getPaper(p.paperId);
  let w = paper.id === "custom" ? p.customW : paper.widthMm;
  let h = paper.id === "custom" ? p.customH : paper.heightMm;
  if (p.orientation === "landscape") [w, h] = [h, w];
  return { wMm: w, hMm: h, paperName: paper.name };
}

export function activePage(p: Project): Page {
  return p.pages.find((pg) => pg.id === p.activePageId) ?? p.pages[0];
}

export function activeLayers(p: Project): Layer[] {
  return activePage(p).layers;
}

export function setLayers(p: Project, mapper: (layers: Layer[]) => Layer[]): Project {
  return {
    ...p,
    pages: p.pages.map((pg) =>
      pg.id === p.activePageId ? { ...pg, layers: mapper(pg.layers) } : pg,
    ),
  };
}

export function addPage(p: Project, name?: string): Project {
  const page: Page = { id: crypto.randomUUID(), name: name ?? `Page ${p.pages.length + 1}`, layers: [] };
  return { ...p, pages: [...p.pages, page], activePageId: page.id };
}

export function duplicatePage(p: Project, pageId: string): Project {
  const src = p.pages.find((pg) => pg.id === pageId);
  if (!src) return p;
  const copy: Page = {
    id: crypto.randomUUID(),
    name: src.name + " copy",
    layers: src.layers.map((l) => ({ ...l, id: crypto.randomUUID() })),
  };
  const idx = p.pages.findIndex((pg) => pg.id === pageId);
  const pages = [...p.pages];
  pages.splice(idx + 1, 0, copy);
  return { ...p, pages, activePageId: copy.id };
}

export function removePage(p: Project, pageId: string): Project {
  if (p.pages.length <= 1) return p;
  const idx = p.pages.findIndex((pg) => pg.id === pageId);
  const pages = p.pages.filter((pg) => pg.id !== pageId);
  const active = p.activePageId === pageId ? pages[Math.max(0, idx - 1)].id : p.activePageId;
  return { ...p, pages, activePageId: active };
}

export function selectPage(p: Project, pageId: string): Project {
  if (!p.pages.find((pg) => pg.id === pageId)) return p;
  return { ...p, activePageId: pageId };
}

export function movePage(p: Project, pageId: string, dir: -1 | 1): Project {
  const i = p.pages.findIndex((pg) => pg.id === pageId);
  if (i < 0) return p;
  const ni = i + dir;
  if (ni < 0 || ni >= p.pages.length) return p;
  const pages = [...p.pages];
  const [it] = pages.splice(i, 1);
  pages.splice(ni, 0, it);
  return { ...p, pages };
}

export function newLayerFromImage(opts: {
  src: string;
  intrinsicW: number;
  intrinsicH: number;
  paperWmm: number;
  paperHmm: number;
}): Layer {
  const aspect = opts.intrinsicW / opts.intrinsicH;
  const maxW = opts.paperWmm * 0.5;
  const maxH = opts.paperHmm * 0.5;
  let wMm = maxW;
  let hMm = wMm / aspect;
  if (hMm > maxH) { hMm = maxH; wMm = hMm * aspect; }
  return {
    id: crypto.randomUUID(),
    name: "Image",
    src: opts.src,
    intrinsicW: opts.intrinsicW,
    intrinsicH: opts.intrinsicH,
    xMm: (opts.paperWmm - wMm) / 2,
    yMm: (opts.paperHmm - hMm) / 2,
    wMm, hMm,
    rotation: 0, flipH: false, flipV: false, locked: false, hidden: false,
    brightness: 100, contrast: 100, saturation: 100, grayscale: 0,
  };
}

export function applyTemplate(
  p: Project,
  tpl: Template,
  src: string | null,
  intrinsic?: { w: number; h: number },
): Project {
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
      let wMm = tpl.slotW;
      let hMm = tpl.slotH;
      if (src && intrinsic) {
        const slotAspect = tpl.slotW / tpl.slotH;
        if (aspect > slotAspect) { hMm = tpl.slotH; wMm = hMm * aspect; }
        else { wMm = tpl.slotW; hMm = wMm / aspect; }
      }
      layers.push({
        id: crypto.randomUUID(),
        name: tpl.name,
        src: src ?? "",
        intrinsicW: intrinsic?.w ?? tpl.slotW,
        intrinsicH: intrinsic?.h ?? tpl.slotH,
        xMm: x + (tpl.slotW - wMm) / 2,
        yMm: y + (tpl.slotH - hMm) / 2,
        wMm, hMm,
        rotation: 0, flipH: false, flipV: false, locked: false, hidden: false,
        brightness: 100, contrast: 100, saturation: 100, grayscale: 0,
      });
    }
  }
  // Replace active page's layers with template.
  return setLayers({ ...p, paperId: tpl.paperId, orientation }, () => layers);
}

export { defaultProject };
export type { Unit };
