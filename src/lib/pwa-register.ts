// Guarded service-worker registration. Only registers in real production builds
// — never in dev, iframe previews, or Lovable preview hosts.
export function registerPwa() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  const url = new URL(window.location.href);
  const host = window.location.hostname;
  const inIframe = (() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  })();

  const blockedHost =
    host.startsWith("id-preview--") ||
    host.startsWith("preview--") ||
    host === "lovableproject.com" ||
    host.endsWith(".lovableproject.com") ||
    host === "lovableproject-dev.com" ||
    host.endsWith(".lovableproject-dev.com") ||
    host === "beta.lovable.dev" ||
    host.endsWith(".beta.lovable.dev");

  const killSwitch = url.searchParams.get("sw") === "off";
  const refused = !import.meta.env.PROD || inIframe || blockedHost || killSwitch;

  if (refused) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => {
        if (r.active?.scriptURL.endsWith("/sw.js")) r.unregister();
      });
    });
    return;
  }

  navigator.serviceWorker.register("/sw.js").catch(() => {});
}
