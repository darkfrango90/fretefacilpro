import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { CapacitorUpdater, type BundleInfo } from "@capgo/capacitor-updater";

export const APP_WEB_VERSION = String(import.meta.env.VITE_APP_WEB_VERSION ?? "0.0.0");
export const UPDATE_MANIFEST_URL = "https://fretefacilpro.vercel.app/updates/latest.json";

export interface UpdateManifest {
  schema: 1;
  version: string;
  nativeVersion: string;
  required: boolean;
  notes: string[];
  file: string;
  checksum: string;
  size: number;
  publishedAt: string;
}

export interface CurrentUpdateInfo {
  webVersion: string;
  nativeVersion: string | null;
  bundleId: string;
  native: boolean;
}

export interface UpdateCheckResult {
  current: CurrentUpdateInfo;
  manifest: UpdateManifest;
  available: boolean;
  compatible: boolean;
}

function compareVersions(a: string, b: string): number {
  const left = a.split(".").map((part) => Number(part));
  const right = b.split(".").map((part) => Number(part));
  const size = Math.max(left.length, right.length);
  for (let index = 0; index < size; index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

function validarManifesto(value: unknown): UpdateManifest {
  const manifest = value as Partial<UpdateManifest>;
  if (
    manifest?.schema !== 1 ||
    typeof manifest.version !== "string" ||
    !/^\d+\.\d+\.\d+$/.test(manifest.version) ||
    typeof manifest.nativeVersion !== "string" ||
    !/^\d+\.\d+$/.test(manifest.nativeVersion) ||
    typeof manifest.file !== "string" ||
    !/^fretefacil-\d+\.\d+\.\d+\.zip$/.test(manifest.file) ||
    typeof manifest.checksum !== "string" ||
    !/^[a-f0-9]{64}$/i.test(manifest.checksum) ||
    typeof manifest.size !== "number" ||
    manifest.size <= 0
  ) {
    throw new Error("O servidor retornou um manifesto de atualização inválido");
  }
  return {
    schema: 1,
    version: manifest.version,
    nativeVersion: manifest.nativeVersion,
    required: manifest.required === true,
    notes: Array.isArray(manifest.notes) ? manifest.notes.map(String).slice(0, 20) : [],
    file: manifest.file,
    checksum: manifest.checksum,
    size: manifest.size,
    publishedAt: String(manifest.publishedAt ?? ""),
  };
}

export async function getCurrentUpdateInfo(): Promise<CurrentUpdateInfo> {
  if (!Capacitor.isNativePlatform()) {
    return {
      webVersion: APP_WEB_VERSION,
      nativeVersion: null,
      bundleId: "web",
      native: false,
    };
  }
  const current = await CapacitorUpdater.current();
  return {
    webVersion: current.bundle.version === "builtin" ? APP_WEB_VERSION : current.bundle.version,
    nativeVersion: current.native,
    bundleId: current.bundle.id,
    native: true,
  };
}

export async function checkForUpdate(): Promise<UpdateCheckResult> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15_000);
  try {
    const [response, current] = await Promise.all([
      fetch(`${UPDATE_MANIFEST_URL}?t=${Date.now()}`, {
        cache: "no-store",
        signal: controller.signal,
      }),
      getCurrentUpdateInfo(),
    ]);
    if (!response.ok) throw new Error(`Servidor de atualização indisponível (${response.status})`);
    const manifest = validarManifesto(await response.json());
    const compatible = !current.native || current.nativeVersion === manifest.nativeVersion;
    return {
      current,
      manifest,
      compatible,
      available: compatible && compareVersions(manifest.version, current.webVersion) > 0,
    };
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function downloadUpdate(
  manifest: UpdateManifest,
  onProgress?: (percent: number) => void,
): Promise<BundleInfo> {
  if (!Capacitor.isNativePlatform()) throw new Error("Download OTA disponível somente no app");
  let listener: PluginListenerHandle | undefined;
  try {
    listener = await CapacitorUpdater.addListener("download", ({ percent }) => {
      onProgress?.(Math.max(0, Math.min(100, Math.round(percent))));
    });
    const url = new URL(manifest.file, UPDATE_MANIFEST_URL).toString();
    return await CapacitorUpdater.download({
      url,
      version: manifest.version,
      checksum: manifest.checksum,
    });
  } finally {
    await listener?.remove();
  }
}

export async function installUpdate(bundle: BundleInfo): Promise<void> {
  await CapacitorUpdater.set({ id: bundle.id });
}

export async function resetToBuiltin(): Promise<void> {
  await CapacitorUpdater.reset({ toLastSuccessful: false });
}

export async function notifyUpdateReady(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await CapacitorUpdater.notifyAppReady();
  } catch (error) {
    console.error("Não foi possível confirmar o pacote OTA", error);
  }
}
