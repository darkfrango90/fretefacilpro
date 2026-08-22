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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Camera, Clock, Fuel, Loader2, Pencil, RefreshCw, Sparkles } from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { capturarFoto } from "@/lib/native";
import { enqueue, fileToPhoto, pendingByType } from "@/lib/offline/queue";
import { syncNow } from "@/lib/offline/sync";
import { readOfflineCache, writeOfflineCache } from "@/lib/offline/cache";
import type { OutboxItem } from "@/lib/offline/db";
import { formatarQuilometragem, parseQuilometragem } from "@/lib/quilometragem";
import { MoneyInput } from "@/components/money-input";
import { formatarMoeda } from "@/lib/moeda";

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
  const isAdmin = !!prof?.roles.includes("admin") || !!prof?.roles.includes("master");
  const veiculosCacheKey = empresaId ? `veiculos:ativos:${empresaId}` : null;
  const abastecimentosCacheKey =
    empresaId && userId
      ? `abastecimentos:${isAdmin ? "empresa" : "meus"}:${empresaId}:${userId}`
      : null;
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
    queryKey: ["abastecimentos", isAdmin ? "empresa" : "meus", empresaId, userId],
    enabled: !!empresaId && !!userId,
    retry: false,
    networkMode: "offlineFirst",
    initialData: () => readOfflineCache<any[]>(abastecimentosCacheKey),
    queryFn: async () => {
      let query = (supabase as any)
        .from("abastecimentos")
        .select(
          "id, motorista_id, veiculo_id, data_hora, litros, valor_total, km_atual, observacoes, veiculo:veiculos(placa)",
        )
        .order("data_hora", { ascending: false })
        .limit(30);
      if (!isAdmin) query = query.eq("motorista_id", userId);
      const { data, error } = await query;
      if (error) throw error;
      const result = data ?? [];
      writeOfflineCache(abastecimentosCacheKey, result);
      return result;
    },
  });

  const { data: motoristas } = useQuery({
    queryKey: ["motoristas-abastecimentos", empresaId],
    enabled: !!empresaId && isAdmin,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("profiles")
        .select("id, nome")
        .eq("empresa_id", empresaId)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const [editando, setEditando] = useState<any | null>(null);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);

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
          queryKey: ["abastecimentos", isAdmin ? "empresa" : "meus", empresaId, userId],
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
  }, [empresaId, isAdmin, queryClient, userId]);

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
    const kmAtual = parseQuilometragem(km);
    if (kmAtual == null || kmAtual <= 0) {
      return toast.error("Informe uma quilometragem válida");
    }
    setSubmitting(true);
    try {
      const id = crypto.randomUUID();
      const payload: any = {
        empresa_id: profile.empresa_id,
        motorista_id: profile.id,
        veiculo_id: veiculoId,
        litros: litros ? Number(litros) : null,
        valor_total: valor ? Number(valor) : null,
        km_atual: kmAtual,
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

  async function salvarEdicao() {
    if (!editando || !isAdmin) return;
    if (!editando.data_hora) return toast.error("Informe a data e hora");
    const kmAtual = parseQuilometragem(editando.km_atual);
    const litrosAtual = editando.litros === "" ? null : Number(editando.litros);
    const valorAtual = editando.valor_total === "" ? null : Number(editando.valor_total);
    if (kmAtual == null || kmAtual <= 0) return toast.error("Informe um KM válido");
    if (litrosAtual != null && (!Number.isFinite(litrosAtual) || litrosAtual < 0)) {
      return toast.error("Informe uma quantidade de litros válida");
    }
    if (valorAtual != null && (!Number.isFinite(valorAtual) || valorAtual < 0)) {
      return toast.error("Informe um valor válido");
    }
    setSalvandoEdicao(true);
    try {
      const { error } = await (supabase as any)
        .from("abastecimentos")
        .update({
          veiculo_id: editando.veiculo_id,
          data_hora: new Date(editando.data_hora).toISOString(),
          litros: litrosAtual,
          valor_total: valorAtual,
          km_atual: kmAtual,
          observacoes: editando.observacoes.trim() || null,
        })
        .eq("id", editando.id)
        .eq("empresa_id", profile.empresa_id);
      if (error) throw error;
      toast.success("Abastecimento atualizado");
      setEditando(null);
      await abastecimentosQuery.refetch();
    } catch (error: any) {
      toast.error(error.message ?? "Erro ao editar abastecimento");
    } finally {
      setSalvandoEdicao(false);
    }
  }

  return (
    <div className="space-y-4 pb-6">
      <h1 className="text-xl font-bold">Abastecimento</h1>
      <form onSubmit={onSubmit} className="space-y-4">
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
                {foto && (
                  <span className="text-xs text-muted-foreground truncate">{foto.name}</span>
                )}
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
                <MoneyInput value={valor} onValueChange={setValor} />
              </div>
            </div>
            <div>
              <Label>KM atual *</Label>
              <Input
                type="text"
                value={km}
                onChange={(e) => setKm(e.target.value)}
                onBlur={() => {
                  const valor = parseQuilometragem(km);
                  if (valor != null) setKm(formatarQuilometragem(valor));
                }}
                inputMode="decimal"
                placeholder="Ex.: 547.141,7"
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
      </form>

      <section className="space-y-2 pt-2" aria-labelledby="meus-abastecimentos-title">
        <div className="flex items-center justify-between gap-2">
          <h2 id="meus-abastecimentos-title" className="flex items-center gap-2 font-semibold">
            <Fuel className="h-4 w-4" />{" "}
            {isAdmin ? "Abastecimentos da empresa" : "Meus abastecimentos"}
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
                  ? ` · ${formatarMoeda(item.payload.valor_total)}`
                  : ""}
              </div>
              <div className="text-xs text-muted-foreground">
                KM {formatarQuilometragem(item.payload.km_atual)} ·{" "}
                {new Date(item.created_at).toLocaleString("pt-BR")}
              </div>
            </CardContent>
          </Card>
        ))}

        {abastecimentosQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando abastecimentos...</p>
        ) : null}

        <div className="space-y-2 md:hidden">
          {(abastecimentosQuery.data ?? []).map((item: any) => (
            <Card key={item.id}>
              <CardContent className="space-y-1 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{item.veiculo?.placa ?? "Veículo"}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(item.data_hora).toLocaleString("pt-BR")}
                  </span>
                </div>
                {isAdmin ? (
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>
                      Motorista:{" "}
                      {motoristas?.find((m: any) => m.id === item.motorista_id)?.nome ??
                        "Não identificado"}
                    </span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      aria-label="Editar abastecimento"
                      onClick={() =>
                        setEditando({
                          ...item,
                          litros: item.litros == null ? "" : String(item.litros),
                          valor_total: item.valor_total == null ? "" : String(item.valor_total),
                          km_atual: String(item.km_atual),
                          data_hora: new Date(item.data_hora).toISOString().slice(0, 16),
                          observacoes: item.observacoes ?? "",
                        })
                      }
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                ) : null}
                <div className="text-sm">
                  {item.litros != null ? `${Number(item.litros).toFixed(3)} L` : "—"}
                  {item.valor_total != null ? ` · ${formatarMoeda(item.valor_total)}` : ""}
                </div>
                <div className="text-xs text-muted-foreground">
                  KM {formatarQuilometragem(item.km_atual)}
                </div>
                {item.observacoes ? <p className="text-xs">{item.observacoes}</p> : null}
              </CardContent>
            </Card>
          ))}
        </div>

        {(abastecimentosQuery.data?.length ?? 0) > 0 && (
          <Card className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Veículo</TableHead>
                  {isAdmin && <TableHead>Motorista</TableHead>}
                  <TableHead>Data/hora</TableHead>
                  <TableHead>Litros</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>KM</TableHead>
                  <TableHead>Observações</TableHead>
                  {isAdmin && <TableHead className="w-14 text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(abastecimentosQuery.data ?? []).map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.veiculo?.placa ?? "—"}</TableCell>
                    {isAdmin && (
                      <TableCell className="text-muted-foreground">
                        {motoristas?.find((m: any) => m.id === item.motorista_id)?.nome ??
                          "Não identificado"}
                      </TableCell>
                    )}
                    <TableCell className="text-muted-foreground">
                      {new Date(item.data_hora).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell>
                      {item.litros != null ? `${Number(item.litros).toFixed(3)} L` : "—"}
                    </TableCell>
                    <TableCell>
                      {item.valor_total != null ? formatarMoeda(item.valor_total) : "—"}
                    </TableCell>
                    <TableCell>{formatarQuilometragem(item.km_atual)}</TableCell>
                    <TableCell className="max-w-56 truncate text-muted-foreground">
                      {item.observacoes || "—"}
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          aria-label="Editar abastecimento"
                          onClick={() =>
                            setEditando({
                              ...item,
                              litros: item.litros == null ? "" : String(item.litros),
                              valor_total:
                                item.valor_total == null ? "" : String(item.valor_total),
                              km_atual: String(item.km_atual),
                              data_hora: new Date(item.data_hora).toISOString().slice(0, 16),
                              observacoes: item.observacoes ?? "",
                            })
                          }
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}

        {!abastecimentosQuery.isLoading &&
        pendentes.length === 0 &&
        (abastecimentosQuery.data?.length ?? 0) === 0 ? (
          <p className="py-5 text-center text-sm text-muted-foreground">
            {isAdmin
              ? "Nenhum abastecimento cadastrado na empresa."
              : "Nenhum abastecimento cadastrado por você."}
          </p>
        ) : null}
      </section>
      <Dialog open={!!editando} onOpenChange={(open) => !open && setEditando(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar abastecimento</DialogTitle>
            <DialogDescription>
              Corrija as informações registradas pelo motorista.
            </DialogDescription>
          </DialogHeader>
          {editando ? (
            <div className="space-y-3">
              <div>
                <Label>Veículo</Label>
                <Select
                  value={editando.veiculo_id}
                  onValueChange={(value) => setEditando({ ...editando, veiculo_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(veiculos ?? []).map((veiculo: any) => (
                      <SelectItem key={veiculo.id} value={veiculo.id}>
                        {veiculo.placa}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Data e hora</Label>
                <Input
                  type="datetime-local"
                  value={editando.data_hora}
                  onChange={(event) => setEditando({ ...editando, data_hora: event.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Litros</Label>
                  <Input
                    type="number"
                    step="0.001"
                    inputMode="decimal"
                    value={editando.litros}
                    onChange={(event) => setEditando({ ...editando, litros: event.target.value })}
                  />
                </div>
                <div>
                  <Label>Valor total</Label>
                  <MoneyInput
                    value={editando.valor_total}
                    onValueChange={(value) => setEditando({ ...editando, valor_total: value })}
                  />
                </div>
              </div>
              <div>
                <Label>KM atual</Label>
                <Input
                  value={editando.km_atual}
                  inputMode="decimal"
                  onChange={(event) => setEditando({ ...editando, km_atual: event.target.value })}
                />
              </div>
              <div>
                <Label>Observações</Label>
                <Textarea
                  rows={2}
                  value={editando.observacoes}
                  onChange={(event) =>
                    setEditando({ ...editando, observacoes: event.target.value })
                  }
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setEditando(null)}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant="action"
                  className="flex-1"
                  onClick={salvarEdicao}
                  disabled={salvandoEdicao}
                >
                  {salvandoEdicao ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
