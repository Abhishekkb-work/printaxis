// Built-in templates. Each template lists rectangular slots (in mm) at
// which to place duplicates of the first selected image. If none is selected,
// the slots act as placeholders showing recommended sizes.

export type Slot = { wMm: number; hMm: number };
export type Template = {
  id: string;
  name: string;
  category: "passport" | "id" | "layout";
  paperId: string;
  orientation: "portrait" | "landscape";
  slotW: number;
  slotH: number;
  cols: number;
  rows: number;
  gapMm: number;
};

export const TEMPLATES: Template[] = [
  // Passport
  { id: "passport-in", name: "India Passport (35×45)", category: "passport", paperId: "4x6", orientation: "portrait", slotW: 35, slotH: 45, cols: 2, rows: 3, gapMm: 3 },
  { id: "passport-us", name: "US Passport (51×51)", category: "passport", paperId: "4x6", orientation: "portrait", slotW: 51, slotH: 51, cols: 1, rows: 2, gapMm: 5 },
  { id: "passport-uk", name: "UK Passport (35×45)", category: "passport", paperId: "4x6", orientation: "portrait", slotW: 35, slotH: 45, cols: 2, rows: 3, gapMm: 3 },
  // ID cards (printed at exact size)
  { id: "aadhaar", name: "Aadhaar Card (85.6×53.98)", category: "id", paperId: "a4", orientation: "portrait", slotW: 85.6, slotH: 53.98, cols: 1, rows: 1, gapMm: 0 },
  { id: "pan", name: "PAN Card (85.6×53.98)", category: "id", paperId: "a4", orientation: "portrait", slotW: 85.6, slotH: 53.98, cols: 1, rows: 1, gapMm: 0 },
  { id: "dl", name: "Driving License (85.6×53.98)", category: "id", paperId: "a4", orientation: "portrait", slotW: 85.6, slotH: 53.98, cols: 1, rows: 1, gapMm: 0 },
  // Photo layouts on A4
  { id: "layout-1", name: "1 photo / page", category: "layout", paperId: "a4", orientation: "portrait", slotW: 190, slotH: 277, cols: 1, rows: 1, gapMm: 0 },
  { id: "layout-2", name: "2 photos / page", category: "layout", paperId: "a4", orientation: "portrait", slotW: 190, slotH: 135, cols: 1, rows: 2, gapMm: 7 },
  { id: "layout-4", name: "4 photos / page", category: "layout", paperId: "a4", orientation: "portrait", slotW: 92, slotH: 135, cols: 2, rows: 2, gapMm: 6 },
  { id: "layout-6", name: "6 photos / page", category: "layout", paperId: "a4", orientation: "portrait", slotW: 92, slotH: 88, cols: 2, rows: 3, gapMm: 5 },
  { id: "layout-8", name: "8 photos / page", category: "layout", paperId: "a4", orientation: "portrait", slotW: 92, slotH: 65, cols: 2, rows: 4, gapMm: 5 },
  { id: "layout-9", name: "9 photos / page", category: "layout", paperId: "a4", orientation: "portrait", slotW: 60, slotH: 88, cols: 3, rows: 3, gapMm: 5 },
  { id: "layout-16", name: "16 photos / page", category: "layout", paperId: "a4", orientation: "portrait", slotW: 44, slotH: 65, cols: 4, rows: 4, gapMm: 4 },
];
