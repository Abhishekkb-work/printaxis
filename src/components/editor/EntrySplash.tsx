import { useEffect, useState } from "react";
import { Github, ArrowRight, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * EntrySplash — first-paint welcome screen with an animated 3D-ish hero,
 * the app name, a short pitch, an Enter button, and a credit footer with
 * a GitHub icon link.
 *
 * It auto-hides after the user clicks Enter and remembers the choice for
 * the current browser session so it doesn't get in the way during a work
 * session, but still re-greets the user on a fresh visit.
 */
export function EntrySplash({ onEnter }: { onEnter: () => void }) {
  const [leaving, setLeaving] = useState(false);

  // Allow ESC / Enter key to dismiss.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Enter" || e.key === "Escape") {
        e.preventDefault();
        handleEnter();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleEnter() {
    setLeaving(true);
    window.setTimeout(onEnter, 380);
  }

  return (
    <div
      className={`fixed inset-0 z-[200] flex flex-col items-center justify-between overflow-hidden bg-gradient-to-br from-orange-50 via-amber-50 to-rose-50 dark:from-slate-950 dark:via-orange-950/40 dark:to-slate-900 transition-opacity duration-300 ${
        leaving ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      {/* Animated background orbs (3D-ish depth via blur + perspective). */}
      <div className="pointer-events-none absolute inset-0 [perspective:1200px]">
        <div className="absolute -top-32 -left-24 size-[28rem] rounded-full bg-gradient-to-br from-orange-400 to-rose-500 opacity-40 blur-3xl pa-float-a" />
        <div className="absolute top-1/3 -right-32 size-[26rem] rounded-full bg-gradient-to-br from-amber-300 to-orange-500 opacity-40 blur-3xl pa-float-b" />
        <div className="absolute -bottom-32 left-1/4 size-[22rem] rounded-full bg-gradient-to-br from-rose-400 to-amber-400 opacity-35 blur-3xl pa-float-c" />
      </div>

      {/* Hero */}
      <div className="relative flex-1 w-full flex flex-col items-center justify-center px-6 text-center">
        {/* 3D rotating printer mark */}
        <div className="relative mb-8 [perspective:900px]">
          <div className="relative size-28 sm:size-36 pa-spin-3d">
            <div className="absolute inset-0 rounded-2xl bg-white shadow-xl border border-orange-200 [transform:rotateY(0deg)_translateZ(36px)]" />
            <div className="absolute inset-0 rounded-2xl bg-orange-100 shadow-lg border border-orange-300 [transform:rotateY(0deg)_translateZ(18px)]" />
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-orange-500 to-rose-500 shadow-2xl flex items-center justify-center text-white [transform:rotateY(0deg)_translateZ(0)]">
              <Printer className="size-12 sm:size-16 drop-shadow" strokeWidth={2.2} />
            </div>
          </div>
        </div>

        <h1 className="text-4xl sm:text-5xl font-black tracking-tight bg-gradient-to-br from-orange-600 via-rose-500 to-amber-500 bg-clip-text text-transparent">
          Print Adjuster Pro
        </h1>
        <p className="mt-3 max-w-md text-sm sm:text-base text-muted-foreground">
          An offline-first print layout editor. Place photos at exact mm/cm/inch
          sizes, arrange multi-page layouts, and export to PDF, DOCX, PNG or JPG —
          all without leaving your device.
        </p>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-[11px] text-muted-foreground">
          <Badge>Works offline</Badge>
          <Badge>Multi-page</Badge>
          <Badge>Exact sizes</Badge>
          <Badge>PDF · DOCX · PNG</Badge>
        </div>

        <Button
          size="lg"
          onClick={handleEnter}
          className="mt-8 h-12 px-8 text-base bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600 text-white shadow-lg shadow-orange-500/30"
        >
          Enter app
          <ArrowRight className="size-5" />
        </Button>
      </div>

      {/* Footer credit */}
      <footer className="relative w-full flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
        <span>
          Built by <span className="font-semibold text-foreground">ABHISHEK K B</span> 🧡
        </span>
        <a
          href="https://github.com/"
          target="_blank"
          rel="noreferrer noopener"
          aria-label="Open GitHub"
          title="GitHub"
          className="inline-flex items-center justify-center size-7 rounded-full bg-foreground text-background hover:scale-110 transition-transform"
        >
          <Github className="size-3.5" />
        </a>
      </footer>

      <style>{`
        @keyframes pa-float-a { 0%,100% { transform: translate3d(0,0,0) scale(1); } 50% { transform: translate3d(20px,30px,0) scale(1.08); } }
        @keyframes pa-float-b { 0%,100% { transform: translate3d(0,0,0) scale(1); } 50% { transform: translate3d(-30px,-20px,0) scale(1.1); } }
        @keyframes pa-float-c { 0%,100% { transform: translate3d(0,0,0) scale(1); } 50% { transform: translate3d(15px,-25px,0) scale(0.95); } }
        .pa-float-a { animation: pa-float-a 9s ease-in-out infinite; }
        .pa-float-b { animation: pa-float-b 11s ease-in-out infinite; }
        .pa-float-c { animation: pa-float-c 13s ease-in-out infinite; }
        @keyframes pa-spin-3d {
          0%   { transform: rotateY(-18deg) rotateX(8deg); }
          50%  { transform: rotateY(18deg)  rotateX(-6deg); }
          100% { transform: rotateY(-18deg) rotateX(8deg); }
        }
        .pa-spin-3d { animation: pa-spin-3d 6s ease-in-out infinite; transform-style: preserve-3d; }
      `}</style>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-card/80 backdrop-blur border border-border px-2.5 py-0.5">
      {children}
    </span>
  );
}
