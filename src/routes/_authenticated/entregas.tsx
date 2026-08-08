import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-session";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, Clock, CheckCircle2, Loader2, MapPin, User, Trash2, Undo2, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { pendingByType } from "@/lib/offline/queue";
import type { OutboxItem } from "@/lib/offline/db";
import { SwipeToAction } from "@/components/swipe-to-action";

import { AdminOnly } from "@/components/role-guard";

export const Route = createFileRoute("/_authenticated/entregas")({
  component: () => (
    <AdminOnly>
      <Page />
    </AdminOnly>
  ),
});

type StatusFiltro = "todos" | "pendente" | "em_rota" | "entregue" | "cancelada";

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pendente:  { label: "Pendente",   cls: "bg-amber-500/15 text-amber-700 border-amber-500/30" },
  em_rota:   { label: "Em entrega", cls: "bg-sky-500/15 text-sky-700 border-sky-500/30" },
  entregue:  { label: "Entregue",   cls: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" },
  cancelada: { label: "Cancelada",  cls: "bg-rose-500/15 text-rose-700 border-rose-500/30" },
};

const SELECT_DETAIL =
  "id, numero, endereco, km_inicial, km_final, iniciada_em, finalizada_em, criada_em, quantidade, valor_praticado, valor_frete, preco_base_no_momento, status, observacoes, foto_odometro_final_url, foto_material_url, assinatura_url, foto_material_gps_lat, foto_material_gps_lng, motorista_venda_id, motorista_entrega_id, cliente:clientes(nome), material:materiais(nome, unidade), veiculo:veiculos(placa)";

function Page() {
  const { data: prof } = useProfile();
  const empresaId = prof?.profile.empresa_id;
  const [filtro, setFiltro] = useState<StatusFiltro>("todos");
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: rows, isLoading, refetch } = useQuery({
    queryKey: ["entregas", empresaId, filtro],
    enabled: !!empresaId,
    queryFn: async () => {
      let q = (supabase as any)
        .from("entregas")
        .select("id, numero, valor_praticado, preco_base_no_momento, valor_frete, quantidade, status, criada_em, endereco, observacoes, motorista_venda_id, motorista_entrega_id, cliente:clientes(nome), material:materiais(nome, unidade), veiculo:veiculos(placa)")
        .order("criada_em", { ascending: false })
        .limit(150);
      if (filtro !== "todos") q = q.eq("status", filtro);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const [pending, setPending] = useState<OutboxItem[]>([]);
  useEffect(() => {
    const load = () => pendingByType("entrega").then(setPending);
    load();
    window.addEventListener("offline-outbox-changed", load);
    window.addEventListener("offline-sync-finished", load);
    return () => {
      window.removeEventListener("offline-outbox-changed", load);
      window.removeEventListener("offline-sync-finished", load);
    };
  }, []);

  const remoteIds = useMemo(() => new Set((rows ?? []).map((r: any) => r.id)), [rows]);
  const pendingOnly = pending.filter((p) => !remoteIds.has(p.id));

  const [confirmarExcluirId, setConfirmarExcluirId] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  const [editar, setEditar] = useState<{
    id: string;
    quantidade: string;
    valor_praticado: string;
    valor_frete: string;
    endereco: string;
    observacoes: string;
  } | null>(null);
  const [salvando, setSalvando] = useState(false);

  function abrirEdicao(r: any) {
    setEditar({
      id: r.id,
      quantidade: String(r.quantidade ?? ""),
      valor_praticado: String(r.valor_praticado ?? ""),
      valor_frete: String(r.valor_frete ?? ""),
      endereco: r.endereco ?? "",
      observacoes: r.observacoes ?? "",
    });
  }

  async function salvarEdicao() {
    if (!editar) return;
    const quantidade = Number(editar.quantidade);
    const valorPraticado = Number(editar.valor_praticado);
    const valorFrete = Number(editar.valor_frete || 0);
    if (!Number.isFinite(quantidade) || quantidade <= 0) return toast.error("Quantidade inválida");
    if (!Number.isFinite(valorPraticado) || valorPraticado < 0) return toast.error("Valor inválido");
    if (!Number.isFinite(valorFrete) || valorFrete < 0) return toast.error("Frete inválido");

    setSalvando(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-entrega", {
        body: {
          action: "editar_entrega",
          entrega_id: editar.id,
          quantidade,
          valor_praticado: valorPraticado,
          valor_frete: valorFrete,
          endereco: editar.endereco,
          observacoes: editar.observacoes,
        },
      });
      if (error) return toast.error(error.message);
      if (data?.erro) {
        return toast.error(
          data.erro === "SEM_PERMISSAO" ? "Sem permissão para editar esta venda" : data.erro,
        );
      }
      toast.success("Venda atualizada");
      setEditar(null);
      await invalidarListas();
    } finally {
      setSalvando(false);
    }
  }

  async function invalidarListas() {
    await Promise.all([
      refetch(),
      queryClient.invalidateQueries({ queryKey: ["pendentes"] }),
      queryClient.invalidateQueries({ queryKey: ["minhas-entregas"] }),
    ]);
  }

  async function excluir(id: string) {
    setExcluindo(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-entrega", {
        body: { action: "cancelar_entrega", entrega_id: id },
      });
      if (error) return toast.error(error.message);
      if (data?.erro) {
        return toast.error(
          data.erro === "SEM_PERMISSAO" ? "Sem permissão para excluir esta venda" : data.erro,
        );
      }
      toast.success("Venda removida");
      setConfirmarExcluirId(null);
      await invalidarListas();
    } finally {
      setExcluindo(false);
    }
  }

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
    await invalidarListas();
  }

  if (!prof) return null;

  const filtros: { v: StatusFiltro; label: string }[] = [
    { v: "todos", label: "Todos" },
    { v: "pendente", label: "Pendentes" },
    { v: "em_rota", label: "Em entrega" },
    { v: "entregue", label: "Entregues" },
    { v: "cancelada", label: "Canceladas" },
  ];

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">Entregas</h1>
      <p className="text-xs text-muted-foreground -mt-2">
        Arraste um card para o lado: pendente/entregue exclui; em entrega volta a pendente.
      </p>

      <div className="flex gap-1.5 flex-wrap">
        {filtros.map((f) => (
          <Button key={f.v} size="sm" variant={filtro === f.v ? "default" : "outline"}
            onClick={() => setFiltro(f.v)} className="h-7 text-xs">
            {f.label}
          </Button>
        ))}
      </div>

      {pendingOnly.map((p) => (
        <Card key={p.id} className="border-amber-300/60">
          <CardContent className="p-3 space-y-1">
            <div className="flex items-center justify-between">
              <div className="font-medium truncate">Venda offline</div>
              <span className="flex items-center gap-1 text-xs text-amber-600">
                <Clock className="h-3 w-3" /> aguardando sincronização
              </span>
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {p.payload?.endereco || "—"} · {new Date(p.created_at).toLocaleString("pt-BR")}
            </div>
            <div className="text-sm">R$ {Number(p.payload?.valor_praticado ?? 0).toFixed(2)}</div>
          </CardContent>
        </Card>
      ))}

      {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {(rows ?? []).map((r: any) => {
        const diff = Number(r.valor_praticado) !== Number(r.preco_base_no_momento);
        const st = STATUS_LABEL[r.status] ?? { label: r.status, cls: "" };
        const card = (
          <Card
            className="cursor-pointer active:opacity-70"
            onClick={() => setDetalheId(r.id)}
          >
            <CardContent className="p-3 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium truncate">
                  {r.numero != null && <span className="text-muted-foreground mr-1">#{r.numero}</span>}
                  {r.cliente?.nome ?? "—"}
                </div>
                <span className="flex items-center gap-1 shrink-0">
                  <Badge variant="outline" className={st.cls}>{st.label}</Badge>
                  {(r.status === "pendente" || r.status === "entregue") && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-primary hover:bg-primary/10"
                      aria-label="Editar venda"
                      onClick={(e) => {
                        e.stopPropagation();
                        abrirEdicao(r);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  {r.status === "em_rota" && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-amber-600 hover:bg-amber-500/10"
                      aria-label="Voltar para pendente"
                      onClick={(e) => {
                        e.stopPropagation();
                        voltarPendente(r.id);
                      }}
                    >
                      <Undo2 className="h-4 w-4" />
                    </Button>
                  )}
                </span>
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {r.material?.nome} · {r.quantidade} {r.material?.unidade}
                {r.veiculo?.placa ? ` · ${r.veiculo.placa}` : ""}
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>R$ {Number(r.valor_praticado).toFixed(2)}</span>
                <span className="flex items-center gap-2">
                  {diff && (
                    <span className="text-amber-500 flex items-center gap-1 text-xs">
                      <AlertTriangle className="h-3 w-3" /> base R$ {Number(r.preco_base_no_momento).toFixed(2)}
                    </span>
                  )}
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                  <span className="text-xs text-muted-foreground">
                    {new Date(r.criada_em).toLocaleDateString("pt-BR")}
                  </span>
                </span>
              </div>
              {Number(r.valor_frete) > 0 && (
                <div className="text-xs text-muted-foreground">Frete: R$ {Number(r.valor_frete).toFixed(2)}</div>
              )}
            </CardContent>
          </Card>
        );
        if (r.status === "pendente" || r.status === "entregue") {
          return (
            <SwipeToAction
              key={r.id}
              actionLabel="Excluir"
              actionIcon={<Trash2 className="h-4 w-4" />}
              actionClassName="bg-destructive text-destructive-foreground"
              onAction={() => setConfirmarExcluirId(r.id)}
            >
              {card}
            </SwipeToAction>
          );
        }
        if (r.status === "em_rota") {
          return (
            <SwipeToAction
              key={r.id}
              actionLabel="Voltar p/ pendente"
              actionIcon={<Undo2 className="h-4 w-4" />}
              actionClassName="bg-amber-500 text-white"
              onAction={() => voltarPendente(r.id)}
            >
              {card}
            </SwipeToAction>
          );
        }
        return <div key={r.id}>{card}</div>;
      })}
      {!isLoading && (rows ?? []).length === 0 && pendingOnly.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhuma entrega encontrada.</p>
      )}
      <Link to="/" className="block text-center text-sm text-primary pt-2">← Voltar</Link>

      <DetalheDialog id={detalheId} onClose={() => setDetalheId(null)} />

      <Dialog open={!!editar} onOpenChange={(o) => !o && setEditar(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar venda</DialogTitle>
            <DialogDescription>Corrija os dados preenchidos incorretamente.</DialogDescription>
          </DialogHeader>
          {editar && (
            <div className="space-y-3">
              <div>
                <Label>Quantidade</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={editar.quantidade}
                  onChange={(e) => setEditar({ ...editar, quantidade: e.target.value })}
                />
              </div>
              <div>
                <Label>Valor praticado (R$)</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={editar.valor_praticado}
                  onChange={(e) => setEditar({ ...editar, valor_praticado: e.target.value })}
                />
              </div>
              <div>
                <Label>Valor do frete (R$)</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={editar.valor_frete}
                  onChange={(e) => setEditar({ ...editar, valor_frete: e.target.value })}
                />
              </div>
              <div>
                <Label>Endereço</Label>
                <Input
                  value={editar.endereco}
                  onChange={(e) => setEditar({ ...editar, endereco: e.target.value })}
                />
              </div>
              <div>
                <Label>Observações</Label>
                <Textarea
                  rows={2}
                  value={editar.observacoes}
                  onChange={(e) => setEditar({ ...editar, observacoes: e.target.value })}
                />
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => setEditar(null)}>
                  Cancelar
                </Button>
                <Button variant="action" className="flex-1" onClick={salvarEdicao} disabled={salvando}>
                  {salvando ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!confirmarExcluirId}
        onOpenChange={(o) => !o && setConfirmarExcluirId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta venda?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A venda será marcada como cancelada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluindo}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={excluindo}
              onClick={(e) => {
                e.preventDefault();
                if (confirmarExcluirId) excluir(confirmarExcluirId);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {excluindo ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
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
    queryKey: ["entrega-admin-detalhe", id],
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

  const motoristaIds = useMemo(() => {
    const ids = new Set<string>();
    if (item?.motorista_venda_id) ids.add(item.motorista_venda_id);
    if (item?.motorista_entrega_id) ids.add(item.motorista_entrega_id);
    return Array.from(ids);
  }, [item]);

  const { data: motoristas } = useQuery({
    queryKey: ["entrega-motoristas", motoristaIds],
    enabled: motoristaIds.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("profiles")
        .select("id, nome")
        .in("id", motoristaIds);
      if (error) throw error;
      const map: Record<string, string> = {};
      (data ?? []).forEach((p: any) => { map[p.id] = p.nome; });
      return map;
    },
  });

  const nomeVenda = item?.motorista_venda_id ? motoristas?.[item.motorista_venda_id] : null;
  const nomeEntrega = item?.motorista_entrega_id ? motoristas?.[item.motorista_entrega_id] : null;
  const st = item ? (STATUS_LABEL[item.status] ?? { label: item.status, cls: "" }) : null;

  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {item?.numero != null && <span className="text-muted-foreground mr-1">#{item.numero}</span>}
            {item?.cliente?.nome ?? "Entrega"}
          </DialogTitle>
          <DialogDescription>
            {isLoading ? "Carregando detalhes..." : st?.label ?? ""}
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center justify-center py-6 text-sm text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
          </div>
        )}

        {error && !isLoading && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            Não foi possível carregar os detalhes.
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
              <Row
                label="Endereço"
                value={
                  item.endereco ? (
                    <span className="inline-flex items-start gap-1 justify-end">
                      <MapPin className="h-3 w-3 mt-0.5 shrink-0" /> {item.endereco}
                    </span>
                  ) : "—"
                }
              />
              <Row label="Valor praticado" value={fmtBRL(item.valor_praticado)} />
              {Number(item.preco_base_no_momento) !== Number(item.valor_praticado) && (
                <Row label="Preço base" value={fmtBRL(item.preco_base_no_momento)} />
              )}
              <Row label="Valor frete" value={fmtBRL(item.valor_frete)} />
              <Row
                label="Motorista (venda)"
                value={
                  nomeVenda ? (
                    <span className="inline-flex items-center gap-1 justify-end">
                      <User className="h-3 w-3" /> {nomeVenda}
                    </span>
                  ) : item.motorista_venda_id ? "..." : "—"
                }
              />
              <Row
                label="Motorista (entrega)"
                value={
                  nomeEntrega ? (
                    <span className="inline-flex items-center gap-1 justify-end">
                      <User className="h-3 w-3" /> {nomeEntrega}
                    </span>
                  ) : item.motorista_entrega_id ? "..." : "—"
                }
              />
              <Row label="KM inicial" value={item.km_inicial} />
              <Row label="KM final" value={item.km_final} />
              {item.km_inicial != null && item.km_final != null && (
                <Row
                  label="KM percorridos"
                  value={Number(item.km_final) - Number(item.km_inicial)}
                />
              )}
              <Row
                label="Criada em"
                value={item.criada_em ? new Date(item.criada_em).toLocaleString("pt-BR") : "—"}
              />
              <Row
                label="Iniciada em"
                value={item.iniciada_em ? new Date(item.iniciada_em).toLocaleString("pt-BR") : "—"}
              />
              <Row
                label="Finalizada em"
                value={item.finalizada_em ? new Date(item.finalizada_em).toLocaleString("pt-BR") : "—"}
              />
              {item.foto_material_gps_lat != null && (
                <Row
                  label="GPS material"
                  value={`${item.foto_material_gps_lat?.toFixed?.(5)}, ${item.foto_material_gps_lng?.toFixed?.(5)}`}
                />
              )}
              {item.observacoes && <Row label="Observações" value={item.observacoes} />}
            </div>

            {item.status === "entregue" && (
              <div className="grid grid-cols-2 gap-2 pt-2">
                <FotoBox label="Odômetro final" bucket="odometros" path={item.foto_odometro_final_url} />
                <FotoBox label="Material" bucket="entregas" path={item.foto_material_url} />
                <FotoBox label="Assinatura" bucket="assinaturas" path={item.assinatura_url} />
              </div>
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
  const url = isHttp ? cleanPath : signedUrl;

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
