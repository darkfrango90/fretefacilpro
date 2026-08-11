import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, keepPreviousData, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-session";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Truck, MapPin, CheckCircle2, Loader2, RefreshCw, Undo2 } from "lucide-react";
import { SwipeToAction } from "@/components/swipe-to-action";
import { EntregaDetalheDialog } from "@/components/entrega-detalhe-dialog";
import { toast } from "sonner";
import { readOfflineCache, writeOfflineCache } from "@/lib/offline/cache";

export const Route = createFileRoute("/_authenticated/minhas-entregas")({
  component: MinhasEntregas,
});

// SELECT enxuto pra lista (sem fotos)
const SELECT_LIST =
  "id, numero, endereco, km_inicial, km_final, iniciada_em, finalizada_em, quantidade, valor_praticado, valor_frete, status, cliente:clientes(nome), material:materiais(nome, unidade), veiculo:veiculos(placa)";

function MinhasEntregas() {
  const { data: prof } = useProfile();
  const uid = prof?.profile.id;
  const [tab, setTab] = useState<"em_rota" | "entregue">("em_rota");
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const emRotaCacheKey = uid ? `entregas:em-rota:${uid}` : null;
  const entreguesCacheKey = uid ? `entregas:entregues:${uid}` : null;

  useEffect(() => {
    const atualizarListas = () => {
      queryClient.invalidateQueries({ queryKey: ["minhas-entregas"] });
      queryClient.invalidateQueries({ queryKey: ["entrega-detalhe"] });
      queryClient.invalidateQueries({ queryKey: ["pendentes"] });
    };

    window.addEventListener("offline-sync-finished", atualizarListas);
    window.addEventListener("offline-outbox-changed", atualizarListas);
    return () => {
      window.removeEventListener("offline-sync-finished", atualizarListas);
      window.removeEventListener("offline-outbox-changed", atualizarListas);
    };
  }, [queryClient]);

  const emRotaQ = useQuery({
    queryKey: ["minhas-entregas", "em_rota", uid],
    enabled: !!uid,
    staleTime: 15_000,
    refetchOnMount: "always",
    placeholderData: keepPreviousData,
    retry: false,
    networkMode: "offlineFirst",
    initialData: () => readOfflineCache<any[]>(emRotaCacheKey),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("entregas")
        .select(SELECT_LIST)
        .eq("status", "em_rota")
        .eq("motorista_entrega_id", uid)
        .order("iniciada_em", { ascending: true });
      if (error) throw error;
      const result = data ?? [];
      writeOfflineCache(emRotaCacheKey, result);
      return result;
    },
  });

  // Pré-carrega "entregues" em background — sem bloquear a tela
  const entreguesQ = useQuery({
    queryKey: ["minhas-entregas", "entregue", uid],
    enabled: !!uid,
    staleTime: 30_000,
    refetchOnMount: "always",
    placeholderData: keepPreviousData,
    retry: false,
    networkMode: "offlineFirst",
    initialData: () => readOfflineCache<any[]>(entreguesCacheKey),
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("entregas")
        .select(SELECT_LIST)
        .eq("status", "entregue")
        .or(
          `motorista_entrega_id.eq.${uid},motorista_venda_id.eq.${uid},and(motorista_venda_id.is.null,motorista_id.eq.${uid})`,
        )
        .order("finalizada_em", { ascending: false, nullsFirst: false })
        .limit(50);
      if (error) throw error;
      const result = data ?? [];
      writeOfflineCache(entreguesCacheKey, result);
      return result;
    },
  });

  async function voltarPendente(id: string) {
    const { data, error } = await supabase.functions.invoke("sync-entrega", {
      body: { action: "voltar_pendente", entrega_id: id },
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data?.erro) {
      toast.error(
        data.erro === "SEM_PERMISSAO" ? "Sem permissão para voltar esta entrega" : data.erro,
      );
      return;
    }
    toast.success("Entrega voltou para pendentes");
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["minhas-entregas"] }),
      queryClient.invalidateQueries({ queryKey: ["pendentes"] }),
    ]);
  }

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold flex items-center gap-2">
        <Truck className="h-5 w-5" /> Minhas entregas
      </h1>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="em_rota">
            Em rota {(emRotaQ.data?.length ?? 0) > 0 && `(${emRotaQ.data!.length})`}
          </TabsTrigger>
          <TabsTrigger value="entregue">Já entregues</TabsTrigger>
        </TabsList>

        <TabsContent value="em_rota" className="space-y-3 mt-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">
              Em rota de entrega
              <span className="block text-xs font-normal text-muted-foreground">
                Arraste um card para o lado para voltar para pendentes
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => emRotaQ.refetch()}
              disabled={emRotaQ.isFetching}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${emRotaQ.isFetching ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
          <ListaCards
            rows={emRotaQ.data}
            loading={emRotaQ.isLoading}
            fetching={emRotaQ.isFetching}
            empty="Você não tem entregas em andamento."
            onOpen={setDetalheId}
            mostrarFinalizar
            onVoltarPendente={voltarPendente}
          />
        </TabsContent>

        <TabsContent value="entregue" className="space-y-3 mt-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Já entregues</div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => entreguesQ.refetch()}
              disabled={entreguesQ.isFetching}
            >
              <RefreshCw
                className={`h-4 w-4 mr-1 ${entreguesQ.isFetching ? "animate-spin" : ""}`}
              />
              Atualizar
            </Button>
          </div>
          <ListaCards
            rows={entreguesQ.data}
            loading={entreguesQ.isLoading}
            fetching={entreguesQ.isFetching}
            empty="Nenhuma entrega finalizada ainda."
            onOpen={setDetalheId}
          />
        </TabsContent>
      </Tabs>

      <EntregaDetalheDialog id={detalheId} onClose={() => setDetalheId(null)} mostrarFinalizar />
    </div>
  );
}

function ListaCards({
  rows,
  loading,
  fetching,
  empty,
  onOpen,
  mostrarFinalizar,
  onVoltarPendente,
}: {
  rows?: any[];
  loading: boolean;
  fetching: boolean;
  empty: string;
  onOpen: (id: string) => void;
  mostrarFinalizar?: boolean;
  onVoltarPendente?: (id: string) => void | Promise<void>;
}) {
  if (loading && !rows) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
      </div>
    );
  }
  return (
    <>
      {fetching && rows && (
        <div className="flex items-center text-xs text-muted-foreground gap-1">
          <Loader2 className="h-3 w-3 animate-spin" /> Atualizando...
        </div>
      )}
      {(rows ?? []).map((r: any) => {
        const card = (
          <Card className="cursor-pointer active:opacity-70" onClick={() => onOpen(r.id)}>
            <CardContent className="p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium truncate flex items-center gap-1">
                    {r.status === "entregue" && (
                      <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                    )}
                    {r.numero != null && <span className="text-muted-foreground">#{r.numero}</span>}
                    {r.cliente?.nome ?? "—"}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {r.material?.nome} · {r.quantidade} {r.material?.unidade}
                    {r.veiculo?.placa ? ` · ${r.veiculo.placa}` : ""}
                  </div>
                </div>
                <div className="text-right text-xs text-muted-foreground whitespace-nowrap">
                  {r.status === "entregue" && r.finalizada_em
                    ? new Date(r.finalizada_em).toLocaleDateString("pt-BR")
                    : r.km_inicial != null
                      ? `KM ${r.km_inicial}`
                      : ""}
                </div>
              </div>
              {r.endereco && (
                <div className="text-xs text-muted-foreground flex items-start gap-1">
                  <MapPin className="h-3 w-3 mt-0.5 shrink-0" /> {r.endereco}
                </div>
              )}
              {mostrarFinalizar && (
                <div className="flex gap-2">
                  <Link
                    to="/entrega/$id/finalizar"
                    params={{ id: r.id }}
                    className="flex-1 block"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button size="sm" variant="action" className="w-full">
                      Finalizar entrega
                    </Button>
                  </Link>
                  {onVoltarPendente && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 text-amber-600 hover:bg-amber-500/10"
                      aria-label="Voltar para pendente"
                      onClick={(e) => {
                        e.stopPropagation();
                        onVoltarPendente(r.id);
                      }}
                    >
                      <Undo2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
        if (!onVoltarPendente) return <div key={r.id}>{card}</div>;
        return (
          <SwipeToAction
            key={r.id}
            actionLabel="Voltar p/ pendente"
            actionIcon={<Undo2 className="h-4 w-4" />}
            actionClassName="bg-amber-500 text-white"
            onAction={() => onVoltarPendente(r.id)}
          >
            {card}
          </SwipeToAction>
        );
      })}
      {!loading && (rows ?? []).length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">{empty}</p>
      )}
    </>
  );
}
