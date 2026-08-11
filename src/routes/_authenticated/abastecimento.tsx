import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Camera, Clock, Fuel, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { capturarFoto } from "@/lib/native";
import { enqueue, fileToPhoto, pendingByType } from "@/lib/offline/queue";
import { syncNow } from "@/lib/offline/sync";
import { readOfflineCache, writeOfflineCache } from "@/lib/offline/cache";
import type { OutboxItem } from "@/lib/offline/db";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export const Route = createFileRoute("/_authenticated/abastecimento")({
  component: Page,
});

function Page() {
  const { data: prof } = useProfile();
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [veiculoId, setVeiculoId] = useState("");
  const [litros, setLitros] = useState("");
  const [valor, setValor] = useState("");
  const [km, setKm] = useState("");
  const [obs, setObs] = useState("");
  const [foto, setFoto] = useState<File | null>(null);

  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrUsado, setOcrUsado] = useState(false);
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const empresaId = prof?.profile.empresa_id;
  const userId = prof?.profile.id;
  const veiculosCacheKey = empresaId ? `veiculos:ativos:${empresaId}` : null;
  const abastecimentosCacheKey =
    empresaId && userId ? `abastecimentos:meus:${empresaId}:${userId}` : null;
  const { data: veiculos } = useQuery({
    queryKey: ["veiculos-list", empresaId],
    enabled: !!empresaId,
    retry: false,
    networkMode: "offlineFirst",
    initialData: () => readOfflineCache<any[]>(veiculosCacheKey),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("veiculos")
        .select("id, placa")
        .eq("ativo", true)
        .order("placa");
      if (error) throw error;
      const result = data ?? [];
      writeOfflineCache(veiculosCacheKey, result);
      return result;
    },
  });

  const abastecimentosQuery = useQuery({
    queryKey: ["abastecimentos", "meus", empresaId, userId],
    enabled: !!empresaId && !!userId,
    retry: false,
    networkMode: "offlineFirst",
    initialData: () => readOfflineCache<any[]>(abastecimentosCacheKey),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("abastecimentos")
        .select(
          "id, data_hora, litros, valor_total, km_atual, observacoes, veiculo:veiculos(placa)",
        )
        .eq("motorista_id", userId)
        .order("data_hora", { ascending: false })
        .limit(30);
      if (error) throw error;
      const result = data ?? [];
      writeOfflineCache(abastecimentosCacheKey, result);
      return result;
    },
  });

  const [pendentes, setPendentes] = useState<OutboxItem[]>([]);
  useEffect(() => {
    let alive = true;
    const atualizar = async () => {
      if (!userId || !empresaId) {
        if (alive) setPendentes([]);
        return;
      }
      const locais = await pendingByType("abastecimento", userId, empresaId);
      if (alive) setPendentes(locais);
      if (typeof navigator !== "undefined" && navigator.onLine) {
        void queryClient.invalidateQueries({
          queryKey: ["abastecimentos", "meus", empresaId, userId],
        });
      }
    };
    void atualizar();
    window.addEventListener("offline-outbox-changed", atualizar);
    window.addEventListener("offline-sync-finished", atualizar);
    return () => {
      alive = false;
      window.removeEventListener("offline-outbox-changed", atualizar);
      window.removeEventListener("offline-sync-finished", atualizar);
    };
  }, [empresaId, queryClient, userId]);

  if (!prof) return null;
  const profile = prof.profile;

  async function rodarOCR(arquivo: File) {
    if (!arquivo) return;
    if (!navigator.onLine) {
      toast.info("Sem conexão. Preencha litros e valor manualmente.");
      return;
    }
    setOcrLoading(true);
    try {
      const dataUrl = await fileToBase64(arquivo);
      const { data, error } = await supabase.functions.invoke("ocr-abastecimento", {
        body: { imagem_base64: dataUrl, mime_type: arquivo.type || "image/jpeg" },
      });
      if (error || (data as any)?.erro) {
        toast.error((data as any)?.erro || error?.message || "Falha na leitura");
        return;
      }
      const r = data as { litros: number | null; valor_total: number | null };
      if (r.litros != null) setLitros(String(r.litros));
      if (r.valor_total != null) setValor(String(r.valor_total));
      setOcrUsado(true);
      if (r.litros == null && r.valor_total == null) {
        toast.warning("Não consegui ler. Preencha manualmente.");
      } else {
        toast.success("Cupom lido pela IA — confira os valores");
      }
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao ler cupom");
    } finally {
      setOcrLoading(false);
    }
  }

  function onPickFoto(f: File | null) {
    setFoto(f);
    setOcrUsado(false);
    if (f && navigator.onLine) {
      void rodarOCR(f);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!veiculoId) return toast.error("Selecione o veículo");
    if (!km) return toast.error("Informe o KM atual");
    setSubmitting(true);
    try {
      const id = crypto.randomUUID();
      const payload: any = {
        empresa_id: profile.empresa_id,
        motorista_id: profile.id,
        veiculo_id: veiculoId,
        litros: litros ? Number(litros) : null,
        valor_total: valor ? Number(valor) : null,
        km_atual: Number(km),
        observacoes: obs || null,
      };
      const photos = foto ? [await fileToPhoto("foto_url", "abastecimentos", foto)] : [];
      await enqueue({
        id,
        type: "abastecimento",
        empresa_id: profile.empresa_id,
        motorista_id: profile.id,
        payload,
        photos,
      });
      if (typeof navigator !== "undefined" && navigator.onLine) {
        toast.success("Abastecimento registrado! Sincronizando...");
        void syncNow({ silent: true });
      } else {
        toast.success("Abastecimento salvo offline. Será enviado quando houver conexão.");
      }
      setVeiculoId("");
      setLitros("");
      setValor("");
      setKm("");
      setObs("");
      setFoto(null);
      setOcrUsado(false);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 pb-6">
      <h1 className="text-xl font-bold">Abastecimento</h1>

      <Card>
        <CardContent className="p-3 space-y-3">
          <div>
            <Label>Veículo *</Label>
            <Select value={veiculoId} onValueChange={setVeiculoId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {(veiculos ?? []).map((v: any) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.placa}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="flex items-center gap-1">
              <Camera className="h-4 w-4" /> Foto do cupom *
            </Label>
            <div className="flex items-center gap-2 mt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    const f = await capturarFoto();
                    if (f) onPickFoto(f);
                  } catch (e: any) {
                    toast.error(
                      e?.message ?? "Não foi possível acessar a câmera. Verifique as permissões.",
                    );
                  }
                }}
              >
                <Camera className="h-4 w-4 mr-1" />
                {foto ? "Trocar foto" : "Tirar foto"}
              </Button>
              {foto && <span className="text-xs text-muted-foreground truncate">{foto.name}</span>}
            </div>
            {foto && (
              <div className="mt-2 flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={ocrLoading || !online}
                  onClick={() => foto && rodarOCR(foto)}
                >
                  {ocrLoading ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Lendo cupom…
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3 w-3 mr-1" /> Ler cupom com IA
                    </>
                  )}
                </Button>
                {!online && (
                  <span className="text-xs text-muted-foreground">
                    Offline — preencha manualmente
                  </span>
                )}
              </div>
            )}
            {ocrUsado && (
              <p className="text-xs text-amber-600 mt-1">
                Valores preenchidos pela IA, confira antes de salvar.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Litros</Label>
              <Input
                type="number"
                step="0.001"
                value={litros}
                onChange={(e) => setLitros(e.target.value)}
                inputMode="decimal"
              />
            </div>
            <div>
              <Label>Valor total (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                inputMode="decimal"
              />
            </div>
          </div>
          <div>
            <Label>KM atual *</Label>
            <Input
              type="number"
              value={km}
              onChange={(e) => setKm(e.target.value)}
              inputMode="numeric"
              required
            />
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} />
          </div>
        </CardContent>
      </Card>

      <Button type="submit" size="lg" className="w-full" disabled={submitting}>
        {submitting ? "Salvando..." : "Registrar abastecimento"}
      </Button>

      <section className="space-y-2 pt-2" aria-labelledby="meus-abastecimentos-title">
        <div className="flex items-center justify-between gap-2">
          <h2 id="meus-abastecimentos-title" className="flex items-center gap-2 font-semibold">
            <Fuel className="h-4 w-4" /> Meus abastecimentos
          </h2>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => abastecimentosQuery.refetch()}
            disabled={abastecimentosQuery.isFetching}
          >
            <RefreshCw
              className={`mr-1 h-4 w-4 ${abastecimentosQuery.isFetching ? "animate-spin" : ""}`}
            />
            Atualizar
          </Button>
        </div>

        {pendentes.map((item) => (
          <Card key={item.id} className="border-amber-300/60">
            <CardContent className="space-y-1 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">
                  {(veiculos ?? []).find((v: any) => v.id === item.payload.veiculo_id)?.placa ??
                    "Veículo"}
                </span>
                <span className="flex items-center gap-1 text-xs text-amber-600">
                  <Clock className="h-3 w-3" /> aguardando sincronização
                </span>
              </div>
              <div className="text-sm">
                {item.payload.litros != null ? `${Number(item.payload.litros).toFixed(3)} L` : "—"}
                {item.payload.valor_total != null
                  ? ` · R$ ${Number(item.payload.valor_total).toFixed(2)}`
                  : ""}
              </div>
              <div className="text-xs text-muted-foreground">
                KM {item.payload.km_atual} · {new Date(item.created_at).toLocaleString("pt-BR")}
              </div>
            </CardContent>
          </Card>
        ))}

        {abastecimentosQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando abastecimentos...</p>
        ) : null}

        {(abastecimentosQuery.data ?? []).map((item: any) => (
          <Card key={item.id}>
            <CardContent className="space-y-1 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{item.veiculo?.placa ?? "Veículo"}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(item.data_hora).toLocaleString("pt-BR")}
                </span>
              </div>
              <div className="text-sm">
                {item.litros != null ? `${Number(item.litros).toFixed(3)} L` : "—"}
                {item.valor_total != null ? ` · R$ ${Number(item.valor_total).toFixed(2)}` : ""}
              </div>
              <div className="text-xs text-muted-foreground">KM {item.km_atual}</div>
              {item.observacoes ? <p className="text-xs">{item.observacoes}</p> : null}
            </CardContent>
          </Card>
        ))}

        {!abastecimentosQuery.isLoading &&
        pendentes.length === 0 &&
        (abastecimentosQuery.data?.length ?? 0) === 0 ? (
          <p className="py-5 text-center text-sm text-muted-foreground">
            Nenhum abastecimento cadastrado por você.
          </p>
        ) : null}
      </section>
    </form>
  );
}
