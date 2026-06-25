export type Unit = "mm" | "cm" | "in";

export type PaperSize = {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
};

export type Orientation = "portrait" | "landscape";

export type Layer = {
  id: string;
  name: string;
  src: string; // dataURL
  intrinsicW: number;
  intrinsicH: number;
  xMm: number;
  yMm: number;
  wMm: number;
  hMm: number;
  rotation: number;
  flipH: boolean;
  flipV: boolean;
  locked: boolean;
  hidden: boolean;
  brightness: number;
  contrast: number;
  saturation: number;
  grayscale: number;
};

export type Page = {
  id: string;
  name: string;
  layers: Layer[];
};

export type Project = {
  id: string;
  name: string;
  paperId: string;
  customW: number;
  customH: number;
  orientation: Orientation;
  marginMm: number;
  pages: Page[];
  activePageId: string;
  showGrid: boolean;
  gridMm: number;
  snap: boolean;
  unit: Unit;
  updatedAt: number;
};
