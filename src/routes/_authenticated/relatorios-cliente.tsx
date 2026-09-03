import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-session";
import { AdminOnly } from "@/components/role-guard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { ArrowLeft, Printer, Users, Filter, X } from "lucide-react";
import { EntregaDetalheDialog } from "@/components/entrega-detalhe-dialog";
import { calcularValorMateriais, resumoMateriais } from "@/lib/entrega-itens";

export const Route = createFileRoute("/_authenticated/relatorios-cliente")({
  component: () => (
    <AdminOnly>
      <Page />
    </AdminOnly>
  ),
});

const FORMA_LABEL: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "Pix",
  deposito: "Depósito",
  cartao_credito: "Cartão de crédito",
  permuta: "Permuta",
  boleto: "Boleto",
  carteira: "Carteira",
};

const FORMAS_PAGAMENTO = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "pix", label: "Pix" },
  { value: "deposito", label: "Depósito" },
  { value: "cartao_credito", label: "Cartão de crédito" },
  { value: "permuta", label: "Permuta" },
  { value: "boleto", label: "Boleto" },
  { value: "carteira", label: "Carteira" },
];

function brl(n: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);
}

function formatarData(data?: string | null) {
  if (!data) return "—";
  const valor = /^\d{4}-\d{2}-\d{2}$/.test(data) ? `${data}T00:00:00` : data;
  return new Date(valor).toLocaleDateString("pt-BR");
}

function inicioDiaISO(data: string) {
  return new Date(`${data}T00:00:00`).toISOString();
}

function fimDiaISO(data: string) {
  return new Date(`${data}T23:59:59.999`).toISOString();
}

function totalEntrega(e: any) {
  return calcularValorMateriais(e) + Number(e.valor_frete || 0);
}

type StatusFiltro = "todos" | "a_receber" | "recebido";

function Page() {
  const { data: prof } = useProfile();
  const empresaId = prof?.profile.empresa_id;
  const [clienteId, setClienteId] = useState("");
  const [dataIni, setDataIni] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("todas");
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>("todos");
  const [ocultarPagamento, setOcultarPagamento] = useState(false);
  const [detalheId, setDetalheId] = useState<string | null>(null);

  const { data: clientes } = useQuery({
    queryKey: ["relatorios-cliente-lista", empresaId],
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

  const { data: vendas, isLoading } = useQuery({
    queryKey: [
      "relatorios-cliente-vendas",
      empresaId,
      clienteId,
      dataIni,
      dataFim,
      formaPagamento,
      statusFiltro,
    ],
    enabled: !!empresaId && !!clienteId,
    queryFn: async () => {
      let q = (supabase as any)
        .from("entregas")
        .select(
          "id, numero, status, status_pagamento, forma_pagamento, material_id, material:materiais(nome, unidade), preco_base_no_momento, valor_praticado, valor_frete, quantidade, itens, criada_em, vencimento_pagamento, pagamento_confirmado_em, observacoes",
        )
        .eq("empresa_id", empresaId)
        .eq("cliente_id", clienteId)
        .neq("status", "cancelada")
        .not("forma_pagamento", "is", null)
        .order("criada_em", { ascending: false })
        .limit(500);
      if (dataIni) q = q.gte("criada_em", inicioDiaISO(dataIni));
      if (dataFim) q = q.lte("criada_em", fimDiaISO(dataFim));
      if (formaPagamento !== "todas") q = q.eq("forma_pagamento", formaPagamento);
      if (statusFiltro === "recebido") q = q.eq("status_pagamento", "confirmado");
      if (statusFiltro === "a_receber") q = q.neq("status_pagamento", "confirmado");
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const resumo = useMemo(() => {
    const lista = vendas ?? [];
    let aReceber = 0;
    let recebido = 0;
    for (const v of lista) {
      const total = totalEntrega(v);
      if (v.status_pagamento === "confirmado") recebido += total;
      else aReceber += total;
    }
    return { aReceber, recebido, total: aReceber + recebido, qtd: lista.length };
  }, [vendas]);

  const filtrosAtivos =
    (dataIni ? 1 : 0) +
    (dataFim ? 1 : 0) +
    (formaPagamento !== "todas" ? 1 : 0) +
    (statusFiltro !== "todos" ? 1 : 0);

  function limparFiltros() {
    setDataIni("");
    setDataFim("");
    setFormaPagamento("todas");
    setStatusFiltro("todos");
  }

  const clienteSelecionado = (clientes ?? []).find((c: any) => c.id === clienteId);

  const periodoLabel =
    dataIni || dataFim
      ? `${dataIni ? formatarData(dataIni) : "início"} até ${dataFim ? formatarData(dataFim) : "hoje"}`
      : "Todo o período";

  const filtrosImpressao = [
    formaPagamento !== "todas"
      ? `Forma de pagamento: ${FORMA_LABEL[formaPagamento] ?? formaPagamento}`
      : null,
    statusFiltro === "recebido"
      ? "Status: Recebido"
      : statusFiltro === "a_receber"
        ? "Status: A receber"
        : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-4 pb-6">
      <style>{`
        @media print {
          @page { margin: 14mm; }
          body * { visibility: hidden; }
          #relatorio-cliente-print, #relatorio-cliente-print * { visibility: visible; }
          #relatorio-cliente-print { position: absolute; inset: 0; }
        }
      `}</style>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            to="/relatorios"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar para Relatórios
          </Link>
          <h1 className="mt-1 text-xl font-bold flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" /> Relatório por cliente
          </h1>
          <p className="text-xs text-muted-foreground">
            Frete e vendas de um cliente em um período, com status de recebimento.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="hidden shrink-0 items-center gap-2 md:inline-flex"
          disabled={!clienteId || (vendas?.length ?? 0) === 0}
          onClick={() => window.print()}
        >
          <Printer className="h-4 w-4" /> Imprimir
        </Button>
      </div>

      <Card>
        <CardContent className="space-y-3 p-3">
          <div>
            <Label htmlFor="relatorio-cliente-select">Cliente *</Label>
            <Select value={clienteId} onValueChange={setClienteId}>
              <SelectTrigger id="relatorio-cliente-select">
                <SelectValue placeholder="Selecione o cliente" />
              </SelectTrigger>
              <SelectContent>
                {(clientes ?? []).map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Filter className="h-4 w-4" /> Filtros
            </div>
            {filtrosAtivos > 0 && (
              <Button type="button" variant="ghost" size="sm" onClick={limparFiltros}>
                <X className="h-4 w-4" /> Limpar
              </Button>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="relatorio-cliente-data-ini">Data inicial</Label>
              <Input
                id="relatorio-cliente-data-ini"
                type="date"
                value={dataIni}
                onChange={(e) => setDataIni(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="relatorio-cliente-data-fim">Data final</Label>
              <Input
                id="relatorio-cliente-data-fim"
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Forma de pagamento</Label>
              <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  {FORMAS_PAGAMENTO.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={statusFiltro}
                onValueChange={(v) => setStatusFiltro(v as StatusFiltro)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="a_receber">A receber</SelectItem>
                  <SelectItem value="recebido">Recebido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="hidden items-center gap-2 pt-1 md:flex">
            <Checkbox
              id="relatorio-cliente-ocultar-pagamento"
              checked={ocultarPagamento}
              onCheckedChange={(v) => setOcultarPagamento(v === true)}
            />
            <Label
              htmlFor="relatorio-cliente-ocultar-pagamento"
              className="text-xs font-normal text-muted-foreground"
            >
              Ocultar status e data de recebimento (mostra só o valor total de cada venda)
            </Label>
          </div>
        </CardContent>
      </Card>

      {!clienteId && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Selecione um cliente para ver o relatório.
        </p>
      )}

      {clienteId && (
        <>
          <div className={`grid grid-cols-2 gap-3 ${ocultarPagamento ? "" : "md:grid-cols-4"}`}>
            <StatTile label="Vendas" value={String(resumo.qtd)} />
            <StatTile label="Total geral" value={brl(resumo.total)} />
            {!ocultarPagamento && (
              <>
                <StatTile label="A receber" value={brl(resumo.aReceber)} tone="warn" />
                <StatTile label="Recebido" value={brl(resumo.recebido)} tone="ok" />
              </>
            )}
          </div>

          {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
          {!isLoading && (vendas ?? []).length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma venda encontrada para {clienteSelecionado?.nome ?? "este cliente"} no
              período.
            </p>
          )}

          <div className="space-y-2 md:hidden">
            {(vendas ?? []).map((v: any) => (
              <VendaCard
                key={v.id}
                v={v}
                ocultarPagamento={ocultarPagamento}
                onClick={() => setDetalheId(v.id)}
              />
            ))}
          </div>

          {(vendas?.length ?? 0) > 0 && (
            <Card className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Venda</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Frete / Materiais</TableHead>
                    <TableHead>Forma de pagamento</TableHead>
                    {!ocultarPagamento && (
                      <>
                        <TableHead>Status</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead>Recebida em</TableHead>
                      </>
                    )}
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(vendas ?? []).map((v: any) => {
                    const recebido = v.status_pagamento === "confirmado";
                    return (
                      <TableRow
                        key={v.id}
                        className="cursor-pointer"
                        onClick={() => setDetalheId(v.id)}
                      >
                        <TableCell className="font-medium">
                          {v.numero != null ? `#${v.numero}` : "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatarData(v.criada_em)}
                        </TableCell>
                        <TableCell className="max-w-56 truncate text-muted-foreground">
                          {resumoMateriais(v)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {FORMA_LABEL[v.forma_pagamento] ?? v.forma_pagamento}
                          </Badge>
                        </TableCell>
                        {!ocultarPagamento && (
                          <>
                            <TableCell>
                              {recebido ? (
                                <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30 hover:bg-emerald-500/15">
                                  Recebido
                                </Badge>
                              ) : (
                                <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30 hover:bg-amber-500/15">
                                  A receber
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {v.vencimento_pagamento ? formatarData(v.vencimento_pagamento) : "—"}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {v.pagamento_confirmado_em
                                ? formatarData(v.pagamento_confirmado_em)
                                : "—"}
                            </TableCell>
                          </>
                        )}
                        <TableCell className="text-right font-semibold">
                          {brl(totalEntrega(v))}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </>
      )}

      {clienteId && (vendas?.length ?? 0) > 0 && (
        <div id="relatorio-cliente-print" className="hidden print:block">
          <h1 className="text-lg font-bold">Relatório por cliente</h1>
          <div className="mt-1 text-sm">
            <div>
              <strong>Cliente:</strong> {clienteSelecionado?.nome ?? "—"}
            </div>
            <div>
              <strong>Período:</strong> {periodoLabel}
            </div>
            {filtrosImpressao && (
              <div>
                <strong>Filtros:</strong> {filtrosImpressao}
              </div>
            )}
            <div className="text-xs text-muted-foreground">
              Emitido em {new Date().toLocaleString("pt-BR")}
            </div>
          </div>

          <div className={`mt-3 grid gap-2 text-xs ${ocultarPagamento ? "grid-cols-2" : "grid-cols-4"}`}>
            <div>
              <strong>Vendas:</strong> {resumo.qtd}
            </div>
            <div>
              <strong>Total geral:</strong> {brl(resumo.total)}
            </div>
            {!ocultarPagamento && (
              <>
                <div>
                  <strong>A receber:</strong> {brl(resumo.aReceber)}
                </div>
                <div>
                  <strong>Recebido:</strong> {brl(resumo.recebido)}
                </div>
              </>
            )}
          </div>

          <table className="mt-4 w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="border border-gray-400 p-1 text-left">Venda</th>
                <th className="border border-gray-400 p-1 text-left">Data</th>
                <th className="border border-gray-400 p-1 text-left">Frete / Materiais</th>
                <th className="border border-gray-400 p-1 text-left">Forma de pagamento</th>
                {!ocultarPagamento && (
                  <>
                    <th className="border border-gray-400 p-1 text-left">Status</th>
                    <th className="border border-gray-400 p-1 text-left">Vencimento</th>
                    <th className="border border-gray-400 p-1 text-left">Recebida em</th>
                  </>
                )}
                <th className="border border-gray-400 p-1 text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {(vendas ?? []).map((v: any) => {
                const recebido = v.status_pagamento === "confirmado";
                return (
                  <tr key={v.id}>
                    <td className="border border-gray-400 p-1">
                      {v.numero != null ? `#${v.numero}` : "—"}
                    </td>
                    <td className="border border-gray-400 p-1">{formatarData(v.criada_em)}</td>
                    <td className="border border-gray-400 p-1">{resumoMateriais(v)}</td>
                    <td className="border border-gray-400 p-1">
                      {FORMA_LABEL[v.forma_pagamento] ?? v.forma_pagamento}
                    </td>
                    {!ocultarPagamento && (
                      <>
                        <td className="border border-gray-400 p-1">
                          {recebido ? "Recebido" : "A receber"}
                        </td>
                        <td className="border border-gray-400 p-1">
                          {v.vencimento_pagamento ? formatarData(v.vencimento_pagamento) : "—"}
                        </td>
                        <td className="border border-gray-400 p-1">
                          {v.pagamento_confirmado_em
                            ? formatarData(v.pagamento_confirmado_em)
                            : "—"}
                        </td>
                      </>
                    )}
                    <td className="border border-gray-400 p-1 text-right">
                      {brl(totalEntrega(v))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <EntregaDetalheDialog id={detalheId} onClose={() => setDetalheId(null)} empresaId={empresaId} />
    </div>
  );
}

function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warn" | "ok";
}) {
  const color = tone === "warn" ? "text-amber-600" : tone === "ok" ? "text-emerald-600" : "";
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 text-base font-bold ${color}`}>{value}</div>
    </div>
  );
}

function VendaCard({
  v,
  ocultarPagamento,
  onClick,
}: {
  v: any;
  ocultarPagamento: boolean;
  onClick: () => void;
}) {
  const recebido = v.status_pagamento === "confirmado";
  return (
    <button type="button" className="block w-full text-left" onClick={onClick}>
      <Card className="transition-colors hover:border-primary/50 hover:bg-muted/30">
        <CardContent className="p-3 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">{v.numero != null ? `#${v.numero}` : "—"}</span>
            <span className="font-bold">{brl(totalEntrega(v))}</span>
          </div>
          <div className="text-xs text-muted-foreground truncate">{resumoMateriais(v)}</div>
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-muted-foreground">
              {formatarData(v.criada_em)} · {FORMA_LABEL[v.forma_pagamento] ?? v.forma_pagamento}
            </span>
            {!ocultarPagamento &&
              (recebido ? (
                <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30 hover:bg-emerald-500/15 text-[10px]">
                  Recebido
                </Badge>
              ) : (
                <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30 hover:bg-amber-500/15 text-[10px]">
                  A receber
                </Badge>
              ))}
          </div>
        </CardContent>
      </Card>
    </button>
  );
}
