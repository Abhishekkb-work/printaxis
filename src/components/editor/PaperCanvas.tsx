import { useRef } from "react";
import { useEditor, paperDims, activeLayers, setLayers } from "@/lib/editor/store";
import type { Layer } from "@/lib/editor/types";

type Props = {
  pxPerMm: number;
};

/**
 * PaperCanvas — renders the paper sheet centered inside its parent.
 *
 * The paper is intentionally LOCKED in place: tapping the empty surround
 * just deselects the current layer (no panning). Mobile users were
 * accidentally dragging the page around, so panning is removed entirely.
 * Zoom is still available via the on-screen zoom control.
 */
export function PaperCanvas({ pxPerMm }: Props) {
  const { state, dispatch } = useEditor();
  const p = state.present;
  const { wMm, hMm } = paperDims(p);
  const W = wMm * pxPerMm;
  const H = hMm * pxPerMm;
  const containerRef = useRef<HTMLDivElement>(null);

  function onSurroundPointerDown(e: React.PointerEvent) {
    if (e.target !== e.currentTarget) return;
    dispatch({ type: "select", id: null });
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-muted/40 select-none flex items-center justify-center p-4"
      style={{ touchAction: "none" }}
      onPointerDown={onSurroundPointerDown}
    >
      <div
        className="relative shrink-0"
        style={{ width: W, height: H }}
      >
        {/* paper sheet */}
        <div
          className="absolute inset-0 bg-white shadow-lg"
          style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.18)" }}
        />
        {/* margin guide */}
        <div
          className="absolute pointer-events-none border border-dashed"
          style={{
            left: p.marginMm * pxPerMm,
            top: p.marginMm * pxPerMm,
            width: (wMm - 2 * p.marginMm) * pxPerMm,
            height: (hMm - 2 * p.marginMm) * pxPerMm,
            borderColor: "rgba(234,88,12,0.45)",
          }}
        />
        {/* grid */}
        {p.showGrid && <Grid pxPerMm={pxPerMm} wMm={wMm} hMm={hMm} gridMm={p.gridMm} />}
        {/* layers */}
        {activeLayers(p).map((l) => (
          <LayerView key={l.id} layer={l} pxPerMm={pxPerMm} selected={state.selectedId === l.id} paperWmm={wMm} paperHmm={hMm} />
        ))}
      </div>
    </div>
  );
}

function Grid({ pxPerMm, wMm, hMm, gridMm }: { pxPerMm: number; wMm: number; hMm: number; gridMm: number }) {
  const step = gridMm * pxPerMm;
  return (
    <svg className="absolute inset-0 pointer-events-none" width={wMm * pxPerMm} height={hMm * pxPerMm}>
      <defs>
        <pattern id="grid" width={step} height={step} patternUnits="userSpaceOnUse">
          <path d={`M ${step} 0 L 0 0 0 ${step}`} fill="none" stroke="rgba(30,64,175,0.15)" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />
    </svg>
  );
}

function Rulers({
  pxPerMm,
  offset,
  wMm,
  hMm,
  unit,
}: {
  pxPerMm: number;
  offset: { x: number; y: number };
  wMm: number;
  hMm: number;
  unit: string;
}) {
  // Top + left rulers in 10mm steps with labels in active unit.
  const step = 10; // mm
  const ticks: number[] = [];
  for (let i = 0; i <= Math.ceil(wMm / step); i++) ticks.push(i * step);
  const vticks: number[] = [];
  for (let i = 0; i <= Math.ceil(hMm / step); i++) vticks.push(i * step);
  const label = (mm: number) => {
    if (unit === "in") return (mm / 25.4).toFixed(1);
    if (unit === "cm") return (mm / 10).toFixed(0);
    return mm.toString();
  };
  return (
    <>
      <div className="absolute top-0 left-6 right-0 h-6 bg-card/95 border-b border-border overflow-hidden text-[9px] text-muted-foreground">
        <div className="relative h-full" style={{ transform: `translateX(${offset.x}px)` }}>
          {ticks.map((t) => (
            <div key={t} className="absolute top-0 h-full" style={{ left: t * pxPerMm }}>
              <div className="absolute bottom-0 w-px h-2 bg-foreground/40" />
              <div className="absolute bottom-2 left-1">{label(t)}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="absolute top-6 left-0 bottom-0 w-6 bg-card/95 border-r border-border overflow-hidden text-[9px] text-muted-foreground">
        <div className="relative w-full h-full" style={{ transform: `translateY(${offset.y}px)` }}>
          {vticks.map((t) => (
            <div key={t} className="absolute left-0 w-full" style={{ top: t * pxPerMm }}>
              <div className="absolute right-0 h-px w-2 bg-foreground/40" />
              <div className="absolute right-2 top-0.5">{label(t)}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="absolute top-0 left-0 w-6 h-6 bg-card border-b border-r border-border text-[8px] text-muted-foreground flex items-center justify-center">
        {unit}
      </div>
    </>
  );
}

type Drag =
  | { kind: "move"; sx: number; sy: number; ox: number; oy: number }
  | { kind: "resize"; corner: "br" | "bl" | "tr" | "tl"; sx: number; sy: number; ow: number; oh: number; ox: number; oy: number; aspect: number }
  | { kind: "rotate"; cx: number; cy: number; startAngle: number; origRot: number };

function LayerView({ layer, pxPerMm, selected, paperWmm, paperHmm }: { layer: Layer; pxPerMm: number; selected: boolean; paperWmm: number; paperHmm: number }) {
  const { state, dispatch } = useEditor();
  const p = state.present;
  const dragRef = useRef<Drag | null>(null);
  const movedRef = useRef(false);
  const elRef = useRef<HTMLDivElement>(null);

  const W = layer.wMm * pxPerMm;
  const H = layer.hMm * pxPerMm;

  function snap(mm: number) {
    if (!p.snap) return mm;
    const s = p.gridMm;
    return Math.round(mm / s) * s;
  }
  function clampX(x: number, w: number) {
    return Math.max(0, Math.min(paperWmm - w, x));
  }
  function clampY(y: number, h: number) {
    return Math.max(0, Math.min(paperHmm - h, y));
  }

  function update(mut: (l: Layer) => Layer, transient: boolean) {
    dispatch({
      type: "set",
      transient,
      updater: (proj) => setLayers(proj, (ls) => ls.map((l) => (l.id === layer.id ? mut(l) : l))),
    });
  }

  function onPointerDown(e: React.PointerEvent) {
    e.stopPropagation();
    if (layer.locked || layer.hidden) return;
    dispatch({ type: "select", id: layer.id });
    movedRef.current = false;
    dragRef.current = {
      kind: "move",
      sx: e.clientX,
      sy: e.clientY,
      ox: layer.xMm,
      oy: layer.yMm,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    if (d.kind === "move") {
      const dx = (e.clientX - d.sx) / pxPerMm;
      const dy = (e.clientY - d.sy) / pxPerMm;
      if (Math.abs(dx) > 0.3 || Math.abs(dy) > 0.3) movedRef.current = true;
      update((l) => ({
        ...l,
        xMm: clampX(snap(d.ox + dx), l.wMm),
        yMm: clampY(snap(d.oy + dy), l.hMm),
      }), true);
    } else if (d.kind === "resize") {
      const dx = (e.clientX - d.sx) / pxPerMm;
      const dy = (e.clientY - d.sy) / pxPerMm;
      let nw = d.ow;
      let nh = d.oh;
      let nx = d.ox;
      let ny = d.oy;
      const signX = d.corner === "br" || d.corner === "tr" ? 1 : -1;
      const signY = d.corner === "br" || d.corner === "bl" ? 1 : -1;
      nw = Math.max(3, d.ow + signX * dx);
      nh = Math.max(3, d.oh + signY * dy);
      if (!e.shiftKey) {
        if (Math.abs(nw - d.ow) > Math.abs(nh - d.oh)) {
          nh = nw / d.aspect;
        } else {
          nw = nh * d.aspect;
        }
      }
      if (p.snap) {
        nw = Math.max(3, Math.round(nw / p.gridMm) * p.gridMm);
        nh = Math.max(3, Math.round(nh / p.gridMm) * p.gridMm);
      }
      if (signX < 0) nx = d.ox + (d.ow - nw);
      if (signY < 0) ny = d.oy + (d.oh - nh);
      if (p.snap) {
        nx = Math.round(nx / p.gridMm) * p.gridMm;
        ny = Math.round(ny / p.gridMm) * p.gridMm;
      }
      // Clamp the resized rect inside the page.
      nw = Math.min(nw, paperWmm);
      nh = Math.min(nh, paperHmm);
      nx = clampX(nx, nw);
      ny = clampY(ny, nh);
      update((l) => ({ ...l, wMm: nw, hMm: nh, xMm: nx, yMm: ny }), true);

    } else if (d.kind === "rotate") {
      const rect = elRef.current!.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const angle = (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI;
      const newRot = d.origRot + (angle - d.startAngle);
      update((l) => {
        // Clamp so the rotated bounding-box stays inside the page.
        const rad = (newRot * Math.PI) / 180;
        const c = Math.abs(Math.cos(rad));
        const s = Math.abs(Math.sin(rad));
        const bbW = l.wMm * c + l.hMm * s;
        const bbH = l.wMm * s + l.hMm * c;
        const cxMm = l.xMm + l.wMm / 2;
        const cyMm = l.yMm + l.hMm / 2;
        const ccx = Math.max(bbW / 2, Math.min(paperWmm - bbW / 2, cxMm));
        const ccy = Math.max(bbH / 2, Math.min(paperHmm - bbH / 2, cyMm));
        return {
          ...l,
          rotation: newRot,
          xMm: ccx - l.wMm / 2,
          yMm: ccy - l.hMm / 2,
        };
      }, true);
    }
  }
  function onPointerUp(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d) return;
    dragRef.current = null;
    // Treat as click → if layer has no image, ask the host to pick one.
    if (d.kind === "move" && !movedRef.current && !layer.src && !layer.locked) {
      window.dispatchEvent(new CustomEvent("pa-slot-click", { detail: { layerId: layer.id } }));
    }
    update((l) => ({ ...l }), false);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  }

  const transform = `rotate(${layer.rotation}deg) scaleX(${layer.flipH ? -1 : 1}) scaleY(${layer.flipV ? -1 : 1})`;
  const filter = `brightness(${layer.brightness}%) contrast(${layer.contrast}%) saturate(${layer.saturation}%) grayscale(${layer.grayscale}%)`;

  if (layer.hidden) return null;

  return (
    <div
      ref={elRef}
      className="absolute"
      style={{
        left: layer.xMm * pxPerMm,
        top: layer.yMm * pxPerMm,
        width: W,
        height: H,
        touchAction: "none",
      }}
    >
      <div
        className={`absolute inset-0 ${selected ? "outline outline-2 outline-primary" : ""}`}
        style={{ transform, transformOrigin: "center center", touchAction: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {layer.src ? (
          <img
            src={layer.src}
            alt={layer.name}
            draggable={false}
            className="w-full h-full object-fill pointer-events-none"
            style={{ filter }}
          />
        ) : (
          <div className="w-full h-full bg-orange-50/80 dark:bg-orange-950/40 border-2 border-dashed border-orange-400/60 flex flex-col items-center justify-center gap-1 text-[10px] text-orange-700 dark:text-orange-300 font-medium">
            <span className="text-lg leading-none">＋</span>
            <span>Tap to add image</span>
          </div>
        )}
      </div>
      {selected && !layer.locked && (
        <>
          {(["tl", "tr", "bl", "br"] as const).map((corner) => {
            const pos: Record<typeof corner, React.CSSProperties> = {
              tl: { left: -10, top: -10, cursor: "nwse-resize" },
              tr: { right: -10, top: -10, cursor: "nesw-resize" },
              bl: { left: -10, bottom: -10, cursor: "nesw-resize" },
              br: { right: -10, bottom: -10, cursor: "nwse-resize" },
            };
            return (
              <div
                key={corner}
                className="absolute w-5 h-5 bg-primary border-2 border-background rounded-sm shadow-md"
                style={{ ...pos[corner], touchAction: "none" }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  dragRef.current = {
                    kind: "resize",
                    corner,
                    sx: e.clientX,
                    sy: e.clientY,
                    ow: layer.wMm,
                    oh: layer.hMm,
                    ox: layer.xMm,
                    oy: layer.yMm,
                    aspect: layer.wMm / layer.hMm,
                  };
                  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                }}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              />
            );
          })}
          <div
            className="absolute left-1/2 -top-9 -translate-x-1/2 w-6 h-6 bg-primary rounded-full border-2 border-background cursor-grab shadow-md"
            style={{ touchAction: "none" }}
            onPointerDown={(e) => {
              e.stopPropagation();
              const rect = elRef.current!.getBoundingClientRect();
              const cx = rect.left + rect.width / 2;
              const cy = rect.top + rect.height / 2;
              const angle = (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI;
              dragRef.current = { kind: "rotate", cx, cy, startAngle: angle, origRot: layer.rotation };
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            }}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />
        </>
      )}
    </div>
  );
}

// Hook into URL "?sw=off" etc. is unrelated; export to satisfy isolatedModules.
export type { Props as PaperCanvasProps };
