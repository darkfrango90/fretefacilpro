import { isNative } from "@/lib/native";

const SW_URL = "/sw.js";

export async function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  // No app nativo (Capacitor) os arquivos já estão embutidos no APK — um
  // service worker só atrapalha: após atualizar o app, o SW/cache antigos
  // persistem no WebView e continuam servindo a versão anterior. Além de não
  // registrar, remove qualquer SW/cache deixado por versões antigas do APK.
  if (isNative()) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch (err) {
      console.warn("[pwa] falha ao limpar service worker no app nativo", err);
    }
    return;
  }

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
