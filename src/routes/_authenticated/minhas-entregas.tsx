import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, keepPreviousData, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-session";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Truck, MapPin, CheckCircle2, Loader2, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/minhas-entregas")({
  component: MinhasEntregas,
});

// SELECT enxuto pra lista (sem fotos)
const SELECT_LIST =
  "id, numero, endereco, km_inicial, km_final, iniciada_em, finalizada_em, quantidade, valor_praticado, valor_frete, status, cliente:clientes(nome), material:materiais(nome, unidade), veiculo:veiculos(placa)";

// SELECT completo pro modal (com fotos)
const SELECT_DETAIL =
  "id, numero, endereco, km_inicial, km_final, iniciada_em, finalizada_em, quantidade, valor_praticado, valor_frete, status, foto_odometro_final_url, foto_material_url, assinatura_url, foto_material_gps_lat, foto_material_gps_lng, cliente:clientes(nome), material:materiais(nome, unidade), veiculo:veiculos(placa)";

function MinhasEntregas() {
  const { data: prof } = useProfile();
  const uid = prof?.profile.id;
  const [tab, setTab] = useState<"em_rota" | "entregue">("em_rota");
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const queryClient = useQueryClient();

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
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("entregas")
        .select(SELECT_LIST)
        .eq("status", "em_rota")
        .eq("motorista_entrega_id", uid)
        .order("iniciada_em", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Pré-carrega "entregues" em background — sem bloquear a tela
  const entreguesQ = useQuery({
    queryKey: ["minhas-entregas", "entregue", uid],
    enabled: !!uid,
    staleTime: 30_000,
    refetchOnMount: "always",
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("entregas")
        .select(SELECT_LIST)
        .eq("status", "entregue")
        .eq("motorista_entrega_id", uid)
        .order("finalizada_em", { ascending: false, nullsFirst: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

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
            <div className="text-sm font-semibold">Em rota de entrega</div>
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
              <RefreshCw className={`h-4 w-4 mr-1 ${entreguesQ.isFetching ? "animate-spin" : ""}`} />
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

      <DetalheDialog id={detalheId} onClose={() => setDetalheId(null)} />
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
}: {
  rows?: any[];
  loading: boolean;
  fetching: boolean;
  empty: string;
  onOpen: (id: string) => void;
  mostrarFinalizar?: boolean;
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
      {(rows ?? []).map((r: any) => (
        <Card key={r.id} className="cursor-pointer active:opacity-70" onClick={() => onOpen(r.id)}>
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
              <Link
                to="/entrega/$id/finalizar"
                params={{ id: r.id }}
                className="block"
                onClick={(e) => e.stopPropagation()}
              >
                <Button size="sm" variant="action" className="w-full">
                  Finalizar entrega
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ))}
      {!loading && (rows ?? []).length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">{empty}</p>
      )}
    </>
  );
}

function fmtBRL(v: any) {
  if (v == null) return "—";
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function Row({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex justify-between gap-3 text-sm py-1 border-b last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right break-words">{value ?? "—"}</span>
    </div>
  );
}

function DetalheDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data: item, isLoading, error } = useQuery({
    queryKey: ["entrega-detalhe", id],
    enabled: !!id,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("entregas")
        .select(SELECT_DETAIL)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {item?.numero != null && <span className="text-muted-foreground mr-1">#{item.numero}</span>}
            {item?.cliente?.nome ?? "Entrega"}
          </DialogTitle>
          <DialogDescription>
            {isLoading
              ? "Carregando detalhes..."
              : item?.status === "entregue"
                ? "Entrega finalizada"
                : "Em rota"}
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center justify-center py-6 text-sm text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
          </div>
        )}

        {error && !isLoading && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            Não foi possível carregar os detalhes. Toque em Atualizar e tente novamente.
          </div>
        )}

        {item && !isLoading && (
          <>
            <div className="space-y-1">
              <Row
                label="Material"
                value={`${item.material?.nome ?? "—"} (${item.material?.unidade ?? ""})`}
              />
              <Row label="Quantidade" value={item.quantidade} />
              <Row label="Veículo" value={item.veiculo?.placa} />
              <Row label="Endereço" value={item.endereco} />
              <Row label="Valor praticado" value={fmtBRL(item.valor_praticado)} />
              <Row label="Valor frete" value={fmtBRL(item.valor_frete)} />
              <Row label="KM inicial" value={item.km_inicial} />
              <Row label="KM final" value={item.km_final} />
              {item.km_inicial != null && item.km_final != null && (
                <Row
                  label="KM percorridos"
                  value={Number(item.km_final) - Number(item.km_inicial)}
                />
              )}
              <Row
                label="Iniciada em"
                value={
                  item.iniciada_em ? new Date(item.iniciada_em).toLocaleString("pt-BR") : "—"
                }
              />
              <Row
                label="Finalizada em"
                value={
                  item.finalizada_em
                    ? new Date(item.finalizada_em).toLocaleString("pt-BR")
                    : "—"
                }
              />
              {item.foto_material_gps_lat != null && (
                <Row
                  label="GPS material"
                  value={`${item.foto_material_gps_lat?.toFixed?.(5)}, ${item.foto_material_gps_lng?.toFixed?.(5)}`}
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <FotoBox label="Odômetro final" bucket="odometros" path={item.foto_odometro_final_url} />
              <FotoBox label="Material" bucket="entregas" path={item.foto_material_url} />
              <FotoBox label="Assinatura" bucket="assinaturas" path={item.assinatura_url} />
            </div>

            {item.status === "em_rota" && (
              <Link to="/entrega/$id/finalizar" params={{ id: item.id }} onClick={onClose}>
                <Button variant="action" className="w-full mt-2">
                  Finalizar entrega
                </Button>
              </Link>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function FotoBox({
  label,
  bucket,
  path,
}: {
  label: string;
  bucket: "odometros" | "entregas" | "assinaturas";
  path?: string | null;
}) {
  const cleanPath = path?.trim() || null;
  const isHttp = !!cleanPath && /^https?:\/\//i.test(cleanPath);
  const { data: signedUrl } = useQuery({
    queryKey: ["storage-signed-url", bucket, cleanPath],
    enabled: !!cleanPath && !isHttp,
    staleTime: 50 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(cleanPath!, 60 * 60);
      if (error) throw error;
      return data.signedUrl;
    },
  });
  const url = useMemo(() => (isHttp ? cleanPath : signedUrl), [cleanPath, isHttp, signedUrl]);

  return (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground">{label}</div>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer">
          <img src={url} alt={label} className="w-full h-24 object-cover rounded border" />
        </a>
      ) : (
        <div className="w-full h-24 rounded border bg-muted flex items-center justify-center text-xs text-muted-foreground">
          sem foto
        </div>
      )}
    </div>
  );
}
