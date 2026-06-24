import { useEffect, useRef, useState } from "react";
import {
  Upload, Save, Printer, Download, Undo2, Redo2,
  Trash2, Copy, Lock, Unlock, Eye, EyeOff, ArrowUp, ArrowDown,
  AlignLeft, AlignCenter, AlignRight, AlignVerticalJustifyCenter,
  AlignStartHorizontal, AlignEndHorizontal,
  RotateCw, FlipHorizontal, FlipVertical, Layers, FileText, Image as ImgIcon,
  Maximize2, FolderOpen, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

import { PaperCanvas } from "./PaperCanvas";
import {
  EditorProvider, useEditor, paperDims, newLayerFromImage, applyTemplate,
} from "@/lib/editor/store";
import type { Layer, Project, Unit } from "@/lib/editor/types";
import { PAPERS } from "@/lib/editor/papers";
import { TEMPLATES } from "@/lib/editor/templates";
import { fromMm, toMm } from "@/lib/editor/units";
import { listProjects, saveProject, deleteProject, duplicateProject } from "@/lib/editor/storage";
import { exportPdf, exportPng, exportJpg, printProject } from "@/lib/editor/render";

export function EditorRoot() {
  return (
    <EditorProvider>
      <EditorShell />
    </EditorProvider>
  );
}

function EditorShell() {
  const { state, dispatch } = useEditor();
  const p = state.present;
  const selectedLayer = p.layers.find((l) => l.id === state.selectedId) ?? null;

  const [pxPerMm, setPxPerMm] = useState(2);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Fit on first mount + on paper change
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const { wMm, hMm } = paperDims(p);
    const cw = el.clientWidth - 60;
    const ch = el.clientHeight - 60;
    const fit = Math.max(0.5, Math.min(cw / wMm, ch / hMm));
    setPxPerMm(fit);
    setOffset({ x: (el.clientWidth - 24 - wMm * fit) / 2 - 24, y: 8 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.paperId, p.orientation, p.customW, p.customH]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === "z" && !e.shiftKey) { e.preventDefault(); dispatch({ type: "undo" }); }
      else if (mod && (e.key === "y" || (e.key === "z" && e.shiftKey))) { e.preventDefault(); dispatch({ type: "redo" }); }
      else if (e.key === "Delete" && state.selectedId) {
        dispatch({ type: "set", updater: (pr) => ({ ...pr, layers: pr.layers.filter((l) => l.id !== state.selectedId) }) });
        dispatch({ type: "select", id: null });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dispatch, state.selectedId]);

  return (
    <div className="flex flex-col h-dvh bg-background text-foreground">
      <TopBar />
      <div className="flex-1 flex min-h-0">
        {/* Left panel — md+ */}
        <aside className="hidden md:flex w-72 border-r border-border bg-card flex-col overflow-hidden">
          <SidePanel selectedLayer={selectedLayer} />
        </aside>

        <div ref={containerRef} className="flex-1 relative min-w-0">
          <PaperCanvas pxPerMm={pxPerMm} offset={offset} onOffsetChange={setOffset} />
          <ZoomControl pxPerMm={pxPerMm} onChange={setPxPerMm} />
        </div>
      </div>
      <BottomBar selectedLayer={selectedLayer} />
    </div>
  );
}

function TopBar() {
  const { state, dispatch } = useEditor();
  const p = state.present;
  const fileRef = useRef<HTMLInputElement>(null);
  const [openProjects, setOpenProjects] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);

  async function handleFiles(files: FileList | null) {
    if (!files || !files.length) return;
    const { wMm, hMm } = paperDims(p);
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      const src = await fileToDataUrl(file);
      const dim = await readImageDimensions(src);
      const layer = newLayerFromImage({
        src,
        intrinsicW: dim.w,
        intrinsicH: dim.h,
        paperWmm: wMm,
        paperHmm: hMm,
      });
      dispatch({
        type: "set",
        updater: (proj) => ({ ...proj, layers: [...proj.layers, layer] }),
      });
      dispatch({ type: "select", id: layer.id });
    }
  }

  async function onSave() {
    await saveProject(p);
    toast.success("Project saved");
  }
  async function onOpenProjects() {
    setProjects(await listProjects());
    setOpenProjects(true);
  }
  async function onLoad(pr: Project) {
    dispatch({ type: "load", project: pr });
    setOpenProjects(false);
  }
  async function onDelete(id: string) {
    await deleteProject(id);
    setProjects(await listProjects());
  }
  async function onDuplicate(pr: Project) {
    await duplicateProject(pr);
    setProjects(await listProjects());
  }

  return (
    <header className="flex items-center gap-1 px-2 py-2 border-b border-border bg-card">
      <div className="flex items-center gap-2 pr-2 border-r border-border">
        <div className="h-8 w-8 rounded-md bg-primary text-primary-foreground grid place-items-center font-bold">P</div>
        <div className="hidden sm:block">
          <Input
            value={p.name}
            onChange={(e) => dispatch({ type: "set", updater: (pr) => ({ ...pr, name: e.target.value }) })}
            className="h-7 w-40 text-sm"
          />
        </div>
      </div>

      <Button variant="ghost" size="icon" title="Undo" onClick={() => dispatch({ type: "undo" })} disabled={!state.past.length}>
        <Undo2 className="size-4" />
      </Button>
      <Button variant="ghost" size="icon" title="Redo" onClick={() => dispatch({ type: "redo" })} disabled={!state.future.length}>
        <Redo2 className="size-4" />
      </Button>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/jpg"
        multiple
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />
      <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
        <Upload className="size-4 mr-1" /> Add
      </Button>

      <TemplatesMenu />

      <div className="flex-1" />

      <Button variant="ghost" size="icon" title="Open" onClick={onOpenProjects}>
        <FolderOpen className="size-4" />
      </Button>
      <Button variant="ghost" size="icon" title="Save" onClick={onSave}>
        <Save className="size-4" />
      </Button>

      <ExportMenu />

      <Button size="sm" onClick={() => printProject(p)}>
        <Printer className="size-4 mr-1" /> Print
      </Button>

      {/* Mobile side panel trigger */}
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden" title="Layers & properties">
            <Layers className="size-4" />
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-80 p-0 overflow-y-auto">
          <SheetHeader className="p-3 border-b border-border">
            <SheetTitle>Layers & properties</SheetTitle>
          </SheetHeader>
          <SidePanel selectedLayer={state.present.layers.find((l) => l.id === state.selectedId) ?? null} />
        </SheetContent>
      </Sheet>

      <Dialog open={openProjects} onOpenChange={setOpenProjects}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Saved projects</DialogTitle></DialogHeader>
          <div className="max-h-80 overflow-y-auto divide-y divide-border">
            {!projects.length && <p className="text-sm text-muted-foreground py-6 text-center">No saved projects yet.</p>}
            {projects.map((pr) => (
              <div key={pr.id} className="flex items-center gap-2 py-2">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate text-sm">{pr.name}</div>
                  <div className="text-xs text-muted-foreground">{new Date(pr.updatedAt).toLocaleString()}</div>
                </div>
                <Button size="sm" variant="outline" onClick={() => onLoad(pr)}>Open</Button>
                <Button size="icon" variant="ghost" onClick={() => onDuplicate(pr)} title="Duplicate"><Copy className="size-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => onDelete(pr.id)} title="Delete"><Trash2 className="size-4" /></Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
}

function TemplatesMenu() {
  const { state, dispatch } = useEditor();
  const p = state.present;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm"><Sparkles className="size-4 mr-1" /> Templates</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 max-h-96 overflow-y-auto">
        {(["passport", "id", "layout"] as const).map((cat) => (
          <div key={cat}>
            <DropdownMenuLabel className="capitalize">{cat}</DropdownMenuLabel>
            {TEMPLATES.filter((t) => t.category === cat).map((t) => (
              <DropdownMenuItem
                key={t.id}
                onClick={() => {
                  const first = p.layers.find((l) => l.src);
                  dispatch({
                    type: "set",
                    updater: (pr) =>
                      applyTemplate(
                        pr,
                        t,
                        first?.src ?? null,
                        first ? { w: first.intrinsicW, h: first.intrinsicH } : undefined,
                      ),
                  });
                }}
              >
                {t.name}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ExportMenu() {
  const { state } = useEditor();
  const [dpi, setDpi] = useState(300);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm"><Download className="size-4 mr-1" /> Export</Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Export</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Resolution (DPI)</Label>
            <Select value={String(dpi)} onValueChange={(v) => setDpi(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="150">150 DPI — draft</SelectItem>
                <SelectItem value="300">300 DPI — high quality</SelectItem>
                <SelectItem value="600">600 DPI — original</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="flex-row gap-2">
          <Button variant="outline" onClick={() => exportPng(state.present, dpi)}><ImgIcon className="size-4 mr-1" />PNG</Button>
          <Button variant="outline" onClick={() => exportJpg(state.present, dpi)}><ImgIcon className="size-4 mr-1" />JPG</Button>
          <Button onClick={() => exportPdf(state.present, dpi)}><FileText className="size-4 mr-1" />PDF</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SidePanel({ selectedLayer }: { selectedLayer: Layer | null }) {
  return (
    <Tabs defaultValue="page" className="flex-1 flex flex-col min-h-0">
      <TabsList className="grid grid-cols-3 m-2">
        <TabsTrigger value="page">Page</TabsTrigger>
        <TabsTrigger value="layers">Layers</TabsTrigger>
        <TabsTrigger value="props">Properties</TabsTrigger>
      </TabsList>
      <div className="flex-1 overflow-y-auto px-3 pb-4">
        <TabsContent value="page" className="m-0"><PageSettings /></TabsContent>
        <TabsContent value="layers" className="m-0"><LayersList /></TabsContent>
        <TabsContent value="props" className="m-0">
          {selectedLayer ? <LayerProps layer={selectedLayer} /> : <p className="text-sm text-muted-foreground py-4">Select a layer to edit its size and filters.</p>}
        </TabsContent>
      </div>
    </Tabs>
  );
}

function PageSettings() {
  const { state, dispatch } = useEditor();
  const p = state.present;
  return (
    <div className="space-y-4 pt-2">
      <div>
        <Label className="text-xs">Paper size</Label>
        <Select value={p.paperId} onValueChange={(v) => dispatch({ type: "set", updater: (pr) => ({ ...pr, paperId: v }) })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {PAPERS.map((p2) => <SelectItem key={p2.id} value={p2.id}>{p2.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {p.paperId === "custom" && (
        <div className="grid grid-cols-2 gap-2">
          <UnitInput label="Width" mm={p.customW} unit={p.unit} onChange={(mm) => dispatch({ type: "set", updater: (pr) => ({ ...pr, customW: mm }) })} />
          <UnitInput label="Height" mm={p.customH} unit={p.unit} onChange={(mm) => dispatch({ type: "set", updater: (pr) => ({ ...pr, customH: mm }) })} />
        </div>
      )}
      <div>
        <Label className="text-xs">Orientation</Label>
        <Select value={p.orientation} onValueChange={(v) => dispatch({ type: "set", updater: (pr) => ({ ...pr, orientation: v as "portrait" | "landscape" }) })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="portrait">Portrait</SelectItem>
            <SelectItem value="landscape">Landscape</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs">Working unit</Label>
        <Select value={p.unit} onValueChange={(v) => dispatch({ type: "set", updater: (pr) => ({ ...pr, unit: v as Unit }) })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="mm">Millimetres</SelectItem>
            <SelectItem value="cm">Centimetres</SelectItem>
            <SelectItem value="in">Inches</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <UnitInput label="Margin" mm={p.marginMm} unit={p.unit} onChange={(mm) => dispatch({ type: "set", updater: (pr) => ({ ...pr, marginMm: mm }) })} />
      <div className="flex items-center justify-between pt-2">
        <Label className="text-xs">Show grid</Label>
        <Switch checked={p.showGrid} onCheckedChange={(v) => dispatch({ type: "set", updater: (pr) => ({ ...pr, showGrid: v }) })} />
      </div>
      <UnitInput label="Grid spacing" mm={p.gridMm} unit={p.unit} onChange={(mm) => dispatch({ type: "set", updater: (pr) => ({ ...pr, gridMm: Math.max(1, mm) }) })} />
      <div className="flex items-center justify-between">
        <Label className="text-xs">Snap to grid</Label>
        <Switch checked={p.snap} onCheckedChange={(v) => dispatch({ type: "set", updater: (pr) => ({ ...pr, snap: v }) })} />
      </div>
    </div>
  );
}

function LayersList() {
  const { state, dispatch } = useEditor();
  const layers = [...state.present.layers].reverse();

  function move(id: string, dir: -1 | 1) {
    dispatch({
      type: "set",
      updater: (pr) => {
        const i = pr.layers.findIndex((l) => l.id === id);
        if (i < 0) return pr;
        const ni = i + dir;
        if (ni < 0 || ni >= pr.layers.length) return pr;
        const arr = [...pr.layers];
        const [item] = arr.splice(i, 1);
        arr.splice(ni, 0, item);
        return { ...pr, layers: arr };
      },
    });
  }
  function mut(id: string, fn: (l: Layer) => Layer) {
    dispatch({ type: "set", updater: (pr) => ({ ...pr, layers: pr.layers.map((l) => l.id === id ? fn(l) : l) }) });
  }
  function remove(id: string) {
    dispatch({ type: "set", updater: (pr) => ({ ...pr, layers: pr.layers.filter((l) => l.id !== id) }) });
  }

  return (
    <div className="space-y-1 pt-2">
      {!layers.length && <p className="text-sm text-muted-foreground py-4">No layers yet. Tap “Add” to import an image.</p>}
      {layers.map((l) => {
        const selected = state.selectedId === l.id;
        return (
          <div key={l.id} className={`flex items-center gap-1 p-1.5 rounded-md border ${selected ? "border-primary bg-primary/5" : "border-transparent hover:bg-accent"}`} onClick={() => dispatch({ type: "select", id: l.id })}>
            <div className="w-8 h-8 rounded bg-muted overflow-hidden grid place-items-center shrink-0">
              {l.src ? <img src={l.src} alt="" className="w-full h-full object-cover" /> : <ImgIcon className="size-4 text-muted-foreground" />}
            </div>
            <div className="flex-1 min-w-0 text-xs">
              <div className="truncate">{l.name}</div>
              <div className="text-muted-foreground">{l.wMm.toFixed(1)} × {l.hMm.toFixed(1)} mm</div>
            </div>
            <Button size="icon" variant="ghost" className="size-7" onClick={(e) => { e.stopPropagation(); mut(l.id, (x) => ({ ...x, hidden: !x.hidden })); }}>{l.hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}</Button>
            <Button size="icon" variant="ghost" className="size-7" onClick={(e) => { e.stopPropagation(); mut(l.id, (x) => ({ ...x, locked: !x.locked })); }}>{l.locked ? <Lock className="size-3.5" /> : <Unlock className="size-3.5" />}</Button>
            <Button size="icon" variant="ghost" className="size-7" onClick={(e) => { e.stopPropagation(); move(l.id, 1); }}><ArrowUp className="size-3.5" /></Button>
            <Button size="icon" variant="ghost" className="size-7" onClick={(e) => { e.stopPropagation(); move(l.id, -1); }}><ArrowDown className="size-3.5" /></Button>
            <Button size="icon" variant="ghost" className="size-7" onClick={(e) => { e.stopPropagation(); remove(l.id); }}><Trash2 className="size-3.5" /></Button>
          </div>
        );
      })}
    </div>
  );
}

function LayerProps({ layer }: { layer: Layer }) {
  const { state, dispatch } = useEditor();
  const p = state.present;
  const [keepAspect, setKeepAspect] = useState(true);

  function mut(fn: (l: Layer) => Layer) {
    dispatch({ type: "set", updater: (pr) => ({ ...pr, layers: pr.layers.map((l) => l.id === layer.id ? fn(l) : l) }) });
  }
  function setW(mm: number) {
    mut((l) => {
      const aspect = l.wMm / l.hMm;
      return { ...l, wMm: mm, hMm: keepAspect ? mm / aspect : l.hMm };
    });
  }
  function setH(mm: number) {
    mut((l) => {
      const aspect = l.wMm / l.hMm;
      return { ...l, hMm: mm, wMm: keepAspect ? mm * aspect : l.wMm };
    });
  }

  return (
    <div className="space-y-3 pt-2">
      <div className="grid grid-cols-2 gap-2">
        <UnitInput label="Width" mm={layer.wMm} unit={p.unit} onChange={setW} />
        <UnitInput label="Height" mm={layer.hMm} unit={p.unit} onChange={setH} />
      </div>
      <div className="flex items-center justify-between">
        <Label className="text-xs">Keep aspect ratio</Label>
        <Switch checked={keepAspect} onCheckedChange={setKeepAspect} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <UnitInput label="X" mm={layer.xMm} unit={p.unit} onChange={(mm) => mut((l) => ({ ...l, xMm: mm }))} />
        <UnitInput label="Y" mm={layer.yMm} unit={p.unit} onChange={(mm) => mut((l) => ({ ...l, yMm: mm }))} />
      </div>
      <div>
        <Label className="text-xs">Rotation: {layer.rotation.toFixed(0)}°</Label>
        <Slider value={[layer.rotation]} min={-180} max={180} step={1} onValueChange={([v]) => mut((l) => ({ ...l, rotation: v }))} />
      </div>
      <div className="flex flex-wrap gap-1">
        <Button variant="outline" size="sm" onClick={() => mut((l) => ({ ...l, rotation: l.rotation + 90 }))}><RotateCw className="size-3.5 mr-1" />90°</Button>
        <Button variant="outline" size="sm" onClick={() => mut((l) => ({ ...l, flipH: !l.flipH }))}><FlipHorizontal className="size-3.5" /></Button>
        <Button variant="outline" size="sm" onClick={() => mut((l) => ({ ...l, flipV: !l.flipV }))}><FlipVertical className="size-3.5" /></Button>
        <Button variant="outline" size="sm" onClick={() => dispatch({ type: "set", updater: (pr) => ({ ...pr, layers: [...pr.layers, { ...layer, id: crypto.randomUUID(), xMm: layer.xMm + 5, yMm: layer.yMm + 5 }] }) })}><Copy className="size-3.5 mr-1" />Duplicate</Button>
      </div>
      <div className="pt-2 space-y-2 border-t border-border">
        <SliderRow label="Brightness" value={layer.brightness} min={0} max={200} onChange={(v) => mut((l) => ({ ...l, brightness: v }))} />
        <SliderRow label="Contrast" value={layer.contrast} min={0} max={200} onChange={(v) => mut((l) => ({ ...l, contrast: v }))} />
        <SliderRow label="Saturation" value={layer.saturation} min={0} max={200} onChange={(v) => mut((l) => ({ ...l, saturation: v }))} />
        <SliderRow label="Grayscale" value={layer.grayscale} min={0} max={100} onChange={(v) => mut((l) => ({ ...l, grayscale: v }))} />
      </div>
    </div>
  );
}

function SliderRow({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex justify-between text-xs">
        <Label className="text-xs">{label}</Label>
        <span className="text-muted-foreground">{value}</span>
      </div>
      <Slider value={[value]} min={min} max={max} step={1} onValueChange={([v]) => onChange(v)} />
    </div>
  );
}

function UnitInput({ label, mm, unit, onChange }: { label: string; mm: number; unit: Unit; onChange: (mm: number) => void }) {
  const [text, setText] = useState(fromMm(mm, unit).toFixed(2));
  useEffect(() => { setText(fromMm(mm, unit).toFixed(2)); }, [mm, unit]);
  return (
    <div>
      <Label className="text-xs">{label} ({unit})</Label>
      <Input
        type="number"
        step="0.1"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const n = parseFloat(text);
          if (!isNaN(n)) onChange(toMm(n, unit));
        }}
      />
    </div>
  );
}

function BottomBar({ selectedLayer }: { selectedLayer: Layer | null }) {
  const { state, dispatch } = useEditor();
  const p = state.present;
  if (!selectedLayer) {
    return (
      <footer className="flex md:hidden items-center justify-around px-2 py-1 border-t border-border bg-card text-xs text-muted-foreground">
        Tap an image to edit it.
      </footer>
    );
  }
  function mut(fn: (l: Layer) => Layer) {
    dispatch({ type: "set", updater: (pr) => ({ ...pr, layers: pr.layers.map((l) => l.id === selectedLayer!.id ? fn(l) : l) }) });
  }
  const { wMm, hMm } = paperDims(p);
  function alignH(kind: "left" | "center" | "right") {
    mut((l) => ({ ...l, xMm: kind === "left" ? p.marginMm : kind === "right" ? wMm - p.marginMm - l.wMm : (wMm - l.wMm) / 2 }));
  }
  function alignV(kind: "top" | "middle" | "bottom") {
    mut((l) => ({ ...l, yMm: kind === "top" ? p.marginMm : kind === "bottom" ? hMm - p.marginMm - l.hMm : (hMm - l.hMm) / 2 }));
  }

  return (
    <footer className="flex items-center gap-1 px-2 py-1 border-t border-border bg-card overflow-x-auto">
      <Button size="icon" variant="ghost" onClick={() => alignH("left")} title="Align left"><AlignLeft className="size-4" /></Button>
      <Button size="icon" variant="ghost" onClick={() => alignH("center")} title="Center horizontally"><AlignCenter className="size-4" /></Button>
      <Button size="icon" variant="ghost" onClick={() => alignH("right")} title="Align right"><AlignRight className="size-4" /></Button>
      <Button size="icon" variant="ghost" onClick={() => alignV("top")} title="Align top"><AlignStartHorizontal className="size-4" /></Button>
      <Button size="icon" variant="ghost" onClick={() => alignV("middle")} title="Center vertically"><AlignVerticalJustifyCenter className="size-4" /></Button>
      <Button size="icon" variant="ghost" onClick={() => alignV("bottom")} title="Align bottom"><AlignEndHorizontal className="size-4" /></Button>
      <div className="w-px h-6 bg-border mx-1" />
      <Button size="icon" variant="ghost" onClick={() => mut((l) => ({ ...l, rotation: l.rotation + 90 }))} title="Rotate 90°"><RotateCw className="size-4" /></Button>
      <Button size="icon" variant="ghost" onClick={() => mut((l) => ({ ...l, flipH: !l.flipH }))} title="Flip horizontal"><FlipHorizontal className="size-4" /></Button>
      <Button size="icon" variant="ghost" onClick={() => mut((l) => ({ ...l, flipV: !l.flipV }))} title="Flip vertical"><FlipVertical className="size-4" /></Button>
      <Button size="icon" variant="ghost" onClick={() => dispatch({ type: "set", updater: (pr) => ({ ...pr, layers: [...pr.layers, { ...selectedLayer!, id: crypto.randomUUID(), xMm: selectedLayer!.xMm + 5, yMm: selectedLayer!.yMm + 5 }] }) })} title="Duplicate"><Copy className="size-4" /></Button>
      <Button size="icon" variant="ghost" onClick={() => { dispatch({ type: "set", updater: (pr) => ({ ...pr, layers: pr.layers.filter((l) => l.id !== selectedLayer!.id) }) }); dispatch({ type: "select", id: null }); }} title="Delete"><Trash2 className="size-4" /></Button>
    </footer>
  );
}

function ZoomControl({ pxPerMm, onChange }: { pxPerMm: number; onChange: (v: number) => void }) {
  return (
    <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-card/95 backdrop-blur border border-border rounded-md shadow-md p-1">
      <Button size="icon" variant="ghost" className="size-7" onClick={() => onChange(Math.max(0.3, pxPerMm * 0.8))}>−</Button>
      <div className="text-xs tabular-nums w-12 text-center">{Math.round(pxPerMm * 100 / 3.78)}%</div>
      <Button size="icon" variant="ghost" className="size-7" onClick={() => onChange(Math.min(20, pxPerMm * 1.25))}>+</Button>
      <Button size="icon" variant="ghost" className="size-7" onClick={() => onChange(2)} title="Reset"><Maximize2 className="size-3.5" /></Button>
    </div>
  );
}

// helpers
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
function readImageDimensions(src: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = src;
  });
}
