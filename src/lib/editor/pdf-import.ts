// Render PDF pages to PNG data URLs using pdfjs-dist.
// NOTE: pdfjs references browser-only globals (DOMMatrix, canvas). We import
// it lazily so SSR doesn't crash.

export type PdfPageImage = {
  pageNumber: number;
  src: string; // dataURL
  w: number;
  h: number;
};

let _pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;
async function getPdfjs() {
  if (typeof window === "undefined") throw new Error("pdfjs is browser-only");
  if (!_pdfjsPromise) {
    _pdfjsPromise = (async () => {
      const pdfjs = await import("pdfjs-dist");
      const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      return pdfjs;
    })();
  }
  return _pdfjsPromise;
}

export async function loadPdfFromFile(file: File) {
  const pdfjs = await getPdfjs();
  const buf = await file.arrayBuffer();
  return pdfjs.getDocument({ data: buf }).promise;
}

export async function renderPdfPage(
  doc: Awaited<ReturnType<typeof loadPdfFromFile>>,
  pageNumber: number,
  dpi = 200,
): Promise<PdfPageImage> {
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale: dpi / 72 });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2d unavailable");
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;
  return {
    pageNumber,
    src: canvas.toDataURL("image/png"),
    w: canvas.width,
    h: canvas.height,
  };
}

/** Parses page ranges like "1-3,5,8-10" against a total count. */
export function parsePageRange(input: string, total: number): number[] {
  const out = new Set<number>();
  const trimmed = input.trim();
  if (!trimmed || trimmed.toLowerCase() === "all") {
    for (let i = 1; i <= total; i++) out.add(i);
    return [...out];
  }
  for (const part of trimmed.split(",")) {
    const seg = part.trim();
    if (!seg) continue;
    const m = seg.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) {
      const a = Math.max(1, Math.min(total, parseInt(m[1], 10)));
      const b = Math.max(1, Math.min(total, parseInt(m[2], 10)));
      const [lo, hi] = a <= b ? [a, b] : [b, a];
      for (let i = lo; i <= hi; i++) out.add(i);
    } else {
      const n = parseInt(seg, 10);
      if (!isNaN(n) && n >= 1 && n <= total) out.add(n);
    }
  }
  return [...out].sort((a, b) => a - b);
}
