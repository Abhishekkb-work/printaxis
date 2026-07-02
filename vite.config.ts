import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      VitePWA({
        strategies: "injectManifest",
        srcDir: "src",
        filename: "sw.ts",
        registerType: "autoUpdate",
        injectRegister: null,
        devOptions: { enabled: false },
        includeAssets: ["favicon.png", "apple-touch-icon.png", "icon-192.png", "icon-512.png"],
        injectManifest: {
          globPatterns: ["**/*.{js,css,html,png,svg,webmanifest,woff2}"],
        },
        manifest: {
          name: "Print Axis Pro",
          short_name: "PrintAxis",
          description:
            "Offline print-layout editor for exact-size photo and document printing.",
          theme_color: "#ea580c",
          background_color: "#fff7ed",
          display: "standalone",
          orientation: "any",
          start_url: "/",
          scope: "/",
          icons: [
            { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
            { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
            { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
          ],
          share_target: {
            action: "/share-target",
            method: "POST",
            enctype: "multipart/form-data",
            params: {
              title: "title",
              text: "text",
              url: "url",
              files: [
                { name: "files", accept: ["image/*", "image/png", "image/jpeg", "image/webp"] },
              ],
            },
          },
        },
      }),
    ],
  },
});
