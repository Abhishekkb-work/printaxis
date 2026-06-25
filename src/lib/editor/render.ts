import type { Layer, Page, Project } from "./types";
import { paperDims } from "./store";

export async function rasterizePage(project: Project, page: Page, dpi: number): Promise<HTMLCanvasElement> {
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
  for (const l of page.layers.filter((l) => !l.hidden && l.src)) {
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

type Scope = "active" | "all";

function pagesFor(project: Project, scope: Scope): Page[] {
  if (scope === "all") return project.pages;
  return [project.pages.find((p) => p.id === project.activePageId) ?? project.pages[0]];
}

export async function rasterizeAll(project: Project, dpi: number, scope: Scope): Promise<HTMLCanvasElement[]> {
  const out: HTMLCanvasElement[] = [];
  for (const pg of pagesFor(project, scope)) out.push(await rasterizePage(project, pg, dpi));
  return out;
}

async function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise<Blob>((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("toBlob failed"))), type, quality),
  );
}

export async function exportPng(project: Project, dpi: number, scope: Scope = "active") {
  const canvases = await rasterizeAll(project, dpi, scope);
  if (canvases.length === 1) {
    const blob = await canvasToBlob(canvases[0], "image/png");
    downloadBlob(blob, `${project.name || "page"}.png`);
    return;
  }
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  for (let i = 0; i < canvases.length; i++) {
    const blob = await canvasToBlob(canvases[i], "image/png");
    zip.file(`${project.name || "page"}-${String(i + 1).padStart(2, "0")}.png`, blob);
  }
  const out = await zip.generateAsync({ type: "blob" });
  downloadBlob(out, `${project.name || "pages"}.zip`);
}

export async function exportJpg(project: Project, dpi: number, scope: Scope = "active") {
  const canvases = await rasterizeAll(project, dpi, scope);
  if (canvases.length === 1) {
    const blob = await canvasToBlob(canvases[0], "image/jpeg", 0.95);
    downloadBlob(blob, `${project.name || "page"}.jpg`);
    return;
  }
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  for (let i = 0; i < canvases.length; i++) {
    const blob = await canvasToBlob(canvases[i], "image/jpeg", 0.95);
    zip.file(`${project.name || "page"}-${String(i + 1).padStart(2, "0")}.jpg`, blob);
  }
  const out = await zip.generateAsync({ type: "blob" });
  downloadBlob(out, `${project.name || "pages"}.zip`);
}

export async function exportPdf(project: Project, dpi: number, scope: Scope = "all") {
  const { jsPDF } = await import("jspdf");
  const { wMm, hMm } = paperDims(project);
  const canvases = await rasterizeAll(project, dpi, scope);
  const pdf = new jsPDF({
    orientation: wMm > hMm ? "landscape" : "portrait",
    unit: "mm",
    format: [wMm, hMm],
    compress: true,
  });
  for (let i = 0; i < canvases.length; i++) {
    if (i > 0) pdf.addPage([wMm, hMm], wMm > hMm ? "landscape" : "portrait");
    pdf.addImage(canvases[i].toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, wMm, hMm, undefined, "FAST");
  }
  pdf.save(`${project.name || "page"}.pdf`);
}

export async function exportDocx(project: Project, dpi: number, scope: Scope = "all") {
  const docx = await import("docx");
  const { wMm, hMm } = paperDims(project);
  const canvases = await rasterizeAll(project, dpi, scope);
  // Convert canvases to PNG blobs → ArrayBuffer
  const buffers: ArrayBuffer[] = [];
  for (const c of canvases) {
    const blob = await canvasToBlob(c, "image/png");
    buffers.push(await blob.arrayBuffer());
  }
  // docx uses TWIPs (1 mm = 56.6929 twips)
  const mmToTwip = (mm: number) => Math.round(mm * 56.6929);
  // EMU per mm = 36000
  const mmToEmu = (mm: number) => Math.round(mm * 36000);

  const children = buffers.map(
    (buf) =>
      new docx.Paragraph({
        children: [
          new docx.ImageRun({
            type: "png",
            data: buf,
            transformation: { width: mmToEmu(wMm) / 9525, height: mmToEmu(hMm) / 9525 },
          }),
        ],
      }),
  );
  // Insert page breaks between pages
  const finalChildren: InstanceType<typeof docx.Paragraph>[] = [];
  for (let i = 0; i < children.length; i++) {
    finalChildren.push(children[i]);
    if (i < children.length - 1) {
      finalChildren.push(new docx.Paragraph({ children: [new docx.PageBreak()] }));
    }
  }
  const doc = new docx.Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: mmToTwip(wMm), height: mmToTwip(hMm) },
            margin: { top: 0, right: 0, bottom: 0, left: 0, header: 0, footer: 0, gutter: 0 },
          },
        },
        children: finalChildren,
      },
    ],
  });
  const blob = await docx.Packer.toBlob(doc);
  downloadBlob(blob, `${project.name || "page"}.docx`);
}

export async function printProject(project: Project, dpi = 300, scope: Scope = "all") {
  const { wMm, hMm } = paperDims(project);
  const canvases = await rasterizeAll(project, dpi, scope);
  const urls = canvases.map((c) => c.toDataURL("image/png"));
  const w = window.open("", "_blank");
  if (!w) return;
  const imgs = urls
    .map(
      (u, i) =>
        `<img src="${u}" class="pg"${i < urls.length - 1 ? " style='page-break-after:always;'" : ""}/>`,
    )
    .join("");
  w.document.write(`<!doctype html><html><head><title>${escapeHtml(project.name)}</title>
  <style>
    @page { size: ${wMm}mm ${hMm}mm; margin: 0; }
    html, body { margin: 0; padding: 0; background: #fff; }
    .pg { width: ${wMm}mm; height: ${hMm}mm; display: block; }
  </style></head><body>${imgs}
  <script>window.addEventListener('load',()=>setTimeout(()=>{window.focus();window.print();},150));</script>
  </body></html>`);
  w.document.close();
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);
}
