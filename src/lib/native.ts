import { Capacitor } from "@capacitor/core";

export const isNative = () => Capacitor.isNativePlatform();
export const nativePlatform = () => Capacitor.getPlatform(); // 'ios' | 'android' | 'web'

/**
 * Captura uma foto usando câmera nativa (Capacitor) quando disponível,
 * com fallback para <input type=file capture> no navegador.
 * Retorna um File pronto para upload ao Supabase Storage.
 */
export async function capturarFoto(): Promise<File | null> {
  if (isNative()) {
    const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");
    const photo = await Camera.getPhoto({
      quality: 75,
      allowEditing: false,
      resultType: CameraResultType.Base64,
      source: CameraSource.Camera,
      saveToGallery: false,
    });
    if (!photo.base64String) return null;
    const bin = atob(photo.base64String);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const ext = photo.format || "jpg";
    return new File([bytes], `foto-${Date.now()}.${ext}`, { type: `image/${ext}` });
  }
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.capture = "environment";
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
}

/**
 * Coordenadas atuais via GPS nativo (Capacitor) ou Web Geolocation API.
 */
export async function obterCoordenadas(): Promise<{ lat: number; lng: number } | null> {
  try {
    if (isNative()) {
      const { Geolocation } = await import("@capacitor/geolocation");
      const perm = await Geolocation.checkPermissions();
      if (perm.location !== "granted") {
        const req = await Geolocation.requestPermissions();
        if (req.location !== "granted") return null;
      }
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
      });
      return { lat: pos.coords.latitude, lng: pos.coords.longitude };
    }
    return await new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 10000 },
      );
    });
  } catch {
    return null;
  }
}
