const SW_URL = "/sw.js";

export async function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  // Apenas registra o Service Worker em produção
  if (!import.meta.env.PROD) return;

  try {
    const { Workbox } = await import("workbox-window");
    const wb = new Workbox(SW_URL, { scope: "/" });

    // Registra o Service Worker sem ouvintes de recarregamento forçado (window.location.reload).
    // Isso garante que o app seja cacheado para funcionar 100% offline, mas sem
    // nunca interromper a digitação ou a navegação do usuário com reloads surpresa.
    await wb.register({ immediate: true });
  } catch (err) {
    console.warn("[pwa] falha ao registrar service worker", err);
  }
}
