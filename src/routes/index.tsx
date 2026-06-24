import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { EditorRoot } from "@/components/editor/Editor";
import { registerPwa } from "@/lib/pwa-register";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Print Adjuster Pro — Offline print layout editor" },
      { name: "description", content: "Place photos and documents on a virtual paper canvas at exact mm/cm/inch dimensions, then print or export to PDF. Works fully offline." },
      { name: "theme-color", content: "#1e40af" },
      { property: "og:title", content: "Print Adjuster Pro" },
      { property: "og:description", content: "Offline print layout editor with exact-size sizing, templates and PDF export." },
    ],
    links: [
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
    ],
  }),
  component: Index,
});

function Index() {
  useEffect(() => { registerPwa(); }, []);
  return (
    <>
      <EditorRoot />
      <Toaster richColors position="top-center" />
    </>
  );
}
