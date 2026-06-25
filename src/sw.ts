/// <reference lib="webworker" />
/* eslint-disable @typescript-eslint/no-explicit-any */
import { precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { NetworkFirst, CacheFirst } from "workbox-strategies";

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: any };

precacheAndRoute(self.__WB_MANIFEST || []);

// HTML navigations: prefer network, fall back to cache when offline.
registerRoute(
  ({ request, url }) =>
    request.mode === "navigate" &&
    !url.pathname.startsWith("/~oauth") &&
    !url.pathname.startsWith("/api/") &&
    !(url.pathname === "/share-target"),
  new NetworkFirst({ cacheName: "html", networkTimeoutSeconds: 3 }),
);

// Same-origin assets: cache first.
registerRoute(
  ({ url, request }) =>
    url.origin === self.location.origin &&
    !url.pathname.startsWith("/__share/") &&
    request.method === "GET",
  new CacheFirst({ cacheName: "assets" }),
);

self.addEventListener("install", () => {
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Android Share Target: accept POSTed images into a private cache,
// then redirect the launched window into the app at /?shared=1.
self.addEventListener("fetch", (event: FetchEvent) => {
  const url = new URL(event.request.url);
  if (event.request.method === "POST" && url.pathname === "/share-target") {
    event.respondWith(handleShareTarget(event.request));
  }
});

async function handleShareTarget(request: Request): Promise<Response> {
  try {
    const formData = await request.formData();
    const files: File[] = [];
    for (const v of formData.getAll("files")) if (v instanceof File) files.push(v);
    // Some browsers may send a single "file" field.
    for (const v of formData.getAll("file")) if (v instanceof File) files.push(v);
    const cache = await caches.open("share-inbox");
    const keys: string[] = [];
    for (const f of files) {
      if (!f.type.startsWith("image/")) continue;
      const id = crypto.randomUUID();
      const key = `/__share/${id}`;
      const buf = await f.arrayBuffer();
      await cache.put(
        key,
        new Response(buf, { headers: { "content-type": f.type || "image/jpeg" } }),
      );
      keys.push(key);
    }
    await cache.put(
      "/__share/index.json",
      new Response(JSON.stringify(keys), {
        headers: { "content-type": "application/json" },
      }),
    );
  } catch (e) {
    console.error("share-target failed", e);
  }
  return Response.redirect("/?shared=1", 303);
}
