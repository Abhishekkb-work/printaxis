import { useEffect, useMemo, useRef, useState } from "react";
import {
  Upload, Save, Printer, Download, Undo2, Redo2,
  Trash2, Copy, Lock, Unlock, Eye, EyeOff, ArrowUp, ArrowDown,
  AlignLeft, AlignCenter, AlignRight, AlignVerticalJustifyCenter,
  AlignStartHorizontal, AlignEndHorizontal,
  RotateCw, FlipHorizontal, FlipVertical, Layers, FileText, Image as ImgIcon,
  Maximize2, FolderOpen, Sparkles, Camera, Plus, ChevronLeft, ChevronRight, X,
  LayoutGrid, FileType2, Github, Magnet, Smartphone, Crop, Wand2, ImagePlus,
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
  activePage, activeLayers, setLayers,
  addPage, duplicatePage, removePage, selectPage, movePage,
} from "@/lib/editor/store";
import type { Layer, Project, Unit } from "@/lib/editor/types";
import { PAPERS } from "@/lib/editor/papers";
import { TEMPLATES } from "@/lib/editor/templates";
import { fromMm, toMm } from "@/lib/editor/units";
import { listProjects, saveProject, deleteProject, duplicateProject } from "@/lib/editor/storage";
import {
  exportPdf, exportPng, exportJpg, exportDocx, printProject, rasterizeAll,
  type Scope,
} from "@/lib/editor/render";
import { loadPdfFromFile, renderPdfPage, parsePageRange } from "@/lib/editor/pdf-import";


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
  const layers = activeLayers(p);
  const selectedLayer = layers.find((l) => l.id === state.selectedId) ?? null;

  const [pxPerMm, setPxPerMm] = useState(2);
  const containerRef = useRef<HTMLDivElement>(null);

  // Pending images received from the Android share-target intake.
  const [sharedPending, setSharedPending] = useState<
    { src: string; w: number; h: number }[] | null
  >(null);

  // Auto-fit the paper into the available canvas area, and refit on resize.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    function fit() {
      const { wMm, hMm } = paperDims(p);
      const cw = el!.clientWidth - 32;
      const ch = el!.clientHeight - 32;
      if (cw <= 0 || ch <= 0) return;
      const next = Math.max(0.5, Math.min(cw / wMm, ch / hMm));
      setPxPerMm(next);
    }
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.paperId, p.orientation, p.customW, p.customH]);


  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === "z" && !e.shiftKey) { e.preventDefault(); dispatch({ type: "undo" }); }
      else if (mod && (e.key === "y" || (e.key === "z" && e.shiftKey))) { e.preventDefault(); dispatch({ type: "redo" }); }
      else if (e.key === "Delete" && state.selectedId) {
        dispatch({ type: "set", updater: (pr) => setLayers(pr, (ls) => ls.filter((l) => l.id !== state.selectedId)) });
        dispatch({ type: "select", id: null });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dispatch, state.selectedId]);

  // Android Share Target intake: read files dropped into share-inbox cache,
  // then open the smart-import dialog so the user picks how to place them.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("shared") !== "1") return;
    void (async () => {
      try {
        if (!("caches" in window)) return;
        const cache = await caches.open("share-inbox");
        const idxRes = await cache.match("/__share/index.json");
        if (!idxRes) return;
        const list = (await idxRes.json()) as string[];
        const collected: { src: string; w: number; h: number }[] = [];
        for (const key of list) {
          const res = await cache.match(key);
          if (!res) continue;
          const blob = await res.blob();
          const src = await blobToDataUrl(blob);
          const dim = await readImageDimensions(src);
          collected.push({ src, w: dim.w, h: dim.h });
          await cache.delete(key);
        }
        await cache.delete("/__share/index.json");
        if (collected.length) setSharedPending(collected);
      } catch (e) {
        console.error(e);
      } finally {
        url.searchParams.delete("shared");
        window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Empty-slot click → prompt to pick an image and assign it to that slot.
  const slotFileRef = useRef<HTMLInputElement>(null);
  const slotTargetIdRef = useRef<string | null>(null);
  useEffect(() => {
    function onSlot(e: Event) {
      const detail = (e as CustomEvent<{ layerId: string }>).detail;
      slotTargetIdRef.current = detail.layerId;
      slotFileRef.current?.click();
    }
    window.addEventListener("pa-slot-click", onSlot as EventListener);
    return () => window.removeEventListener("pa-slot-click", onSlot as EventListener);
  }, []);
  async function onSlotFile(files: FileList | null) {
    const id = slotTargetIdRef.current;
    const file = files?.[0];
    if (!file || !id) return;
    const src = await fileToDataUrl(file);
    const dim = await readImageDimensions(src);
    dispatch({
      type: "set",
      updater: (pr) =>
        setLayers(pr, (ls) =>
          ls.map((l) =>
            l.id === id
              ? { ...l, src, intrinsicW: dim.w, intrinsicH: dim.h, name: file.name }
              : l,
          ),
        ),
    });
    dispatch({ type: "select", id });
    slotTargetIdRef.current = null;
  }

  return (
    <div className="flex flex-col h-dvh bg-background text-foreground">
      <FirstRunInstallBanner />
      <TopBar />
      <PagesBar />
      <div className="flex-1 flex min-h-0">
        <aside className="hidden md:flex w-72 border-r border-border bg-card flex-col overflow-hidden">
          <SidePanel selectedLayer={selectedLayer} />
        </aside>

        <div ref={containerRef} className="flex-1 relative min-w-0">
          <PaperCanvas pxPerMm={pxPerMm} />
          <ZoomControl pxPerMm={pxPerMm} onChange={setPxPerMm} />
        </div>
      </div>
      <BottomBar selectedLayer={selectedLayer} />
      <CreditFooter />
      <input
        ref={slotFileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => { onSlotFile(e.target.files); e.target.value = ""; }}
      />
      <SharedImportDialog
        items={sharedPending}
        onClose={() => setSharedPending(null)}
      />
    </div>
  );
}

// =========================================================================
//  First-run install banner — invites the user to install the PWA.
// =========================================================================
type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
function FirstRunInstallBanner() {
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  const [show, setShow] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem("pa-install-dismissed") === "1") return;
    } catch { /* ignore */ }
    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // iOS Safari
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (isStandalone) { setInstalled(true); return; }
    setShow(true);
    function onBip(e: Event) {
      e.preventDefault();
      setEvt(e as BIPEvent);
    }
    function onInstalled() { setInstalled(true); setShow(false); }
    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function dismiss() {
    try { localStorage.setItem("pa-install-dismissed", "1"); } catch { /* ignore */ }
    setShow(false);
  }
  async function install() {
    // One-tap install: fire the captured prompt immediately. If the browser
    // hasn't fired beforeinstallprompt yet, just stay silent — no "how to
    // install" instructions are shown per user request.
    if (!evt) return;
    try {
      await evt.prompt();
      const { outcome } = await evt.userChoice;
      if (outcome === "accepted") setShow(false);
    } catch {
      /* swallow */
    }
  }
  if (installed || !show) return null;
  // If the browser hasn't surfaced an install prompt, don't show the banner
  // at all — avoids the "use your browser menu" fallback message.
  if (!evt) return null;
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs sm:text-sm">
      <Smartphone className="size-4 shrink-0" />
      <span className="flex-1 min-w-0 truncate">
        Install <b>Print Adjuster Pro</b> for offline use.
      </span>
      <Button size="sm" variant="secondary" className="h-7 shrink-0" onClick={install}>
        Install
      </Button>
      <button onClick={dismiss} className="opacity-90 hover:opacity-100 shrink-0" aria-label="Dismiss">
        <X className="size-4" />
      </button>
    </div>
  );
}


// =========================================================================
//  Credit footer — small "Built by" line + GitHub icon link.
// =========================================================================
function CreditFooter() {
  return (
    <div className="flex justify-end items-center gap-1.5 px-3 py-1 border-t border-border bg-card/60">
      <span className="text-[10px] text-muted-foreground">
        Built by <span className="font-medium text-foreground">ABHISHEK K B</span> 🧡
      </span>
      <a
        href="https://github.com/"
        target="_blank"
        rel="noreferrer noopener"
        className="text-muted-foreground hover:text-foreground transition-colors"
        aria-label="GitHub"
        title="GitHub"
      >
        <Github className="size-3.5" />
      </a>
    </div>
  );
}


function PagesBar() {
  const { state, dispatch } = useEditor();
  const p = state.present;
  const idx = p.pages.findIndex((pg) => pg.id === p.activePageId);
  return (
    <div className="flex items-center gap-1 px-2 py-1 border-b border-orange-200/60 dark:border-orange-900/40 bg-orange-50/80 dark:bg-orange-950/30 overflow-x-auto">
      <span className="text-xs text-muted-foreground mr-1 shrink-0">Pages</span>
      {p.pages.map((pg, i) => {
        const isActive = pg.id === p.activePageId;
        return (
          <div
            key={pg.id}
            className={`flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs shrink-0 cursor-pointer ${
              isActive ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:bg-accent"
            }`}
            onClick={() => dispatch({ type: "set", updater: (pr) => selectPage(pr, pg.id) })}
          >
            <span className="tabular-nums">{i + 1}</span>
            <span className="max-w-20 truncate">{pg.name}</span>
            {p.pages.length > 1 && (
              <button
                className="opacity-60 hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  dispatch({ type: "set", updater: (pr) => removePage(pr, pg.id) });
                }}
                title="Remove page"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        );
      })}
      <Button size="icon" variant="ghost" className="size-7 shrink-0" title="Add page"
        onClick={() => dispatch({ type: "set", updater: (pr) => addPage(pr) })}>
        <Plus className="size-4" />
      </Button>
      <Button size="icon" variant="ghost" className="size-7 shrink-0" title="Duplicate page"
        onClick={() => dispatch({ type: "set", updater: (pr) => duplicatePage(pr, pr.activePageId) })}>
        <Copy className="size-4" />
      </Button>
      <div className="flex-1" />
      <PagesOverviewButton />
      <Button size="icon" variant="ghost" className="size-7 shrink-0" title="Move left" disabled={idx <= 0}
        onClick={() => dispatch({ type: "set", updater: (pr) => movePage(pr, pr.activePageId, -1) })}>
        <ChevronLeft className="size-4" />
      </Button>
      <Button size="icon" variant="ghost" className="size-7 shrink-0" title="Move right" disabled={idx >= p.pages.length - 1}
        onClick={() => dispatch({ type: "set", updater: (pr) => movePage(pr, pr.activePageId, 1) })}>
        <ChevronRight className="size-4" />
      </Button>

    </div>
  );
}

/**
 * TbBtn — compact toolbar button that always shows a tiny text label
 * under the icon. Designed so the toolbar is readable on mobile without
 * having to guess what each icon does.
 */
function TbBtn({
  label,
  onClick,
  disabled,
  active,
  children,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-md transition-colors shrink-0 ${
        active
          ? "bg-orange-200/80 dark:bg-orange-800/60 text-foreground"
          : "hover:bg-orange-100 dark:hover:bg-orange-900/40 text-foreground/80"
      } disabled:opacity-40 disabled:pointer-events-none`}
    >
      {children}
      <span className="text-[10px] leading-none">{label}</span>
    </button>
  );
}

function TopBar() {
  const { state, dispatch } = useEditor();
  const p = state.present;
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const [openProjects, setOpenProjects] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [pdfPending, setPdfPending] = useState<File | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || !files.length) return;
    const { wMm, hMm } = paperDims(p);
    for (const file of Array.from(files)) {
      if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
        setPdfPending(file);
        continue;
      }
      if (!file.type.startsWith("image/")) continue;
      const src = await fileToDataUrl(file);
      const dim = await readImageDimensions(src);
      const layer = newLayerFromImage({ src, intrinsicW: dim.w, intrinsicH: dim.h, paperWmm: wMm, paperHmm: hMm });
      dispatch({ type: "set", updater: (pr) => setLayers(pr, (ls) => [...ls, layer]) });
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
  async function onLoad(pr: Project) { dispatch({ type: "load", project: pr }); setOpenProjects(false); }
  async function onDelete(id: string) { await deleteProject(id); setProjects(await listProjects()); }
  async function onDuplicate(pr: Project) { await duplicateProject(pr); setProjects(await listProjects()); }

  return (
    <header className="flex flex-wrap items-center gap-1 px-2 py-1.5 border-b border-orange-200/60 dark:border-orange-900/40 bg-orange-50 dark:bg-orange-950/40">
      <div className="flex items-center gap-2 pr-2 mr-1 border-r border-border shrink-0">
        <div className="h-8 w-8 rounded-md bg-gradient-to-br from-orange-500 to-rose-500 text-white grid place-items-center font-bold shadow">P</div>
        <Input
          value={p.name}
          onChange={(e) => dispatch({ type: "set", updater: (pr) => ({ ...pr, name: e.target.value })})}
          className="h-7 w-28 sm:w-40 text-sm"
        />
      </div>

      <TbBtn label="Undo" onClick={() => dispatch({ type: "undo" })} disabled={!state.past.length}>
        <Undo2 className="size-4" />
      </TbBtn>
      <TbBtn label="Redo" onClick={() => dispatch({ type: "redo" })} disabled={!state.future.length}>
        <Redo2 className="size-4" />
      </TbBtn>

      <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
      <input ref={pdfRef} type="file" accept="application/pdf" hidden onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />

      {/* Highlighted Import action — visually prominent so the primary
          "bring in an image" path is obvious on mobile. */}
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        title="Import image"
        aria-label="Import image"
        className="flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded-md shrink-0
                   text-white shadow-md shadow-orange-500/30
                   bg-gradient-to-br from-orange-500 via-orange-500 to-rose-500
                   hover:from-orange-600 hover:to-rose-600 active:translate-y-px transition"
        style={{ backgroundImage: "linear-gradient(135deg,#fb923c 0%,#f97316 45%,#f43f5e 100%)" }}
      >
        <ImagePlus className="size-4" />
        <span className="text-[10px] leading-none font-semibold">Import</span>
      </button>

      <TbBtn label="Add" onClick={() => fileRef.current?.click()}><Upload className="size-4" /></TbBtn>
      <TbBtn label="Camera" onClick={() => cameraRef.current?.click()}><Camera className="size-4" /></TbBtn>
      <TbBtn label="PDF" onClick={() => pdfRef.current?.click()}><FileType2 className="size-4" /></TbBtn>

      <TemplatesMenu />

      <TbBtn label="Arrange" onClick={() => dispatch({ type: "set", updater: (pr) => autoArrange(pr) })}>
        <Wand2 className="size-4" />
      </TbBtn>

      <TbBtn
        label={p.snap ? "Snap on" : "Snap"}
        active={p.snap}
        onClick={() => dispatch({ type: "set", updater: (pr) => ({ ...pr, snap: !pr.snap }) })}
      >
        <Magnet className="size-4" />
      </TbBtn>

      <div className="flex-1 min-w-2" />

      <TbBtn label="Open" onClick={onOpenProjects}><FolderOpen className="size-4" /></TbBtn>
      <TbBtn label="Save" onClick={onSave}><Save className="size-4" /></TbBtn>

      <ExportMenu />
      <PrintPreviewButton />

      <Sheet>
        <SheetTrigger asChild>
          <button className="md:hidden flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-md hover:bg-orange-100 dark:hover:bg-orange-900/40 text-foreground/80">
            <Layers className="size-4" />
            <span className="text-[10px] leading-none">Panel</span>
          </button>
        </SheetTrigger>
        <SheetContent side="right" className="w-80 p-0 overflow-y-auto">
          <SheetHeader className="p-3 border-b border-border">
            <SheetTitle>Layers & properties</SheetTitle>
          </SheetHeader>
          <SidePanel selectedLayer={activeLayers(state.present).find((l) => l.id === state.selectedId) ?? null} />
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
      <PdfImportDialog file={pdfPending} onClose={() => setPdfPending(null)} />
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
                  const first = activeLayers(p).find((l) => l.src);
                  dispatch({
                    type: "set",
                    updater: (pr) =>
                      applyTemplate(pr, t, first?.src ?? null,
                        first ? { w: first.intrinsicW, h: first.intrinsicH } : undefined),
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
  const p = state.present;
  const [dpi, setDpi] = useState(300);
  const [dpiPreset, setDpiPreset] = useState<string>("300");
  const [scopeMode, setScopeMode] = useState<"active" | "all" | "range">("all");
  const [rangeStr, setRangeStr] = useState("1");
  const [busy, setBusy] = useState<string | null>(null);

  const scope: Scope = useMemo(() => {
    if (scopeMode === "active") return "active";
    if (scopeMode === "all") return "all";
    // Parse "1-3,5" against page count, map to page IDs.
    const nums = parsePageRange(rangeStr, p.pages.length);
    return { pageIds: nums.map((n) => p.pages[n - 1].id) };
  }, [scopeMode, rangeStr, p.pages]);

  const pageCount =
    scopeMode === "active"
      ? 1
      : scopeMode === "all"
      ? p.pages.length
      : typeof scope === "object" && "pageIds" in scope
      ? scope.pageIds.length
      : 0;

  async function run(name: string, fn: () => Promise<void>) {
    if (!pageCount) { toast.error("No pages selected"); return; }
    try { setBusy(name); await fn(); toast.success(`${name} ready`); }
    catch (e) { console.error(e); toast.error(`${name} failed`); }
    finally { setBusy(null); }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-gradient-to-br from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-md shadow-orange-500/20"><Download className="size-4 mr-1" /> Export</Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Export</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Pages</Label>
            <Select value={scopeMode} onValueChange={(v) => setScopeMode(v as typeof scopeMode)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Current page</SelectItem>
                <SelectItem value="all">All pages ({p.pages.length})</SelectItem>
                <SelectItem value="range">Custom range…</SelectItem>
              </SelectContent>
            </Select>
            {scopeMode === "range" && (
              <Input
                className="mt-2"
                placeholder={`e.g. 1-3,5  (of ${p.pages.length})`}
                value={rangeStr}
                onChange={(e) => setRangeStr(e.target.value)}
              />
            )}
          </div>
          <div>
            <Label className="text-xs">Resolution (DPI)</Label>
            <Select value={dpiPreset} onValueChange={(v) => { setDpiPreset(v); if (v !== "custom") setDpi(Number(v)); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="96">96 DPI — screen</SelectItem>
                <SelectItem value="150">150 DPI — draft</SelectItem>
                <SelectItem value="300">300 DPI — high quality</SelectItem>
                <SelectItem value="600">600 DPI — photo lab</SelectItem>
                <SelectItem value="custom">Custom…</SelectItem>
              </SelectContent>
            </Select>
            {dpiPreset === "custom" && (
              <Input
                className="mt-2"
                type="number"
                min={36}
                max={1200}
                value={dpi}
                onChange={(e) => setDpi(Math.max(36, Math.min(1200, Number(e.target.value) || 0)))}
              />
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {pageCount} page{pageCount === 1 ? "" : "s"} · {dpi} DPI
            {pageCount > 1 && " · PNG/JPG packed as .zip"}
          </p>
        </div>
        <DialogFooter className="flex-wrap gap-2">
          <Button variant="outline" disabled={!!busy} onClick={() => run("PNG", () => exportPng(p, dpi, scope))}><ImgIcon className="size-4 mr-1" />PNG</Button>
          <Button variant="outline" disabled={!!busy} onClick={() => run("JPG", () => exportJpg(p, dpi, scope))}><ImgIcon className="size-4 mr-1" />JPG</Button>
          <Button variant="outline" disabled={!!busy} onClick={() => {
            const name = window.prompt("File name for DOCX export:", (p.name || "page").replace(/\.docx$/i, ""));
            if (name === null) return;
            run("DOCX", () => exportDocx(p, dpi, scope, name || undefined));
          }}><FileText className="size-4 mr-1" />DOCX</Button>
          <Button disabled={!!busy} onClick={() => {
            const name = window.prompt("File name for PDF export:", (p.name || "page").replace(/\.pdf$/i, ""));
            if (name === null) return;
            run("PDF", () => exportPdf(p, dpi, scope, name || undefined));
          }}><FileText className="size-4 mr-1" />PDF</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function PrintPreviewButton() {
  const { state } = useEditor();
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<"active" | "all">("all");
  const [previews, setPreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const p = state.present;
  const { wMm, hMm } = paperDims(p);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setPreviews([]);
    void (async () => {
      try {
        const canvases = await rasterizeAll(p, 96, scope);
        if (cancelled) return;
        setPreviews(canvases.map((c) => c.toDataURL("image/jpeg", 0.85)));
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [open, scope, p]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-gradient-to-br from-rose-500 to-orange-600 hover:from-rose-600 hover:to-orange-700 text-white shadow-md shadow-rose-500/20"><Printer className="size-4 mr-1" /> Print</Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader><DialogTitle>Print preview</DialogTitle></DialogHeader>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{wMm.toFixed(0)} × {hMm.toFixed(0)} mm • {p.orientation}</span>
          <div className="flex-1" />
          <Select value={scope} onValueChange={(v) => setScope(v as "active" | "all")}>
            <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Current page</SelectItem>
              <SelectItem value="all">All pages ({p.pages.length})</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 overflow-y-auto bg-muted/40 rounded-md p-4 grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
          {loading && <div className="col-span-full text-center text-sm text-muted-foreground py-10">Rendering…</div>}
          {!loading && previews.map((src, i) => (
            <figure key={i} className="bg-white shadow rounded overflow-hidden" style={{ aspectRatio: `${wMm}/${hMm}` }}>
              <img src={src} alt={`Page ${i + 1}`} className="w-full h-full object-contain" />
              <figcaption className="text-[10px] text-center text-muted-foreground py-1 bg-card">Page {i + 1}</figcaption>
            </figure>
          ))}
          {!loading && !previews.length && (
            <div className="col-span-full text-center text-sm text-muted-foreground py-10">Nothing to print yet.</div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
          <Button onClick={() => printProject(p, 300, scope)}><Printer className="size-4 mr-1" /> Print</Button>
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
  const ap = activePage(p);
  return (
    <div className="space-y-4 pt-2">
      <div>
        <Label className="text-xs">Page name</Label>
        <Input value={ap.name}
          onChange={(e) => dispatch({ type: "set", updater: (pr) => ({ ...pr, pages: pr.pages.map((pg) => pg.id === pr.activePageId ? { ...pg, name: e.target.value } : pg) }) })} />
      </div>
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
      {/* Snap strength: smaller spacing = stronger / finer snapping. */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Snap strength</Label>
          <span className="text-[11px] text-muted-foreground">{p.gridMm} mm step</span>
        </div>
        <input
          type="range"
          min={0.5}
          max={10}
          step={0.5}
          value={p.gridMm}
          disabled={!p.snap}
          onChange={(e) => dispatch({ type: "set", updater: (pr) => ({ ...pr, gridMm: Number(e.target.value) }) })}
          className="w-full accent-orange-500 disabled:opacity-40"
        />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>Fine (0.5mm)</span>
          <span>Coarse (10mm)</span>
        </div>
      </div>

    </div>
  );
}

function LayersList() {
  const { state, dispatch } = useEditor();
  const layers = [...activeLayers(state.present)].reverse();

  function move(id: string, dir: -1 | 1) {
    dispatch({
      type: "set",
      updater: (pr) => setLayers(pr, (ls) => {
        const i = ls.findIndex((l) => l.id === id);
        if (i < 0) return ls;
        const ni = i + dir;
        if (ni < 0 || ni >= ls.length) return ls;
        const arr = [...ls];
        const [item] = arr.splice(i, 1);
        arr.splice(ni, 0, item);
        return arr;
      }),
    });
  }
  function mut(id: string, fn: (l: Layer) => Layer) {
    dispatch({ type: "set", updater: (pr) => setLayers(pr, (ls) => ls.map((l) => l.id === id ? fn(l) : l)) });
  }
  function remove(id: string) {
    dispatch({ type: "set", updater: (pr) => setLayers(pr, (ls) => ls.filter((l) => l.id !== id)) });
  }

  return (
    <div className="space-y-1 pt-2">
      {!layers.length && <p className="text-sm text-muted-foreground py-4">No layers yet. Tap "Add" or "Camera" to import an image.</p>}
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
    dispatch({ type: "set", updater: (pr) => setLayers(pr, (ls) => ls.map((l) => l.id === layer.id ? fn(l) : l)) });
  }
  function setW(mm: number) {
    mut((l) => { const aspect = l.wMm / l.hMm; return { ...l, wMm: mm, hMm: keepAspect ? mm / aspect : l.hMm }; });
  }
  function setH(mm: number) {
    mut((l) => { const aspect = l.wMm / l.hMm; return { ...l, hMm: mm, wMm: keepAspect ? mm * aspect : l.wMm }; });
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
        <Button variant="outline" size="sm" onClick={() => dispatch({ type: "set", updater: (pr) => setLayers(pr, (ls) => [...ls, { ...layer, id: crypto.randomUUID(), xMm: layer.xMm + 5, yMm: layer.yMm + 5 }]) })}><Copy className="size-3.5 mr-1" />Duplicate</Button>
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
        onBlur={() => { const n = parseFloat(text); if (!isNaN(n)) onChange(toMm(n, unit)); }}
      />
    </div>
  );
}

function BottomBar({ selectedLayer }: { selectedLayer: Layer | null }) {
  const { state, dispatch } = useEditor();
  const p = state.present;
  if (!selectedLayer) {
    return (
      <footer className="flex md:hidden items-center justify-around px-2 py-1 border-t border-orange-200/60 dark:border-orange-900/40 bg-orange-50/80 dark:bg-orange-950/30 text-xs text-muted-foreground">
        Tap an image to edit it.
      </footer>
    );
  }
  function mut(fn: (l: Layer) => Layer) {
    dispatch({ type: "set", updater: (pr) => setLayers(pr, (ls) => ls.map((l) => l.id === selectedLayer!.id ? fn(l) : l)) });
  }
  const { wMm, hMm } = paperDims(p);
  function alignH(kind: "left" | "center" | "right") {
    mut((l) => ({ ...l, xMm: kind === "left" ? p.marginMm : kind === "right" ? wMm - p.marginMm - l.wMm : (wMm - l.wMm) / 2 }));
  }
  function alignV(kind: "top" | "middle" | "bottom") {
    mut((l) => ({ ...l, yMm: kind === "top" ? p.marginMm : kind === "bottom" ? hMm - p.marginMm - l.hMm : (hMm - l.hMm) / 2 }));
  }

  return (
    <footer className="flex items-center gap-1 px-2 py-1 border-t border-orange-200/60 dark:border-orange-900/40 bg-orange-50/80 dark:bg-orange-950/30 overflow-x-auto">
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
      <Button size="icon" variant="ghost" onClick={() => dispatch({ type: "set", updater: (pr) => setLayers(pr, (ls) => [...ls, { ...selectedLayer!, id: crypto.randomUUID(), xMm: selectedLayer!.xMm + 5, yMm: selectedLayer!.yMm + 5 }]) })} title="Duplicate"><Copy className="size-4" /></Button>
      <Button size="icon" variant="ghost" onClick={() => { dispatch({ type: "set", updater: (pr) => setLayers(pr, (ls) => ls.filter((l) => l.id !== selectedLayer!.id)) }); dispatch({ type: "select", id: null }); }} title="Delete"><Trash2 className="size-4" /></Button>
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
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}
function readImageDimensions(src: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = src;
  });
}

/**
 * autoArrange — repack the active page's visible (non-locked, non-hidden)
 * layers into a tidy grid that fits within the page margins. Layers keep
 * their original aspect ratio; sizes are scaled uniformly so every layer
 * fits inside its computed cell.
 */
function autoArrange(pr: Project): Project {
  const { wMm, hMm } = paperDims(pr);
  const innerW = Math.max(10, wMm - pr.marginMm * 2);
  const innerH = Math.max(10, hMm - pr.marginMm * 2);
  return {
    ...pr,
    pages: pr.pages.map((pg) => {
      if (pg.id !== pr.activePageId) return pg;
      const movable = pg.layers.filter((l) => !l.hidden && !l.locked);
      const fixed = pg.layers.filter((l) => l.hidden || l.locked);
      const n = movable.length;
      if (!n) return pg;
      const cols = Math.ceil(Math.sqrt(n * (innerW / innerH)));
      const rows = Math.ceil(n / cols);
      const gap = Math.min(3, innerW / (cols * 6));
      const cellW = (innerW - gap * (cols - 1)) / cols;
      const cellH = (innerH - gap * (rows - 1)) / rows;
      const arranged = movable.map((l, i) => {
        const r = Math.floor(i / cols);
        const c = i % cols;
        const ar = l.wMm / l.hMm || 1;
        let w = cellW;
        let h = w / ar;
        if (h > cellH) { h = cellH; w = h * ar; }
        const cx = pr.marginMm + c * (cellW + gap) + cellW / 2;
        const cy = pr.marginMm + r * (cellH + gap) + cellH / 2;
        return { ...l, rotation: 0, wMm: w, hMm: h, xMm: cx - w / 2, yMm: cy - h / 2 };
      });
      return { ...pg, layers: [...fixed, ...arranged] };
    }),
  };
}

/**
 * cropImage — given a dataURL and a percent rectangle (0..1), produce a
 * new cropped dataURL plus its intrinsic pixel dimensions.
 */
function cropImage(
  src: string,
  rect: { x: number; y: number; w: number; h: number },
): Promise<{ src: string; w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const sx = Math.max(0, Math.floor(rect.x * img.naturalWidth));
      const sy = Math.max(0, Math.floor(rect.y * img.naturalHeight));
      const sw = Math.max(1, Math.floor(rect.w * img.naturalWidth));
      const sh = Math.max(1, Math.floor(rect.h * img.naturalHeight));
      const c = document.createElement("canvas");
      c.width = sw;
      c.height = sh;
      const ctx = c.getContext("2d");
      if (!ctx) return reject(new Error("no ctx"));
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      resolve({ src: c.toDataURL("image/png"), w: sw, h: sh });
    };
    img.onerror = reject;
    img.src = src;
  });
}

// =========================================================================
//  PDF import dialog — render selected pages and add each as a new page.
// =========================================================================
function PdfImportDialog({ file, onClose }: { file: File | null; onClose: () => void }) {
  const { state, dispatch } = useEditor();
  const [doc, setDoc] = useState<Awaited<ReturnType<typeof loadPdfFromFile>> | null>(null);
  const [thumbs, setThumbs] = useState<{ src: string; w: number; h: number }[]>([]);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [dpi, setDpi] = useState(200);
  const [mode, setMode] = useState<"newPages" | "currentPage">("newPages");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!file) { setDoc(null); setThumbs([]); setPicked(new Set()); return; }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const d = await loadPdfFromFile(file);
        if (cancelled) return;
        setDoc(d);
        const all = new Set<number>();
        const tmps: { src: string; w: number; h: number }[] = [];
        for (let i = 1; i <= d.numPages; i++) {
          const img = await renderPdfPage(d, i, 48);
          if (cancelled) return;
          tmps.push({ src: img.src, w: img.w, h: img.h });
          all.add(i);
        }
        setThumbs(tmps);
        setPicked(all);
      } catch (e) {
        console.error(e);
        toast.error("Could not read PDF");
        onClose();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  function toggle(n: number) {
    const next = new Set(picked);
    if (next.has(n)) next.delete(n); else next.add(n);
    setPicked(next);
  }

  async function importPicked() {
    if (!doc || !picked.size) return;
    setBusy(true);
    try {
      const sorted = [...picked].sort((a, b) => a - b);
      const p = state.present;
      const { wMm, hMm } = paperDims(p);
      for (const n of sorted) {
        const img = await renderPdfPage(doc, n, dpi);
        if (mode === "newPages") {
          dispatch({ type: "set", updater: (pr) => addPage(pr, `${file?.name ?? "PDF"} p${n}`) });
        }
        const layer = newLayerFromImage({
          src: img.src, intrinsicW: img.w, intrinsicH: img.h, paperWmm: wMm, paperHmm: hMm,
        });
        // Fill the page (preserve aspect within margin box).
        const innerW = wMm - p.marginMm * 2;
        const innerH = hMm - p.marginMm * 2;
        const aspect = img.w / img.h;
        let lw = innerW;
        let lh = lw / aspect;
        if (lh > innerH) { lh = innerH; lw = lh * aspect; }
        layer.wMm = lw;
        layer.hMm = lh;
        layer.xMm = (wMm - lw) / 2;
        layer.yMm = (hMm - lh) / 2;
        dispatch({ type: "set", updater: (pr) => setLayers(pr, (ls) => [...ls, layer]) });
        dispatch({ type: "select", id: layer.id });
      }
      toast.success(`Imported ${sorted.length} PDF page${sorted.length === 1 ? "" : "s"}`);
      onClose();
    } catch (e) {
      console.error(e);
      toast.error("PDF import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!file} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader><DialogTitle>Import PDF pages</DialogTitle></DialogHeader>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="text-muted-foreground">
            {doc ? `${doc.numPages} page${doc.numPages === 1 ? "" : "s"} · ${picked.size} selected` : loading ? "Reading PDF…" : ""}
          </span>
          <div className="flex-1" />
          <Button size="sm" variant="outline" onClick={() => setPicked(new Set(thumbs.map((_, i) => i + 1)))}>All</Button>
          <Button size="sm" variant="outline" onClick={() => setPicked(new Set())}>None</Button>
          <Select value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
            <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="newPages">One new page each</SelectItem>
              <SelectItem value="currentPage">All on current page</SelectItem>
            </SelectContent>
          </Select>
          <Select value={String(dpi)} onValueChange={(v) => setDpi(Number(v))}>
            <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="100">100 DPI</SelectItem>
              <SelectItem value="200">200 DPI</SelectItem>
              <SelectItem value="300">300 DPI</SelectItem>
              <SelectItem value="600">600 DPI</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 overflow-y-auto bg-muted/40 rounded-md p-3 grid gap-3"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))" }}>
          {loading && <div className="col-span-full text-center text-sm text-muted-foreground py-10">Rendering thumbnails…</div>}
          {!loading && thumbs.map((t, i) => {
            const n = i + 1;
            const selected = picked.has(n);
            return (
              <button
                key={n}
                type="button"
                onClick={() => toggle(n)}
                className={`relative bg-white rounded overflow-hidden border-2 transition-colors ${selected ? "border-primary" : "border-transparent hover:border-border"}`}
                style={{ aspectRatio: `${t.w}/${t.h}` }}
              >
                <img src={t.src} alt={`Page ${n}`} className="w-full h-full object-contain" />
                <span className={`absolute top-1 left-1 text-[10px] rounded px-1.5 py-0.5 ${selected ? "bg-primary text-primary-foreground" : "bg-card/80 text-muted-foreground"}`}>
                  {n}
                </span>
              </button>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={importPicked} disabled={busy || !picked.size}>
            {busy ? "Importing…" : `Import ${picked.size || ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =========================================================================
//  Shared-images smart import — choose how to place shared images.
// =========================================================================
function SharedImportDialog({
  items,
  onClose,
}: {
  items: { src: string; w: number; h: number }[] | null;
  onClose: () => void;
}) {
  const { state, dispatch } = useEditor();
  const [mode, setMode] = useState<"current" | "tile" | "pages">("current");

  if (!items || !items.length) return null;



  function importAll() {
    const p = state.present;
    const { wMm, hMm } = paperDims(p);
    dispatch({
      type: "set",
      updater: (pr) => {
        let next = pr;
        if (mode === "current") {
          for (const it of items!) {
            const layer = newLayerFromImage({ src: it.src, intrinsicW: it.w, intrinsicH: it.h, paperWmm: wMm, paperHmm: hMm });
            next = setLayers(next, (ls) => [...ls, layer]);
          }
        } else if (mode === "pages") {
          for (const it of items!) {
            next = addPage(next, "Shared");
            const innerW = wMm - next.marginMm * 2;
            const innerH = hMm - next.marginMm * 2;
            const aspect = it.w / it.h;
            let lw = innerW; let lh = lw / aspect;
            if (lh > innerH) { lh = innerH; lw = lh * aspect; }
            const layer: Layer = {
              ...newLayerFromImage({ src: it.src, intrinsicW: it.w, intrinsicH: it.h, paperWmm: wMm, paperHmm: hMm }),
              wMm: lw, hMm: lh, xMm: (wMm - lw) / 2, yMm: (hMm - lh) / 2,
            };
            next = setLayers(next, (ls) => [...ls, layer]);
          }
        } else {
          // tile on a new page in a grid
          next = addPage(next, "Shared tile");
          const n = items!.length;
          const cols = Math.ceil(Math.sqrt(n));
          const rows = Math.ceil(n / cols);
          const innerW = wMm - next.marginMm * 2;
          const innerH = hMm - next.marginMm * 2;
          const gap = 2;
          const cellW = (innerW - gap * (cols - 1)) / cols;
          const cellH = (innerH - gap * (rows - 1)) / rows;
          items!.forEach((it, i) => {
            const r = Math.floor(i / cols);
            const c = i % cols;
            const aspect = it.w / it.h;
            let lw = cellW; let lh = lw / aspect;
            if (lh > cellH) { lh = cellH; lw = lh * aspect; }
            const x = next.marginMm + c * (cellW + gap) + (cellW - lw) / 2;
            const y = next.marginMm + r * (cellH + gap) + (cellH - lh) / 2;
            const layer: Layer = {
              ...newLayerFromImage({ src: it.src, intrinsicW: it.w, intrinsicH: it.h, paperWmm: wMm, paperHmm: hMm }),
              wMm: lw, hMm: lh, xMm: x, yMm: y,
            };
            next = setLayers(next, (ls) => [...ls, layer]);
          });
        }
        return next;
      },
    });
    toast.success(`Imported ${items!.length} shared image${items!.length === 1 ? "" : "s"}`);
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Import shared images</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">
          {items.length} image{items.length === 1 ? "" : "s"} received from Android share. Choose how to place them.
        </p>
        <div className="grid grid-cols-3 gap-2 max-h-44 overflow-y-auto">
          {items.slice(0, 9).map((it, i) => (
            <img key={i} src={it.src} alt="" className="aspect-square object-cover rounded border border-border" />
          ))}
        </div>
        <div>
          <Label className="text-xs">Placement</Label>
          <Select value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="current">All on current page</SelectItem>
              <SelectItem value="pages">One new page each (full-bleed)</SelectItem>
              <SelectItem value="tile">Auto-tile on a new page</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={importAll}>Import</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =========================================================================
//  Pages overview — grid of thumbnails for every page; click to switch.
// =========================================================================
function PagesOverviewButton() {
  const { state, dispatch } = useEditor();
  const p = state.present;
  const [open, setOpen] = useState(false);
  const [thumbs, setThumbs] = useState<{ id: string; src: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const { wMm, hMm } = paperDims(p);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setThumbs([]);
    setSelection(new Set());
    void (async () => {
      try {
        const canvases = await rasterizeAll(p, 72, "all");
        if (cancelled) return;
        setThumbs(canvases.map((c, i) => ({ id: p.pages[i].id, src: c.toDataURL("image/jpeg", 0.8) })));
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, p]);

  function toggle(id: string) {
    const next = new Set(selection);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelection(next);
  }

  function editPage(id: string) {
    dispatch({ type: "set", updater: (pr) => selectPage(pr, id) });
    setOpen(false);
  }

  function deleteSelected() {
    if (!selection.size) return;
    dispatch({
      type: "set",
      updater: (pr) => {
        let next = pr;
        for (const id of selection) next = removePage(next, id);
        return next;
      },
    });
    setSelection(new Set());
  }

  function duplicateSelected() {
    if (!selection.size) return;
    dispatch({
      type: "set",
      updater: (pr) => {
        let next = pr;
        for (const id of selection) next = duplicatePage(next, id);
        return next;
      },
    });
  }

  return (
    <>
      <Button size="icon" variant="ghost" className="size-7 shrink-0" title="Pages overview"
        onClick={() => setOpen(true)}>
        <LayoutGrid className="size-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader><DialogTitle>All pages ({p.pages.length})</DialogTitle></DialogHeader>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{wMm.toFixed(0)} × {hMm.toFixed(0)} mm · {p.orientation}</span>
            <div className="flex-1" />
            <span>{selection.size} selected</span>
            <Button size="sm" variant="outline" disabled={!selection.size} onClick={duplicateSelected}>
              <Copy className="size-3.5 mr-1" /> Duplicate
            </Button>
            <Button size="sm" variant="outline" disabled={!selection.size || p.pages.length <= 1} onClick={deleteSelected}>
              <Trash2 className="size-3.5 mr-1" /> Delete
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto bg-muted/40 rounded-md p-3 grid gap-3"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
            {loading && <div className="col-span-full text-center text-sm text-muted-foreground py-10">Rendering thumbnails…</div>}
            {!loading && thumbs.map((t, i) => {
              const isActive = t.id === p.activePageId;
              const isPicked = selection.has(t.id);
              const page = p.pages[i];
              return (
                <div key={t.id} className={`group relative bg-white rounded overflow-hidden border-2 ${isPicked ? "border-primary" : isActive ? "border-primary/40" : "border-transparent hover:border-border"}`}>
                  <button
                    type="button"
                    onClick={() => editPage(t.id)}
                    className="block w-full"
                    style={{ aspectRatio: `${wMm}/${hMm}` }}
                    title="Open page for editing"
                  >
                    <img src={t.src} alt={page.name} className="w-full h-full object-contain" />
                  </button>
                  <div className="absolute top-1 left-1 flex items-center gap-1">
                    <span className="text-[10px] rounded px-1.5 py-0.5 bg-card/90 text-foreground tabular-nums">{i + 1}</span>
                    {isActive && <span className="text-[10px] rounded px-1.5 py-0.5 bg-primary text-primary-foreground">current</span>}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggle(t.id); }}
                    className={`absolute top-1 right-1 size-5 rounded border ${isPicked ? "bg-primary border-primary text-primary-foreground" : "bg-card/80 border-border text-muted-foreground"} grid place-items-center text-[10px]`}
                    title={isPicked ? "Deselect" : "Select"}
                  >
                    {isPicked ? "✓" : ""}
                  </button>
                  <div className="px-2 py-1 text-[11px] truncate bg-card border-t border-border flex items-center gap-1">
                    <span className="flex-1 truncate">{page.name}</span>
                    <Button size="icon" variant="ghost" className="size-6" onClick={() => editPage(t.id)} title="Edit">
                      <Sparkles className="size-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
            <Button onClick={() => { dispatch({ type: "set", updater: (pr) => addPage(pr) }); setOpen(false); }}>
              <Plus className="size-4 mr-1" /> Add page
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

