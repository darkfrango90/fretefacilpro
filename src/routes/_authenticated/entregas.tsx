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
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  Loader2,
  MapPin,
  Trash2,
  Undo2,
  Pencil,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { pendingByType } from "@/lib/offline/queue";
import type { OutboxItem } from "@/lib/offline/db";
import { SwipeToAction } from "@/components/swipe-to-action";
import { EntregaDetalheDialog } from "@/components/entrega-detalhe-dialog";
import { MoneyInput } from "@/components/money-input";

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
  pendente: { label: "Pendente", cls: "bg-amber-500/15 text-amber-700 border-amber-500/30" },
  em_rota: { label: "Em entrega", cls: "bg-sky-500/15 text-sky-700 border-sky-500/30" },
  entregue: { label: "Entregue", cls: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" },
  cancelada: { label: "Cancelada", cls: "bg-rose-500/15 text-rose-700 border-rose-500/30" },
};

function Page() {
  const { data: prof } = useProfile();
  const empresaId = prof?.profile.empresa_id;
  const userId = prof?.profile.id;
  const [filtro, setFiltro] = useState<StatusFiltro>("todos");
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const {
    data: rows,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["entregas", empresaId, filtro],
    enabled: !!empresaId,
    queryFn: async () => {
      let q = (supabase as any)
        .from("entregas")
        .select(
          "id, numero, valor_praticado, preco_base_no_momento, valor_frete, quantidade, status, criada_em, endereco, observacoes, motorista_venda_id, motorista_entrega_id, cliente:clientes(nome), material:materiais(nome, unidade), veiculo:veiculos(placa)",
        )
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
    const load = () => {
      if (!userId || !empresaId) return setPending([]);
      return pendingByType("entrega", userId, empresaId).then(setPending);
    };
    load();
    window.addEventListener("offline-outbox-changed", load);
    window.addEventListener("offline-sync-finished", load);
    return () => {
      window.removeEventListener("offline-outbox-changed", load);
      window.removeEventListener("offline-sync-finished", load);
    };
  }, [userId, empresaId]);

  const remoteIds = useMemo(() => new Set((rows ?? []).map((r: any) => r.id)), [rows]);
  const pendingOnly = pending.filter((p) => !remoteIds.has(p.id));

  const [confirmarExcluirId, setConfirmarExcluirId] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [concluindoId, setConcluindoId] = useState<string | null>(null);

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
    if (!Number.isFinite(valorPraticado) || valorPraticado < 0)
      return toast.error("Valor inválido");
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

  async function concluirComoAdministrador(id: string) {
    setConcluindoId(id);
    try {
      const { data, error } = await supabase.functions.invoke("sync-entrega", {
        body: { action: "finalizar_entrega_admin", entrega_id: id },
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      if (data?.erro) {
        toast.error(
          data.erro === "SEM_PERMISSAO"
            ? "Somente administradores podem concluir diretamente"
            : data.erro,
        );
        return;
      }
      toast.success("Venda concluída pelo administrador");
      await invalidarListas();
    } finally {
      setConcluindoId(null);
    }
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
        Arraste para a direita para concluir sem KM/fotos. Arraste para a esquerda para excluir.
      </p>

      <div className="flex gap-1.5 flex-wrap">
        {filtros.map((f) => (
          <Button
            key={f.v}
            size="sm"
            variant={filtro === f.v ? "default" : "outline"}
            onClick={() => setFiltro(f.v)}
            className="h-7 text-xs"
          >
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
            <div className="text-sm">
              R${" "}
              {(
                Number(p.payload?.valor_praticado ?? 0) * Number(p.payload?.quantidade ?? 1) +
                Number(p.payload?.valor_frete ?? 0)
              ).toFixed(2)}
            </div>
          </CardContent>
        </Card>
      ))}

      {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {(rows ?? []).map((r: any) => {
        const diff = Number(r.valor_praticado) !== Number(r.preco_base_no_momento);
        const st = STATUS_LABEL[r.status] ?? { label: r.status, cls: "" };
        const card = (
          <Card className="cursor-pointer active:opacity-70" onClick={() => setDetalheId(r.id)}>
            <CardContent className="p-3 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium truncate">
                  {r.numero != null && (
                    <span className="text-muted-foreground mr-1">#{r.numero}</span>
                  )}
                  {r.cliente?.nome ?? "—"}
                </div>
                <span className="flex items-center gap-1 shrink-0">
                  <Badge variant="outline" className={st.cls}>
                    {st.label}
                  </Badge>
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
                <span>
                  R${" "}
                  {(
                    Number(r.valor_praticado) * Number(r.quantidade || 1) +
                    Number(r.valor_frete || 0)
                  ).toFixed(2)}
                </span>
                <span className="flex items-center gap-2">
                  {diff && (
                    <span className="text-amber-500 flex items-center gap-1 text-xs">
                      <AlertTriangle className="h-3 w-3" /> base R${" "}
                      {Number(r.preco_base_no_momento).toFixed(2)}
                    </span>
                  )}
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                  <span className="text-xs text-muted-foreground">
                    {new Date(r.criada_em).toLocaleDateString("pt-BR")}
                  </span>
                </span>
              </div>
              {Number(r.valor_frete) > 0 && (
                <div className="text-xs text-muted-foreground">
                  Frete: R$ {Number(r.valor_frete).toFixed(2)}
                </div>
              )}
            </CardContent>
          </Card>
        );
        if (r.status === "pendente" || r.status === "em_rota") {
          return (
            <SwipeToAction
              key={r.id}
              disabled={concluindoId === r.id || excluindo}
              swipeRightAction={{
                label: "Concluir",
                icon: <CheckCircle2 className="h-4 w-4" />,
                className: "bg-emerald-600 text-white",
                onAction: () => concluirComoAdministrador(r.id),
              }}
              swipeLeftAction={{
                label: "Excluir",
                icon: <Trash2 className="h-4 w-4" />,
                className: "bg-destructive text-destructive-foreground",
                onAction: () => setConfirmarExcluirId(r.id),
              }}
            >
              {card}
            </SwipeToAction>
          );
        }
        if (r.status === "entregue") {
          return (
            <SwipeToAction
              key={r.id}
              disabled={excluindo}
              swipeLeftAction={{
                label: "Excluir",
                icon: <Trash2 className="h-4 w-4" />,
                className: "bg-destructive text-destructive-foreground",
                onAction: () => setConfirmarExcluirId(r.id),
              }}
            >
              {card}
            </SwipeToAction>
          );
        }
        return <div key={r.id}>{card}</div>;
      })}
      {!isLoading && (rows ?? []).length === 0 && pendingOnly.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          Nenhuma entrega encontrada.
        </p>
      )}
      <Link to="/" className="block text-center text-sm text-primary pt-2">
        ← Voltar
      </Link>

      <EntregaDetalheDialog id={detalheId} onClose={() => setDetalheId(null)} />

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
                <MoneyInput
                  value={editar.valor_praticado}
                  onValueChange={(value) => setEditar({ ...editar, valor_praticado: value })}
                />
              </div>
              <div>
                <Label>Valor do frete (R$)</Label>
                <MoneyInput
                  value={editar.valor_frete}
                  onValueChange={(value) => setEditar({ ...editar, valor_frete: value })}
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
                <Button
                  variant="action"
                  className="flex-1"
                  onClick={salvarEdicao}
                  disabled={salvando}
                >
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
