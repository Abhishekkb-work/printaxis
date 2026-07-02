import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { EditorRoot } from "@/components/editor/Editor";
import { EntrySplash } from "@/components/editor/EntrySplash";
import { registerPwa } from "@/lib/pwa-register";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Print Axis Pro — Offline Print Layout Editor, PDF & Photo Print Tool" },
      { name: "description", content: "Print Axis Pro is a free, offline-first print layout editor. Place photos and documents on a virtual paper canvas at exact mm/cm/inch dimensions. Passport & ID templates, multi-page layouts, and PDF, DOCX, PNG & JPG export. Installable as an Android PWA." },
      { name: "keywords", content: "print axis pro, print layout editor, offline print tool, photo print, passport photo maker, ID card print, exact size print, PDF export, PWA print app, Android print PWA, print adjuster, print alignment tool, mm cm inch print, multi page print editor" },
      { name: "author", content: "Abhishek K B" },
      { name: "robots", content: "index, follow" },
      { name: "theme-color", content: "#ea580c" },
      { property: "og:title", content: "Print Axis Pro — Offline Print Layout Editor" },
      { property: "og:description", content: "Exact-size photo & document print layouts, offline. Templates, multi-page, PDF/DOCX/PNG/JPG export." },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "/icon-512.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Print Axis Pro" },
      { name: "twitter:description", content: "Offline print layout editor with exact-size sizing, templates and PDF export." },
      { name: "twitter:image", content: "/icon-512.png" },
    ],
    links: [
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "canonical", href: "https://print-axis-pro.app/" },
    ],
  }),
  component: Index,
});

function Index() {
  useEffect(() => { registerPwa(); }, []);

  // Show the entry splash once per browser session (so a refresh re-greets,
  // but in-app navigation does not).
  const [entered, setEntered] = useState(true);
  useEffect(() => {
    try {
      const seen = sessionStorage.getItem("pa-entered") === "1";
      setEntered(seen);
    } catch {
      setEntered(false);
    }
  }, []);

  function handleEnter() {
    try { sessionStorage.setItem("pa-entered", "1"); } catch { /* ignore */ }
    setEntered(true);
  }

  return (
    <>
      <EditorRoot />
      <Toaster richColors position="top-center" />
      {!entered && <EntrySplash onEnter={handleEnter} />}
    </>
  );
}
