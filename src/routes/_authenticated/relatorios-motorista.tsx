import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-session";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarDays, LineChart, Filter, X } from "lucide-react";
import { EntregaDetalheDialog } from "@/components/entrega-detalhe-dialog";
import {
  calcularValoresEntrega,
  competenciaAtual,
  obterIntervaloCompetencia,
} from "@/lib/competencia-mensal";
import { entregaPossuiMaterial, resumoMateriais } from "@/lib/entrega-itens";

export const Route = createFileRoute("/_authenticated/relatorios-motorista")({
  component: Page,
});

const PAGAMENTOS = [
  { v: "dinheiro", l: "Dinheiro" },
  { v: "pix", l: "Pix" },
  { v: "deposito", l: "Depósito" },
  { v: "cartao_credito", l: "Cartão de crédito" },
  { v: "boleto", l: "Boleto" },
  { v: "permuta", l: "Permuta" },
  { v: "carteira", l: "Carteira" },
];

function fmtBRL(v: number) {
  return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function Page() {
  const { data: profile } = useProfile();
  const uid = profile?.profile.id;
  const empresaId = profile?.profile.empresa_id;

  const mesAtual = competenciaAtual();
  const [competencia, setCompetencia] = useState(mesAtual);
  const [pagamento, setPagamento] = useState<string>("todos");
  const [materialId, setMaterialId] = useState<string>("todos");
  const [clienteId, setClienteId] = useState<string>("todos");
  const [showFiltros, setShowFiltros] = useState(false);
  const [detalheId, setDetalheId] = useState<string | null>(null);

  const intervaloMensal = useMemo(() => obterIntervaloCompetencia(competencia), [competencia]);

  // listas auxiliares (materiais e clientes da empresa)
  const auxQ = useQuery({
    queryKey: ["relatorio-motorista-aux", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const [matR, cliR] = await Promise.all([
        (supabase as any)
          .from("materiais")
          .select("id, nome")
          .eq("empresa_id", empresaId)
          .order("nome"),
        (supabase as any)
          .from("clientes")
          .select("id, nome")
          .eq("empresa_id", empresaId)
          .order("nome"),
      ]);
      return { materiais: matR.data ?? [], clientes: cliR.data ?? [] };
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["relatorio-motorista", uid, competencia, pagamento, materialId, clienteId],
    enabled: !!uid,
    queryFn: async () => {
      let q = (supabase as any)
        .from("entregas")
        .select(
          "id, numero, criada_em, finalizada_em, status, itens, quantidade, valor_praticado, valor_frete, forma_pagamento, cliente_id, material_id, cliente:clientes(nome), material:materiais(nome, unidade)",
        )
        .eq("status", "entregue")
        .eq("motorista_entrega_id", uid)
        .order("finalizada_em", { ascending: false });

      q = q
        .gte("finalizada_em", intervaloMensal.inicioIso)
        .lte("finalizada_em", intervaloMensal.fimIso);
      if (pagamento !== "todos") q = q.eq("forma_pagamento", pagamento);
      if (clienteId !== "todos") q = q.eq("cliente_id", clienteId);

      const { data: rows, error } = await q.limit(500);
      if (error) throw error;
      const ents = (rows ?? []).filter(
        (entrega: any) => materialId === "todos" || entregaPossuiMaterial(entrega, materialId),
      );
      const totalVendas = ents.reduce(
        (s: number, e: any) => s + calcularValoresEntrega(e).vendasMaterial,
        0,
      );
      const totalFrete = ents.reduce(
        (s: number, e: any) => s + calcularValoresEntrega(e).fretes,
        0,
      );
      return { ents, qtd: ents.length, totalVendas, totalFrete };
    },
  });

  const filtrosAtivos =
    (pagamento !== "todos" ? 1 : 0) +
    (materialId !== "todos" ? 1 : 0) +
    (clienteId !== "todos" ? 1 : 0);

  function limpar() {
    setPagamento("todos");
    setMaterialId("todos");
    setClienteId("todos");
  }

  return (
    <div className="space-y-3 pb-24">
      <h1 className="text-xl font-bold flex items-center gap-2">
        <LineChart className="h-5 w-5" /> Meu relatório mensal
      </h1>

      <Card className="border-primary/30">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-semibold">Competência mensal</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {intervaloMensal.inicioLabel} até {intervaloMensal.fimLabel}
              </div>
            </div>
            <div className="w-36 shrink-0">
              <Label htmlFor="competencia-motorista" className="sr-only">
                Competência
              </Label>
              <Input
                id="competencia-motorista"
                type="month"
                value={competencia}
                max={mesAtual}
                onChange={(event) => setCompetencia(event.target.value || mesAtual)}
              />
            </div>
          </div>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" />
            {intervaloMensal.emAberto
              ? `Em aberto. Fechamento automático em ${intervaloMensal.fechamentoLabel}.`
              : `Competência fechada em ${intervaloMensal.fechamentoLabel}.`}
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={() => setShowFiltros((s) => !s)}>
          <Filter className="h-3 w-3 mr-1" /> Filtros
          {filtrosAtivos > 0 && (
            <span className="ml-1 rounded-full bg-primary text-primary-foreground text-[10px] px-1.5">
              {filtrosAtivos}
            </span>
          )}
        </Button>
      </div>

      {showFiltros && (
        <Card>
          <CardContent className="p-3 space-y-3">
            <div>
              <Label className="text-xs">Forma de pagamento</Label>
              <Select value={pagamento} onValueChange={setPagamento}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  {PAGAMENTOS.map((p) => (
                    <SelectItem key={p.v} value={p.v}>
                      {p.l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Material</Label>
              <Select value={materialId} onValueChange={setMaterialId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {(auxQ.data?.materiais ?? []).map((m: any) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Cliente</Label>
              <Select value={clienteId} onValueChange={setClienteId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {(auxQ.data?.clientes ?? []).map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {filtrosAtivos > 0 && (
              <Button size="sm" variant="ghost" onClick={limpar} className="w-full">
                <X className="h-3 w-3 mr-1" /> Limpar filtros
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {data ? (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-3">
            <Card className="border-primary/30">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">Vendas material</div>
                <div className="mt-1 text-lg font-bold">{fmtBRL(data.totalVendas)}</div>
              </CardContent>
            </Card>
            <Card className="border-primary/30">
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground">Fretes</div>
                <div className="mt-1 text-lg font-bold">{fmtBRL(data.totalFrete)}</div>
              </CardContent>
            </Card>
          </div>
          <p className="text-center text-xs text-muted-foreground">
            {data.qtd} {data.qtd === 1 ? "entrega concluída" : "entregas concluídas"}
          </p>
        </div>
      ) : null}

      {/* Lista */}
      <div className="space-y-2">
        {isLoading && (
          <div className="text-sm text-muted-foreground text-center py-6">Carregando…</div>
        )}
        {!isLoading && data && data.ents.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-6">
            Nenhuma entrega no período/filtro.
          </div>
        )}
        {(data?.ents ?? []).map((e: any) => {
          const { vendasMaterial: venda, fretes: frete } = calcularValoresEntrega(e);
          return (
            <button key={e.id} onClick={() => setDetalheId(e.id)} className="w-full text-left">
              <Card className="active:opacity-70">
                <CardContent className="p-3 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate">
                        {e.numero != null && (
                          <span className="text-muted-foreground mr-1">#{e.numero}</span>
                        )}
                        {e.cliente?.nome ?? "—"}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {resumoMateriais(e)}
                        {e.forma_pagamento
                          ? ` · ${
                              PAGAMENTOS.find((p) => p.v === e.forma_pagamento)?.l ??
                              e.forma_pagamento
                            }`
                          : ""}
                      </div>
                    </div>
                    <div className="text-right text-xs whitespace-nowrap">
                      <div className="font-semibold">{fmtBRL(venda + frete)}</div>
                      <div className="text-muted-foreground">
                        {e.finalizada_em
                          ? new Date(e.finalizada_em).toLocaleDateString("pt-BR")
                          : ""}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </button>
          );
        })}
      </div>

      <EntregaDetalheDialog id={detalheId} onClose={() => setDetalheId(null)} />
    </div>
  );
}
