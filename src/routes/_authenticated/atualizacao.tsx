import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import type { BundleInfo } from "@capgo/capacitor-updater";
import { CheckCircle2, Download, RefreshCw, RotateCcw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  APP_WEB_VERSION,
  checkForUpdate,
  downloadUpdate,
  getCurrentUpdateInfo,
  installUpdate,
  resetToBuiltin,
  type CurrentUpdateInfo,
  type UpdateManifest,
} from "@/lib/app-update";

export const Route = createFileRoute("/_authenticated/atualizacao")({
  component: AtualizacaoPage,
});

function AtualizacaoPage() {
  const [current, setCurrent] = useState<CurrentUpdateInfo | null>(null);
  const [manifest, setManifest] = useState<UpdateManifest | null>(null);
  const [compatible, setCompatible] = useState(true);
  const [checking, setChecking] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloaded, setDownloaded] = useState<BundleInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const verificar = useCallback(async (silencioso = false) => {
    if (!navigator.onLine) {
      if (!silencioso) toast.error("Conecte-se à internet para verificar atualizações");
      return;
    }
    setChecking(true);
    setError(null);
    try {
      const result = await checkForUpdate();
      setCurrent(result.current);
      setCompatible(result.compatible);
      setManifest(result.available || !result.compatible ? result.manifest : null);
      setDownloaded(null);
      if (!silencioso) {
        if (!result.compatible) toast.warning("Esta atualização exige uma nova versão do APK");
        else if (!result.available) toast.success("O aplicativo já está atualizado");
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Não foi possível verificar atualizações";
      setError(message);
      if (!silencioso) toast.error(message);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void getCurrentUpdateInfo()
      .then(setCurrent)
      .catch(() => undefined);
    void verificar(true);
  }, [verificar]);

  async function baixar() {
    if (!manifest) return;
    setDownloading(true);
    setProgress(0);
    setError(null);
    try {
      const bundle = await downloadUpdate(manifest, setProgress);
      setDownloaded(bundle);
      setProgress(100);
      toast.success("Atualização baixada e verificada");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Falha ao baixar atualização";
      setError(message);
      toast.error(message);
    } finally {
      setDownloading(false);
    }
  }

  async function instalar() {
    if (!downloaded) return;
    toast.info("Instalando atualização...");
    await installUpdate(downloaded);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Atualização do aplicativo</h1>
        <p className="text-xs text-muted-foreground">
          Baixe novas funções e correções diretamente pelo Frete Fácil PRO.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Versão instalada</div>
              <div className="text-2xl font-bold text-primary">
                {current?.webVersion ?? APP_WEB_VERSION}
              </div>
              <div className="text-xs text-muted-foreground">
                Base Android {current?.nativeVersion ?? "web"}
              </div>
            </div>
            <ShieldCheck className="h-8 w-8 text-emerald-600" />
          </div>
          <Button
            className="w-full"
            variant="outline"
            onClick={() => verificar()}
            disabled={checking}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${checking ? "animate-spin" : ""}`} />
            {checking ? "Verificando..." : "Verificar atualização"}
          </Button>
        </CardContent>
      </Card>

      {!current?.native ? (
        <Card>
          <CardContent className="space-y-3 p-4 text-sm">
            <p>A versão aberta no navegador é atualizada automaticamente pelo site.</p>
            <Button className="w-full" onClick={() => window.location.reload()}>
              Recarregar agora
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {manifest ? (
        <Card className={compatible ? "border-primary/40" : "border-amber-400/60"}>
          <CardContent className="space-y-3 p-4">
            <div>
              <div className="text-sm font-semibold">
                {compatible ? `Nova versão ${manifest.version}` : "Atualização nativa necessária"}
              </div>
              {!compatible ? (
                <p className="mt-1 text-xs text-amber-700">
                  Esta versão foi criada para a base Android {manifest.nativeVersion}. Será
                  necessário instalar um novo APK compatível.
                </p>
              ) : null}
            </div>
            {manifest.notes.length ? (
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {manifest.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            ) : null}
            {downloading ? (
              <div className="space-y-1">
                <Progress value={progress} />
                <p className="text-center text-xs text-muted-foreground">Baixando {progress}%</p>
              </div>
            ) : null}
            {compatible && !downloaded ? (
              <Button className="w-full" onClick={baixar} disabled={downloading}>
                <Download className="mr-2 h-4 w-4" />
                Baixar atualização ({formatBytes(manifest.size)})
              </Button>
            ) : null}
            {downloaded ? (
              <Button className="w-full" onClick={instalar}>
                <CheckCircle2 className="mr-2 h-4 w-4" /> Instalar e reiniciar
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {!manifest && !checking && !error ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          Nenhuma atualização pendente.
        </p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {current?.native && current.bundleId !== "builtin" ? (
        <Button variant="ghost" className="w-full" onClick={() => resetToBuiltin()}>
          <RotateCcw className="mr-2 h-4 w-4" /> Restaurar versão original do APK
        </Button>
      ) : null}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
