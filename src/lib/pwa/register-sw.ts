// Guarded service worker registration.
// - Never registers in dev, in Lovable preview, inside an iframe, or with ?sw=off
// - In refused contexts, actively unregisters any matching SW so stale workers don't survive
// - Surfaces an "atualização disponível" toast when a new SW takes over



const SW_URL = "/sw.js";
const LAST_RELOAD_KEY = "pwa:last_sw_reload";
const RELOAD_THROTTLE_MS = 60_000;

function shouldRefuse(): boolean {
  if (typeof window === "undefined") return true;
  if (!("serviceWorker" in navigator)) return true;
  if (!import.meta.env.PROD) return true;
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  const host = window.location.hostname;
  if (host.startsWith("id-preview--") || host.startsWith("preview--")) return true;
  if (host === "lovableproject.com" || host.endsWith(".lovableproject.com")) return true;
  if (host === "lovableproject-dev.com" || host.endsWith(".lovableproject-dev.com")) return true;
  if (host === "beta.lovable.dev" || host.endsWith(".beta.lovable.dev")) return true;
  if (new URLSearchParams(window.location.search).get("sw") === "off") return true;
  return false;
}

async function unregisterMatching() {
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      regs
        .filter((r) => {
          const url = r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || "";
          return url.endsWith(SW_URL);
        })
        .map((r) => r.unregister()),
    );
  } catch {}
}

let registered = false;

export async function registerServiceWorker() {
  if (registered) return;
  registered = true;

  if (shouldRefuse()) {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      void unregisterMatching();
    }
    return;
  }

  try {
    const { Workbox } = await import("workbox-window");
    const hadController = !!navigator.serviceWorker.controller;
    const wb = new Workbox(SW_URL, { scope: "/" });

    // Com skipWaiting+clientsClaim, o novo SW assume controle automaticamente.
    // Quando isso acontece numa aba já carregada, recarrega para evitar mistura
    // de bundle antigo (em memória) com assets novos (do cache novo) — causa
    // raiz de mismatches de hidratação após deploy.
    let refreshing = false;
    wb.addEventListener("controlling", () => {
      // Na primeira instalação o SW pode assumir controle da aba logo após a
      // tela de login aparecer. Recarregar nesse momento derruba a digitação.
      if (!hadController) return;
      if (refreshing) return;
      const now = Date.now();
      const lastReload = Number(localStorage.getItem(LAST_RELOAD_KEY) || 0);
      if (now - lastReload < RELOAD_THROTTLE_MS) return;
      localStorage.setItem(LAST_RELOAD_KEY, String(now));
      refreshing = true;
      window.location.reload();
    });

    await wb.register({ immediate: true });
  } catch (err) {
    // Silencioso — falha no registro não deve quebrar o app.
    console.warn("[pwa] falha ao registrar service worker", err);
  }
}
