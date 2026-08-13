import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Droplet, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoneyInput } from "@/components/money-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useProfile } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import { formatarMoeda } from "@/lib/moeda";
import { enqueue, pendingByType } from "@/lib/offline/queue";
import { syncNow } from "@/lib/offline/sync";
import type { OutboxItem } from "@/lib/offline/db";
import { readOfflineCache, writeOfflineCache } from "@/lib/offline/cache";
import { formatarQuilometragem, parseQuilometragem } from "@/lib/quilometragem";

export const Route = createFileRoute("/_authenticated/trocas-oleo")({
  component: TrocasOleoPage,
});

function hojeISO() {
  const data = new Date();
  return new Date(data.getTime() - data.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function TrocasOleoPage() {
  const { data: prof } = useProfile();
  const queryClient = useQueryClient();
  const empresaId = prof?.profile.empresa_id;
  const userId = prof?.profile.id;
  const isAdmin = !!prof?.roles.includes("admin") || !!prof?.roles.includes("master");
  const [veiculoId, setVeiculoId] = useState("");
  const [data, setData] = useState(hojeISO());
  const [valor, setValor] = useState("");
  const [km, setKm] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [pendentes, setPendentes] = useState<OutboxItem[]>([]);
  const veiculosCacheKey = empresaId ? `veiculos:ativos:${empresaId}` : null;
  const historicoCacheKey =
    empresaId && userId
      ? `trocas-oleo:${isAdmin ? "empresa" : "meus"}:${empresaId}:${userId}`
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

  const historico = useQuery({
    queryKey: ["trocas-oleo", empresaId, isAdmin ? "empresa" : userId],
    enabled: !!empresaId && !!userId,
    retry: false,
    networkMode: "offlineFirst",
    initialData: () => readOfflineCache<any[]>(historicoCacheKey),
    queryFn: async () => {
      let query = (supabase as any)
        .from("trocas_oleo")
        .select(
          "id, motorista_id, veiculo_id, data, valor, km, observacoes, veiculo:veiculos(placa)",
        )
        .order("data", { ascending: false })
        .limit(50);
      if (!isAdmin) query = query.eq("motorista_id", userId);
      const { data, error } = await query;
      if (error) throw error;
      const result = data ?? [];
      writeOfflineCache(historicoCacheKey, result);
      return result;
    },
  });

  const { data: motoristas } = useQuery({
    queryKey: ["motoristas-trocas-oleo", empresaId],
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

  useEffect(() => {
    let ativo = true;
    const atualizar = async () => {
      if (!userId || !empresaId) return;
      const itens = await pendingByType("troca_oleo", userId, empresaId);
      if (ativo) setPendentes(itens);
      if (navigator.onLine) {
        void queryClient.invalidateQueries({ queryKey: ["trocas-oleo", empresaId] });
      }
    };
    void atualizar();
    window.addEventListener("offline-outbox-changed", atualizar);
    window.addEventListener("offline-sync-finished", atualizar);
    return () => {
      ativo = false;
      window.removeEventListener("offline-outbox-changed", atualizar);
      window.removeEventListener("offline-sync-finished", atualizar);
    };
  }, [empresaId, queryClient, userId]);

  if (!prof) return null;
  const profile = prof.profile;

  async function salvar(event: React.FormEvent) {
    event.preventDefault();
    const kmNumerico = parseQuilometragem(km);
    const valorNumerico = Number(valor);
    if (!veiculoId) return toast.error("Selecione o veículo");
    if (!data) return toast.error("Informe a data");
    if (kmNumerico == null || kmNumerico <= 0) return toast.error("Informe um KM válido");
    if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) {
      return toast.error("Informe um valor válido");
    }

    setSalvando(true);
    try {
      const id = crypto.randomUUID();
      await enqueue({
        id,
        type: "troca_oleo",
        empresa_id: profile.empresa_id,
        motorista_id: profile.id,
        payload: {
          empresa_id: profile.empresa_id,
          motorista_id: profile.id,
          veiculo_id: veiculoId,
          data,
          valor: valorNumerico,
          km: kmNumerico,
          observacoes: observacoes.trim() || null,
        },
        photos: [],
      });
      setVeiculoId("");
      setValor("");
      setKm("");
      setObservacoes("");
      setData(hojeISO());
      if (navigator.onLine) {
        toast.success("Troca de óleo registrada! Sincronizando...");
        void syncNow({ silent: true });
      } else {
        toast.success("Troca de óleo salva offline.");
      }
    } catch (error: any) {
      toast.error(error.message ?? "Erro ao registrar troca de óleo");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-4 pb-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <Droplet className="h-5 w-5" /> Troca de óleo
        </h1>
        <p className="text-sm text-muted-foreground">
          Registre a manutenção para preparar os futuros avisos por quilometragem.
        </p>
      </div>

      <form onSubmit={salvar} className="space-y-4">
        <Card>
          <CardContent className="space-y-3 p-3">
            <div>
              <Label>Veículo *</Label>
              <Select value={veiculoId} onValueChange={setVeiculoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data *</Label>
                <Input
                  type="date"
                  value={data}
                  onChange={(event) => setData(event.target.value)}
                  required
                />
              </div>
              <div>
                <Label>Valor *</Label>
                <MoneyInput value={valor} onValueChange={setValor} required />
              </div>
            </div>
            <div>
              <Label>KM da troca *</Label>
              <Input
                value={km}
                inputMode="decimal"
                placeholder="Ex.: 547.141,7"
                onChange={(event) => setKm(event.target.value)}
                onBlur={() => {
                  const valorKm = parseQuilometragem(km);
                  if (valorKm != null) setKm(formatarQuilometragem(valorKm));
                }}
                required
              />
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea
                value={observacoes}
                onChange={(event) => setObservacoes(event.target.value)}
                rows={2}
              />
            </div>
          </CardContent>
        </Card>
        <Button type="submit" size="lg" className="w-full" disabled={salvando}>
          {salvando ? "Salvando..." : "Registrar troca de óleo"}
        </Button>
      </form>

      <section className="space-y-2 pt-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">{isAdmin ? "Trocas da empresa" : "Minhas trocas"}</h2>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => historico.refetch()}
            disabled={historico.isFetching}
          >
            <RefreshCw className={`mr-1 h-4 w-4 ${historico.isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        {pendentes.map((item) => (
          <Card key={item.id} className="border-amber-300/60">
            <CardContent className="p-3 text-sm">
              <div className="font-medium">
                {(veiculos ?? []).find((veiculo: any) => veiculo.id === item.payload.veiculo_id)
                  ?.placa ?? "Veículo"}
              </div>
              <div>
                {formatarMoeda(item.payload.valor)} · KM {formatarQuilometragem(item.payload.km)}
              </div>
              <div className="text-xs text-amber-600">Aguardando sincronização</div>
            </CardContent>
          </Card>
        ))}

        {(historico.data ?? []).map((item: any) => (
          <Card key={item.id}>
            <CardContent className="space-y-1 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{item.veiculo?.placa ?? "Veículo"}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(`${item.data}T12:00:00`).toLocaleDateString("pt-BR")}
                </span>
              </div>
              {isAdmin ? (
                <div className="text-xs text-muted-foreground">
                  Motorista:{" "}
                  {motoristas?.find((motorista: any) => motorista.id === item.motorista_id)?.nome ??
                    "Não identificado"}
                </div>
              ) : null}
              <div className="text-sm">
                {formatarMoeda(item.valor)} · KM {formatarQuilometragem(item.km)}
              </div>
              {item.observacoes ? <p className="text-xs">{item.observacoes}</p> : null}
            </CardContent>
          </Card>
        ))}

        {!historico.isLoading && pendentes.length === 0 && (historico.data?.length ?? 0) === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhuma troca de óleo registrada.
          </p>
        ) : null}
      </section>
    </div>
  );
}
