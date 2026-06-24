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
  brightness: number; // 0..200, 100 = neutral
  contrast: number;
  saturation: number;
  grayscale: number; // 0..100
};

export type Project = {
  id: string;
  name: string;
  paperId: string;
  customW: number;
  customH: number;
  orientation: Orientation;
  marginMm: number;
  layers: Layer[];
  showGrid: boolean;
  gridMm: number;
  snap: boolean;
  unit: Unit;
  updatedAt: number;
};
