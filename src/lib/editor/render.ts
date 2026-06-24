import type { Layer, Project } from "./types";
import { paperDims } from "./store";

// Rasterize the full page at the given DPI. Returns a canvas.
export async function rasterizePage(project: Project, dpi: number): Promise<HTMLCanvasElement> {
  const { wMm, hMm } = paperDims(project);
  const pxPerMm = dpi / 25.4;
  const W = Math.round(wMm * pxPerMm);
  const H = Math.round(hMm * pxPerMm);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2d unavailable");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  const layers = [...project.layers].filter((l) => !l.hidden && l.src);
  for (const l of layers) {
    await drawLayer(ctx, l, pxPerMm);
  }
  return canvas;
}

async function drawLayer(ctx: CanvasRenderingContext2D, l: Layer, pxPerMm: number) {
  const img = await loadImage(l.src);
  const x = l.xMm * pxPerMm;
  const y = l.yMm * pxPerMm;
  const w = l.wMm * pxPerMm;
  const h = l.hMm * pxPerMm;
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate((l.rotation * Math.PI) / 180);
  ctx.scale(l.flipH ? -1 : 1, l.flipV ? -1 : 1);
  ctx.filter = `brightness(${l.brightness}%) contrast(${l.contrast}%) saturate(${l.saturation}%) grayscale(${l.grayscale}%)`;
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export async function exportPng(project: Project, dpi: number) {
  const canvas = await rasterizePage(project, dpi);
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
  if (blob) downloadBlob(blob, `${project.name || "page"}.png`);
}

export async function exportJpg(project: Project, dpi: number) {
  const canvas = await rasterizePage(project, dpi);
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.95));
  if (blob) downloadBlob(blob, `${project.name || "page"}.jpg`);
}

export async function exportPdf(project: Project, dpi: number) {
  const { jsPDF } = await import("jspdf");
  const { wMm, hMm } = paperDims(project);
  const canvas = await rasterizePage(project, dpi);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
  const pdf = new jsPDF({
    orientation: wMm > hMm ? "landscape" : "portrait",
    unit: "mm",
    format: [wMm, hMm],
    compress: true,
  });
  pdf.addImage(dataUrl, "JPEG", 0, 0, wMm, hMm, undefined, "FAST");
  pdf.save(`${project.name || "page"}.pdf`);
}

export async function printProject(project: Project, dpi = 300) {
  const { wMm, hMm } = paperDims(project);
  const canvas = await rasterizePage(project, dpi);
  const dataUrl = canvas.toDataURL("image/png");
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(`<!doctype html><html><head><title>${project.name}</title>
  <style>
    @page { size: ${wMm}mm ${hMm}mm; margin: 0; }
    html, body { margin: 0; padding: 0; background: #fff; }
    img { width: ${wMm}mm; height: ${hMm}mm; display: block; }
  </style></head><body><img src="${dataUrl}" onload="setTimeout(()=>{window.focus();window.print();}, 100)"/></body></html>`);
  w.document.close();
}
