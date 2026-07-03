import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { EditorRoot } from "@/components/editor/Editor";
import { EntrySplash } from "@/components/editor/EntrySplash";
import { registerPwa } from "@/lib/pwa-register";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Print Axis Pro — Offline Print Layout Editor by Abhi" },
      { name: "description", content: "Print Axis Pro (also known as Print by Abhi / Abhi Print Axis) is a free offline print layout editor. Place photos at exact mm/cm/inch sizes, use passport & ID templates, and export to PDF, DOCX, PNG or JPG." },
      { name: "keywords", content: "print axis pro, print axis, abhi print axis, print by abhi, print axis by abhi, abhishek print axis, abhi print, print pro by abhi, print adjuster pro, print layout editor, offline print tool, passport photo maker, exact size print, PDF export, DOCX export, PWA print app, Android print app, multi page print, photo print editor" },
      { name: "google-site-verification", content: "knMvxmU_w_K5PFbOFKRig6hE_RREluSMzvllG6KJdFI" },

      { name: "author", content: "Abhishek K B" },
      { name: "robots", content: "index, follow" },
      { name: "theme-color", content: "#ea580c" },
      { property: "og:title", content: "Print Axis Pro — Offline Print Layout Editor" },
      { property: "og:description", content: "Exact-size photo & document print layouts, offline. Templates, multi-page, PDF/DOCX/PNG/JPG export." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://printaxis.lovable.app/" },
      { property: "og:image", content: "https://printaxis.lovable.app/icon-512.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Print Axis Pro" },
      { name: "twitter:description", content: "Offline print layout editor with exact-size sizing, templates and PDF export." },
      { name: "twitter:image", content: "https://printaxis.lovable.app/icon-512.png" },
    ],
    links: [
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "canonical", href: "https://printaxis.lovable.app/" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "Print Axis Pro",
          applicationCategory: "UtilitiesApplication",
          operatingSystem: "Android, Web",
          description: "Offline print layout editor for exact-size photo and document printing. Import images or PDFs, arrange multi-page layouts, and export to PDF, DOCX, PNG or JPG.",
          author: { "@type": "Person", name: "Abhishek K B" },
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        }),
      },
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
