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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { pendingByType } from "@/lib/offline/queue";
import type { OutboxItem } from "@/lib/offline/db";
import { SwipeToAction } from "@/components/swipe-to-action";
import { EntregaDetalheDialog } from "@/components/entrega-detalhe-dialog";
import { ClienteCombobox } from "@/components/cliente-combobox";
import { MoneyInput } from "@/components/money-input";
import { calcularValorMateriais, obterItensEntrega, resumoMateriais } from "@/lib/entrega-itens";

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

const FORMAS_PAGAMENTO_EDICAO = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "pix", label: "Pix" },
  { value: "deposito", label: "Depósito" },
  { value: "cartao_credito", label: "Cartão de crédito" },
  { value: "permuta", label: "Permuta" },
  { value: "boleto", label: "Boleto" },
  { value: "carteira", label: "Carteira" },
];

function materialEhFrete(nome?: string | null) {
  return String(nome ?? "").trim().toLocaleUpperCase("pt-BR") === "FRETE";
}

function Page() {
  const { data: prof } = useProfile();
  const empresaId = prof?.profile.empresa_id;
  const userId = prof?.profile.id;
  const [filtro, setFiltro] = useState<StatusFiltro>("todos");
  const [mes, setMes] = useState<string>("");
  const [motoristaFiltro, setMotoristaFiltro] = useState<string>("todos");
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
    queryKey: ["entregas", empresaId, filtro, mes, motoristaFiltro],
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
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtrosExtrasAtivos = (mes ? 1 : 0) + (motoristaFiltro !== "todos" ? 1 : 0);
  function limparFiltrosExtras() {
    setMes("");
    setMotoristaFiltro("todos");
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

  const { data: materiaisEdicao } = useQuery({
    queryKey: ["entregas-materiais-edicao", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("materiais")
        .select("id, nome, preco_base, unidade")
        .eq("empresa_id", empresaId)
        .eq("ativo", true)
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

  const [editar, setEditar] = useState<{
    id: string;
    cliente_id: string;
    material_id: string;
    quantidade: string;
    valor_praticado: string;
    valor_frete: string;
    forma_pagamento: string;
    endereco: string;
    observacoes: string;
    multiplosMateriais: boolean;
  } | null>(null);
  const [salvando, setSalvando] = useState(false);

  function abrirEdicao(r: any) {
    setEditar({
      id: r.id,
      cliente_id: r.cliente_id ?? "",
      material_id: r.material_id ?? "",
      quantidade: String(r.quantidade ?? ""),
      valor_praticado: String(r.valor_praticado ?? ""),
      valor_frete: String(r.valor_frete ?? ""),
      forma_pagamento: r.forma_pagamento ?? "",
      endereco: r.endereco ?? "",
      observacoes: r.observacoes ?? "",
      multiplosMateriais: obterItensEntrega(r).length > 1,
    });
  }

  function onSelecionarMaterialEdicao(materialId: string) {
    if (!editar) return;
    const material = (materiaisEdicao ?? []).find((m: any) => m.id === materialId);
    const frete = materialEhFrete(material?.nome);
    setEditar({
      ...editar,
      material_id: materialId,
      quantidade: frete ? "1" : editar.quantidade,
      valor_praticado: frete ? "0" : String(material?.preco_base ?? editar.valor_praticado),
    });
  }

  async function salvarEdicao() {
    if (!editar) return;
    const materialSelecionado = (materiaisEdicao ?? []).find(
      (m: any) => m.id === editar.material_id,
    );
    const isFrete = !editar.multiplosMateriais && materialEhFrete(materialSelecionado?.nome);
    const quantidade = isFrete ? 1 : Number(editar.quantidade);
    const valorPraticado = isFrete ? 0 : Number(editar.valor_praticado);
    const valorFrete = Number(editar.valor_frete || 0);
    if (!editar.cliente_id) return toast.error("Selecione o cliente");
    if (!editar.multiplosMateriais && !editar.material_id) return toast.error("Selecione o material");
    if (!editar.forma_pagamento) return toast.error("Selecione a forma de pagamento");
    if (!editar.multiplosMateriais && !isFrete && (!Number.isFinite(quantidade) || quantidade <= 0))
      return toast.error("Quantidade inválida");
    if (
      !editar.multiplosMateriais &&
      !isFrete &&
      (!Number.isFinite(valorPraticado) || valorPraticado < 0)
    )
      return toast.error("Valor inválido");
    if (!Number.isFinite(valorFrete) || valorFrete < 0) return toast.error("Frete inválido");
    if (isFrete && valorFrete <= 0) return toast.error("Informe o valor do frete");

    setSalvando(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-entrega", {
        body: {
          action: "editar_entrega",
          entrega_id: editar.id,
          ...(editar.multiplosMateriais
            ? {}
            : { material_id: editar.material_id, quantidade, valor_praticado: valorPraticado }),
          valor_frete: valorFrete,
          endereco: editar.endereco,
          observacoes: editar.observacoes,
          cliente_id: editar.cliente_id,
          forma_pagamento: editar.forma_pagamento,
        },
      });
      if (error) return toast.error(error.message);
      if (data?.erro) {
        const mensagens: Record<string, string> = {
          SEM_PERMISSAO: "Sem permissão para editar esta venda",
          CLIENTE_INVALIDO: "Cliente inválido",
          MATERIAL_INVALIDO: "Material inválido",
          FORMA_PAGAMENTO_INVALIDA: "Forma de pagamento inválida",
        };
        return toast.error(mensagens[data.erro] ?? data.erro);
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
                          <DropdownMenuItem onClick={() => abrirEdicao(r)}>
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

      <EntregaDetalheDialog id={detalheId} onClose={() => setDetalheId(null)} />

      <Dialog open={!!editar} onOpenChange={(o) => !o && setEditar(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar venda</DialogTitle>
            <DialogDescription>Corrija os dados preenchidos incorretamente.</DialogDescription>
          </DialogHeader>
          {editar && (
            <div className="space-y-3">
              <div>
                <Label>Cliente</Label>
                <ClienteCombobox
                  clientes={clientesEdicao ?? []}
                  value={editar.cliente_id}
                  onValueChange={(clienteId) => setEditar({ ...editar, cliente_id: clienteId })}
                />
              </div>

              {editar.multiplosMateriais && (
                <p className="rounded-lg bg-muted p-2 text-xs text-muted-foreground">
                  Esta venda possui vários materiais. Para preservar os itens, o material, a
                  quantidade e o valor não podem ser alterados aqui — apenas cliente, frete, forma
                  de pagamento, endereço e observações.
                </p>
              )}

              {!editar.multiplosMateriais && (
                <div>
                  <Label>Material</Label>
                  <Select value={editar.material_id} onValueChange={onSelecionarMaterialEdicao}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o material" />
                    </SelectTrigger>
                    <SelectContent>
                      {(materiaisEdicao ?? []).map((m: any) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {(() => {
                const materialSelecionado = (materiaisEdicao ?? []).find(
                  (m: any) => m.id === editar.material_id,
                );
                const isFrete =
                  !editar.multiplosMateriais && materialEhFrete(materialSelecionado?.nome);
                if (editar.multiplosMateriais) return null;
                if (isFrete) {
                  return (
                    <p className="text-xs text-muted-foreground">
                      Material FRETE: quantidade e valor do produto não se aplicam. Informe apenas
                      o valor do frete abaixo.
                    </p>
                  );
                }
                return (
                  <>
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
                  </>
                );
              })()}

              <div>
                <Label>Valor do frete (R$)</Label>
                <MoneyInput
                  value={editar.valor_frete}
                  onValueChange={(value) => setEditar({ ...editar, valor_frete: value })}
                />
              </div>
              <div>
                <Label>Forma de pagamento</Label>
                <Select
                  value={editar.forma_pagamento}
                  onValueChange={(v) => setEditar({ ...editar, forma_pagamento: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMAS_PAGAMENTO_EDICAO.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
