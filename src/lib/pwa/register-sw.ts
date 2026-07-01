// Service Worker desativado — o sw.js não é servido pelo Vercel (404).
// Cancelamos qualquer SW antigo para evitar que ele recarregue a página
// no meio da digitação ou sirva conteúdo desatualizado do cache.

export async function registerServiceWorker() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
  } catch {
    // silencioso
  }
}
