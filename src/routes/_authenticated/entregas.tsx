import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-session";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  MoreHorizontal,
  Eye,
  Trash2,
  Undo2,
  Pencil,
  Filter,
  X,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { obterIntervaloCompetencia } from "@/lib/competencia-mensal";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { pendingByType } from "@/lib/offline/queue";
import type { OutboxItem } from "@/lib/offline/db";
import { SwipeToAction } from "@/components/swipe-to-action";
import { EntregaDetalheDialog } from "@/components/entrega-detalhe-dialog";
import { EntregaEditarDialog } from "@/components/entrega-editar-dialog";
import { calcularValorMateriais, resumoMateriais } from "@/lib/entrega-itens";

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
  const [mes, setMes] = useState<string>("");
  const [motoristaFiltro, setMotoristaFiltro] = useState<string>("todos");
  const [clienteFiltro, setClienteFiltro] = useState<string>("todos");
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: motoristas } = useQuery({
    queryKey: ["entregas-motoristas-filtro", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data: roles, error: rolesError } = await (supabase as any)
        .from("user_roles")
        .select("user_id")
        .eq("empresa_id", empresaId)
        .eq("role", "motorista");
      if (rolesError) throw rolesError;
      const ids = (roles ?? []).map((r: any) => r.user_id);
      if (!ids.length) return [];
      const { data: profs, error } = await (supabase as any)
        .from("profiles")
        .select("id, nome")
        .in("id", ids)
        .order("nome");
      if (error) throw error;
      return profs ?? [];
    },
  });

  const {
    data: rows,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["entregas", empresaId, filtro, mes, motoristaFiltro, clienteFiltro],
    enabled: !!empresaId,
    queryFn: async () => {
      let q = (supabase as any)
        .from("entregas")
        .select(
          "id, numero, cliente_id, material_id, itens, valor_praticado, preco_base_no_momento, valor_frete, quantidade, forma_pagamento, status, criada_em, endereco, observacoes, motorista_venda_id, motorista_entrega_id, cliente:clientes(nome), material:materiais(nome, unidade), veiculo:veiculos(placa)",
        )
        .order("criada_em", { ascending: false })
        .limit(150);
      if (filtro !== "todos") q = q.eq("status", filtro);
      if (mes) {
        const intervalo = obterIntervaloCompetencia(mes);
        q = q.gte("criada_em", intervalo.inicioIso).lte("criada_em", intervalo.fimIso);
      }
      if (motoristaFiltro !== "todos") {
        q = q.or(
          `motorista_venda_id.eq.${motoristaFiltro},motorista_entrega_id.eq.${motoristaFiltro}`,
        );
      }
      if (clienteFiltro !== "todos") q = q.eq("cliente_id", clienteFiltro);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtrosExtrasAtivos =
    (mes ? 1 : 0) + (motoristaFiltro !== "todos" ? 1 : 0) + (clienteFiltro !== "todos" ? 1 : 0);
  function limparFiltrosExtras() {
    setMes("");
    setMotoristaFiltro("todos");
    setClienteFiltro("todos");
  }

  const { data: clientesEdicao } = useQuery({
    queryKey: ["entregas-clientes-edicao", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("clientes")
        .select("id, nome")
        .eq("empresa_id", empresaId)
        .order("nome");
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

  const [editarId, setEditarId] = useState<string | null>(null);
  const entregaParaEditar = (rows ?? []).find((r: any) => r.id === editarId) ?? null;

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
      <p className="text-xs text-muted-foreground -mt-2 md:hidden">
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

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="entregas-filtro-mes" className="text-xs flex items-center gap-1">
            <Filter className="h-3 w-3" /> Mês
          </Label>
          <Input
            id="entregas-filtro-mes"
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="entregas-filtro-motorista" className="text-xs">
            Motorista
          </Label>
          <Select value={motoristaFiltro} onValueChange={setMotoristaFiltro}>
            <SelectTrigger id="entregas-filtro-motorista" className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os motoristas</SelectItem>
              {(motoristas ?? []).map((m: any) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="hidden md:block space-y-1.5">
          <Label htmlFor="entregas-filtro-cliente" className="text-xs">
            Cliente
          </Label>
          <Select value={clienteFiltro} onValueChange={setClienteFiltro}>
            <SelectTrigger id="entregas-filtro-cliente" className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os clientes</SelectItem>
              {(clientesEdicao ?? []).map((c: any) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {filtrosExtrasAtivos > 0 && (
          <Button variant="ghost" size="sm" onClick={limparFiltrosExtras} className="h-9">
            <X className="h-4 w-4 mr-1" /> Limpar
          </Button>
        )}
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
                calcularValorMateriais(p.payload ?? {}) + Number(p.payload?.valor_frete ?? 0)
              ).toFixed(2)}
            </div>
          </CardContent>
        </Card>
      ))}

      {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}

      <div className="space-y-3 md:hidden">
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
                        setEditarId(r.id);
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
                {resumoMateriais(r)}
                {r.veiculo?.placa ? ` · ${r.veiculo.placa}` : ""}
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>
                  R$ {(calcularValorMateriais(r) + Number(r.valor_frete || 0)).toFixed(2)}
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
      </div>

      <Card className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Venda</TableHead>
              <TableHead>Materiais / Veículo</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Criada em</TableHead>
              <TableHead className="w-14 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(rows ?? []).map((r: any) => {
              const diff = Number(r.valor_praticado) !== Number(r.preco_base_no_momento);
              const st = STATUS_LABEL[r.status] ?? { label: r.status, cls: "" };
              const podeEditar = r.status === "pendente" || r.status === "entregue";
              const podeConcluir = r.status === "pendente" || r.status === "em_rota";
              const podeReverter = r.status === "em_rota";
              const podeExcluir = r.status !== "cancelada";
              return (
                <TableRow
                  key={r.id}
                  className="cursor-pointer"
                  onClick={() => setDetalheId(r.id)}
                >
                  <TableCell className="font-medium">
                    {r.numero != null && (
                      <span className="text-muted-foreground mr-1">#{r.numero}</span>
                    )}
                    {r.cliente?.nome ?? "—"}
                  </TableCell>
                  <TableCell className="max-w-56 truncate text-muted-foreground">
                    {resumoMateriais(r)}
                    {r.veiculo?.placa ? ` · ${r.veiculo.placa}` : ""}
                  </TableCell>
                  <TableCell>
                    <div>R$ {(calcularValorMateriais(r) + Number(r.valor_frete || 0)).toFixed(2)}</div>
                    {diff && (
                      <div className="text-amber-600 flex items-center gap-1 text-xs">
                        <AlertTriangle className="h-3 w-3" /> base R${" "}
                        {Number(r.preco_base_no_momento).toFixed(2)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={st.cls}>
                      {st.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(r.criada_em).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" aria-label="Ações da venda">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setDetalheId(r.id)}>
                          <Eye className="h-4 w-4 mr-2" /> Ver detalhes
                        </DropdownMenuItem>
                        {podeEditar && (
                          <DropdownMenuItem onClick={() => setEditarId(r.id)}>
                            <Pencil className="h-4 w-4 mr-2" /> Editar
                          </DropdownMenuItem>
                        )}
                        {podeConcluir && (
                          <DropdownMenuItem onClick={() => concluirComoAdministrador(r.id)}>
                            <CheckCircle2 className="h-4 w-4 mr-2" /> Concluir
                          </DropdownMenuItem>
                        )}
                        {podeReverter && (
                          <DropdownMenuItem onClick={() => voltarPendente(r.id)}>
                            <Undo2 className="h-4 w-4 mr-2" /> Voltar para pendente
                          </DropdownMenuItem>
                        )}
                        {podeExcluir && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setConfirmarExcluirId(r.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" /> Excluir
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
            {!isLoading && (rows ?? []).length === 0 && pendingOnly.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                  Nenhuma entrega encontrada.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Link to="/" className="block text-center text-sm text-primary pt-2">
        ← Voltar
      </Link>

      <EntregaDetalheDialog id={detalheId} onClose={() => setDetalheId(null)} empresaId={prof?.profile.empresa_id} />

      <EntregaEditarDialog
        entrega={entregaParaEditar}
        empresaId={empresaId}
        onClose={() => setEditarId(null)}
        onSaved={invalidarListas}
      />

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
