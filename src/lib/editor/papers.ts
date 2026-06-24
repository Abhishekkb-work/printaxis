import type { PaperSize } from "./types";
import { MM_PER_IN } from "./units";

export const PAPERS: PaperSize[] = [
  { id: "a4", name: "A4", widthMm: 210, heightMm: 297 },
  { id: "a5", name: "A5", widthMm: 148, heightMm: 210 },
  { id: "letter", name: "Letter", widthMm: 8.5 * MM_PER_IN, heightMm: 11 * MM_PER_IN },
  { id: "legal", name: "Legal", widthMm: 8.5 * MM_PER_IN, heightMm: 14 * MM_PER_IN },
  { id: "4x6", name: '4 × 6"', widthMm: 4 * MM_PER_IN, heightMm: 6 * MM_PER_IN },
  { id: "5x7", name: '5 × 7"', widthMm: 5 * MM_PER_IN, heightMm: 7 * MM_PER_IN },
  { id: "6x8", name: '6 × 8"', widthMm: 6 * MM_PER_IN, heightMm: 8 * MM_PER_IN },
  { id: "8x10", name: '8 × 10"', widthMm: 8 * MM_PER_IN, heightMm: 10 * MM_PER_IN },
  { id: "custom", name: "Custom", widthMm: 210, heightMm: 297 },
];

export function getPaper(id: string): PaperSize {
  return PAPERS.find((p) => p.id === id) ?? PAPERS[0];
}
