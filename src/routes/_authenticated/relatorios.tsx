import { createFileRoute } from "@tanstack/react-router";
import { AdminOnly } from "@/components/role-guard";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { BarChart3, Download, Filter, X } from "lucide-react";
import { EntregaDetalheDialog } from "@/components/entrega-detalhe-dialog";

export const Route = createFileRoute("/_authenticated/relatorios")({
  component: () => (
    <AdminOnly>
      <Page />
    </AdminOnly>
  ),
});

type Periodo = "7" | "30" | "90" | "365" | "custom";

const PAGAMENTOS = [
  { v: "dinheiro", l: "Dinheiro" },
  { v: "pix", l: "Pix" },
  { v: "deposito", l: "Depósito" },
  { v: "boleto", l: "Boleto" },
  { v: "permuta", l: "Permuta" },
  { v: "carteira", l: "Carteira" },
];

function Page() {
  const { data: profile } = useProfile();
  const empresaId = profile?.profile.empresa_id;
  const [periodo, setPeriodo] = useState<Periodo>("30");
  const [dataIni, setDataIni] = useState<string>("");
  const [dataFim, setDataFim] = useState<string>("");
  const [pagamento, setPagamento] = useState<string>("todos");
  const [materialId, setMaterialId] = useState<string>("todos");
  const [motoristaId, setMotoristaId] = useState<string>("todos");
  const [clienteId, setClienteId] = useState<string>("todos");
  const [numero, setNumero] = useState<string>("");
  const [showFiltros, setShowFiltros] = useState<boolean>(false);
  const [detalheId, setDetalheId] = useState<string | null>(null);

  const { sinceIso, untilIso } = useMemo(() => {
    if (periodo === "custom") {
      const ini = dataIni ? new Date(dataIni + "T00:00:00").toISOString() : "";
      const fim = dataFim ? new Date(dataFim + "T23:59:59").toISOString() : "";
      return { sinceIso: ini, untilIso: fim };
    }
    const d = new Date();
    d.setDate(d.getDate() - Number(periodo));
    return { sinceIso: d.toISOString(), untilIso: "" };
  }, [periodo, dataIni, dataFim]);

  const { data, isLoading } = useQuery({
    queryKey: ["relatorios", empresaId, periodo, sinceIso, untilIso, pagamento, materialId, motoristaId, clienteId, numero],
    enabled: !!empresaId,
    queryFn: async () => {
      let qEnt = (supabase as any)
        .from("entregas")
        .select(
          "id, numero, criada_em, finalizada_em, status, quantidade, valor_praticado, valor_frete, motorista_venda_id, motorista_entrega_id, material_id, cliente_id, veiculo_id, forma_pagamento",
        );
      let qAb = (supabase as any)
        .from("abastecimentos")
        .select("valor_total, litros, km_atual, veiculo_id, data_hora");

      if (sinceIso) {
        qEnt = qEnt.gte("criada_em", sinceIso);
        qAb = qAb.gte("data_hora", sinceIso);
      }
      if (untilIso) {
        qEnt = qEnt.lte("criada_em", untilIso);
        qAb = qAb.lte("data_hora", untilIso);
      }
      if (pagamento !== "todos") qEnt = qEnt.eq("forma_pagamento", pagamento);
      if (materialId !== "todos") qEnt = qEnt.eq("material_id", materialId);
      if (clienteId !== "todos") qEnt = qEnt.eq("cliente_id", clienteId);
      if (motoristaId !== "todos") {
        qEnt = qEnt.or(
          `motorista_venda_id.eq.${motoristaId},motorista_entrega_id.eq.${motoristaId}`,
        );
      }
      if (numero.trim()) {
        const n = parseInt(numero.trim(), 10);
        if (!isNaN(n)) qEnt = qEnt.eq("numero", n);
      }

      const [entR, abR, profR, vR, matR, cliR] = await Promise.all([
        qEnt,
        qAb,
        (supabase as any).from("profiles").select("id, nome").eq("empresa_id", empresaId),
        (supabase as any).from("veiculos").select("id, placa, descricao").eq("empresa_id", empresaId),
        (supabase as any).from("materiais").select("id, nome, unidade").eq("empresa_id", empresaId),
        (supabase as any).from("clientes").select("id, nome").eq("empresa_id", empresaId),
      ]);

      const ents = entR.data ?? [];
      const abs = abR.data ?? [];
      const nameProfile = new Map<string, string>((profR.data ?? []).map((p: any) => [p.id, p.nome]));
      const labelVeic = new Map<string, string>(
        (vR.data ?? []).map((v: any) => [v.id, v.placa + (v.descricao ? ` · ${v.descricao}` : "")]),
      );
      const nameMat = new Map<string, string>((matR.data ?? []).map((m: any) => [m.id, m.nome]));
      const nameCli = new Map<string, string>((cliR.data ?? []).map((c: any) => [c.id, c.nome]));

      const total = ents.length;
      const finalizadas = ents.filter((e: any) => e.status === "entregue").length;
      const canceladas = ents.filter((e: any) => e.status === "cancelada").length;
      const emRota = ents.filter((e: any) => e.status === "em_rota").length;
      const pendentes = ents.filter((e: any) => e.status === "pendente").length;
      const receitaProduto = ents.reduce(
        (s: number, e: any) => s + Number(e.valor_praticado || 0) * Number(e.quantidade || 1),
        0,
      );
      const receitaFrete = ents.reduce((s: number, e: any) => s + Number(e.valor_frete || 0), 0);
      const totalReceita = receitaProduto + receitaFrete;
      const ticketMedio = total > 0 ? totalReceita / total : 0;
      const taxaConversao = total > 0 ? (finalizadas / total) * 100 : 0;

      const gastoCombustivel = abs.reduce((s: number, a: any) => s + Number(a.valor_total || 0), 0);
      const litrosTotais = abs.reduce((s: number, a: any) => s + Number(a.litros || 0), 0);
      const margemBruta = totalReceita - gastoCombustivel;

      const porMot = new Map<string, { qtd: number; receita: number }>();
      for (const e of ents) {
        if (e.status !== "entregue") continue;
        const id = e.motorista_entrega_id || e.motorista_venda_id;
        if (!id) continue;
        const cur = porMot.get(id) ?? { qtd: 0, receita: 0 };
        cur.qtd += 1;
        cur.receita += Number(e.valor_praticado || 0) * Number(e.quantidade || 1) + Number(e.valor_frete || 0);
        porMot.set(id, cur);
      }
      const rankingMotoristas = Array.from(porMot.entries())
        .map(([id, v]) => ({ id, nome: nameProfile.get(id) ?? "—", ...v }))
        .sort((a, b) => b.qtd - a.qtd);

      const porCli = new Map<string, { qtd: number; receita: number }>();
      for (const e of ents) {
        const cur = porCli.get(e.cliente_id) ?? { qtd: 0, receita: 0 };
        cur.qtd += 1;
        cur.receita += Number(e.valor_praticado || 0) * Number(e.quantidade || 1) + Number(e.valor_frete || 0);
        porCli.set(e.cliente_id, cur);
      }
      const topClientes = Array.from(porCli.entries())
        .map(([id, v]) => ({ id, nome: nameCli.get(id) ?? "—", ...v }))
        .sort((a, b) => b.receita - a.receita)
        .slice(0, 10);

      const porMat = new Map<string, { qtd: number; receita: number }>();
      for (const e of ents) {
        const cur = porMat.get(e.material_id) ?? { qtd: 0, receita: 0 };
        cur.qtd += Number(e.quantidade || 1);
        cur.receita += Number(e.valor_praticado || 0) * Number(e.quantidade || 1);
        porMat.set(e.material_id, cur);
      }
      const topMateriais = Array.from(porMat.entries())
        .map(([id, v]) => ({ id, nome: nameMat.get(id) ?? "—", ...v }))
        .sort((a, b) => b.receita - a.receita);

      const porPag = new Map<string, { qtd: number; receita: number }>();
      for (const e of ents) {
        const k = e.forma_pagamento || "—";
        const cur = porPag.get(k) ?? { qtd: 0, receita: 0 };
        cur.qtd += 1;
        cur.receita += Number(e.valor_praticado || 0) * Number(e.quantidade || 1) + Number(e.valor_frete || 0);
        porPag.set(k, cur);
      }
      const porPagamento = Array.from(porPag.entries())
        .map(([k, v]) => ({ id: k, nome: PAGAMENTOS.find((p) => p.v === k)?.l ?? k, ...v }))
        .sort((a, b) => b.receita - a.receita);

      const porVeic = new Map<
        string,
        { litros: number; valor: number; kmMin: number; kmMax: number; absCount: number }
      >();
      for (const a of abs) {
        if (!a.veiculo_id) continue;
        const cur = porVeic.get(a.veiculo_id) ?? {
          litros: 0,
          valor: 0,
          kmMin: Number.POSITIVE_INFINITY,
          kmMax: 0,
          absCount: 0,
        };
        cur.litros += Number(a.litros || 0);
        cur.valor += Number(a.valor_total || 0);
        cur.absCount += 1;
        const km = Number(a.km_atual || 0);
        if (km > 0) {
          cur.kmMin = Math.min(cur.kmMin, km);
          cur.kmMax = Math.max(cur.kmMax, km);
        }
        porVeic.set(a.veiculo_id, cur);
      }
      const consumoVeiculos = Array.from(porVeic.entries())
        .map(([id, v]) => {
          const kmRodado = v.kmMax > 0 && v.kmMin !== Number.POSITIVE_INFINITY ? v.kmMax - v.kmMin : 0;
          return {
            id,
            label: labelVeic.get(id) ?? "—",
            litros: v.litros,
            valor: v.valor,
            kmRodado,
            kmL: v.litros > 0 && kmRodado > 0 ? kmRodado / v.litros : 0,
            rsKm: kmRodado > 0 ? v.valor / kmRodado : 0,
            absCount: v.absCount,
          };
        })
        .sort((a, b) => b.kmRodado - a.kmRodado);

      const porDia = new Map<string, { qtd: number; receita: number }>();
      for (const e of ents) {
        const d = (e.criada_em as string).slice(0, 10);
        const cur = porDia.get(d) ?? { qtd: 0, receita: 0 };
        cur.qtd += 1;
        cur.receita += Number(e.valor_praticado || 0) * Number(e.quantidade || 1) + Number(e.valor_frete || 0);
        porDia.set(d, cur);
      }
      const serieDiaria = Array.from(porDia.entries())
        .map(([dia, v]) => ({ dia, ...v }))
        .sort((a, b) => a.dia.localeCompare(b.dia));

      const vendas = ents
        .map((e: any) => ({
          id: e.id,
          numero: e.numero,
          criada_em: e.criada_em,
          status: e.status,
          cliente: nameCli.get(e.cliente_id) ?? "—",
          material: nameMat.get(e.material_id) ?? "—",
          motorista:
            nameProfile.get(e.motorista_entrega_id) ??
            nameProfile.get(e.motorista_venda_id) ??
            "—",
          forma_pagamento: e.forma_pagamento,
          total:
            Number(e.valor_praticado || 0) * Number(e.quantidade || 1) +
            Number(e.valor_frete || 0),
        }))
        .sort((a: any, b: any) => (a.criada_em < b.criada_em ? 1 : -1));

      return {
        total,
        finalizadas,
        canceladas,
        emRota,
        pendentes,
        totalReceita,
        receitaProduto,
        receitaFrete,
        ticketMedio,
        taxaConversao,
        gastoCombustivel,
        litrosTotais,
        margemBruta,
        rankingMotoristas,
        topClientes,
        topMateriais,
        porPagamento,
        consumoVeiculos,
        serieDiaria,
        vendas,
        listaMateriais: matR.data ?? [],
        listaMotoristas: profR.data ?? [],
        listaClientes: cliR.data ?? [],
      };
    },
  });

  function limparFiltros() {
    setPagamento("todos");
    setMaterialId("todos");
    setMotoristaId("todos");
    setClienteId("todos");
    setNumero("");
    setPeriodo("30");
    setDataIni("");
    setDataFim("");
  }

  const filtrosAtivos =
    (pagamento !== "todos" ? 1 : 0) +
    (materialId !== "todos" ? 1 : 0) +
    (motoristaId !== "todos" ? 1 : 0) +
    (clienteId !== "todos" ? 1 : 0) +
    (numero.trim() ? 1 : 0) +
    (periodo === "custom" ? 1 : 0);

  function exportCsv() {
    if (!data) return;
    const lines: string[] = [];
    lines.push("Relatório geral");
    lines.push(`Período,${periodo === "custom" ? `${dataIni} a ${dataFim}` : periodo + " dias"}`);
    lines.push(`Total vendas,${data.total}`);
    lines.push(`Receita total,${data.totalReceita.toFixed(2)}`);
    lines.push(`Ticket médio,${data.ticketMedio.toFixed(2)}`);
    lines.push(`Combustível,${data.gastoCombustivel.toFixed(2)}`);
    lines.push(`Margem bruta,${data.margemBruta.toFixed(2)}`);
    lines.push("");
    lines.push("Nº,Data,Cliente,Material,Motorista,Pagamento,Status,Total");
    for (const v of data.vendas) {
      lines.push(
        `${v.numero ?? ""},${csv(fmtData(v.criada_em))},${csv(v.cliente)},${csv(v.material)},${csv(v.motorista)},${csv(v.forma_pagamento ?? "")},${csv(v.status)},${v.total.toFixed(2)}`,
      );
    }
    lines.push("");
    lines.push("Motorista,Entregas,Receita");
    for (const m of data.rankingMotoristas) lines.push(`${csv(m.nome)},${m.qtd},${m.receita.toFixed(2)}`);
    lines.push("");
    lines.push("Cliente,Pedidos,Receita");
    for (const c of data.topClientes) lines.push(`${csv(c.nome)},${c.qtd},${c.receita.toFixed(2)}`);
    lines.push("");
    lines.push("Material,Quantidade,Receita");
    for (const m of data.topMateriais) lines.push(`${csv(m.nome)},${m.qtd},${m.receita.toFixed(2)}`);
    lines.push("");
    lines.push("Pagamento,Vendas,Receita");
    for (const p of data.porPagamento) lines.push(`${csv(p.nome)},${p.qtd},${p.receita.toFixed(2)}`);

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" /> Relatórios
          </h1>
          <p className="text-xs text-muted-foreground">Métricas da empresa no período</p>
        </div>
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={!data}>
          <Download className="h-4 w-4 mr-1" /> CSV
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        {(["7", "30", "90", "365"] as Periodo[]).map((p) => (
          <Button
            key={p}
            size="sm"
            variant={periodo === p ? "default" : "outline"}
            onClick={() => setPeriodo(p)}
          >
            {p === "365" ? "12 meses" : `${p} dias`}
          </Button>
        ))}
        <Button
          size="sm"
          variant={periodo === "custom" ? "default" : "outline"}
          onClick={() => setPeriodo("custom")}
        >
          Período
        </Button>
        <Button
          size="sm"
          variant={showFiltros || filtrosAtivos > 0 ? "default" : "outline"}
          onClick={() => setShowFiltros((s) => !s)}
        >
          <Filter className="h-4 w-4 mr-1" />
          Filtros{filtrosAtivos > 0 ? ` (${filtrosAtivos})` : ""}
        </Button>
        {filtrosAtivos > 0 && (
          <Button size="sm" variant="ghost" onClick={limparFiltros}>
            <X className="h-4 w-4 mr-1" /> Limpar
          </Button>
        )}
      </div>

      {periodo === "custom" && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">De</Label>
            <Input type="date" value={dataIni} onChange={(e) => setDataIni(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Até</Label>
            <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
          </div>
        </div>
      )}

      {showFiltros && (
        <Card>
          <CardContent className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Nº da venda</Label>
              <Input
                inputMode="numeric"
                placeholder="Ex.: 12"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Forma de pagamento</Label>
              <Select value={pagamento} onValueChange={setPagamento}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  {PAGAMENTOS.map((p) => (
                    <SelectItem key={p.v} value={p.v}>{p.l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Material</Label>
              <Select value={materialId} onValueChange={setMaterialId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {(data?.listaMateriais ?? []).map((m: any) => (
                    <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Motorista</Label>
              <Select value={motoristaId} onValueChange={setMotoristaId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {(data?.listaMotoristas ?? []).map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Cliente</Label>
              <Select value={clienteId} onValueChange={setClienteId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {(data?.listaClientes ?? []).map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading && <div className="text-sm text-muted-foreground">Carregando…</div>}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Mini label="Vendas" value={data.total} />
            <Mini label="Finalizadas" value={data.finalizadas} />
            <Mini label="Em rota" value={data.emRota} />
            <Mini label="Pendentes" value={data.pendentes} />
            <Mini label="Canceladas" value={data.canceladas} />
            <Mini label="Conversão" value={`${data.taxaConversao.toFixed(1)}%`} />
            <Mini label="Receita total" value={brl(data.totalReceita)} />
            <Mini label="Ticket médio" value={brl(data.ticketMedio)} />
            <Mini label="Receita produto" value={brl(data.receitaProduto)} />
            <Mini label="Receita frete" value={brl(data.receitaFrete)} />
            <Mini label="Combustível" value={brl(data.gastoCombustivel)} />
            <Mini label="Litros" value={`${data.litrosTotais.toFixed(0)} L`} />
            <Mini label="Margem bruta" value={brl(data.margemBruta)} />
          </div>

          <Section title={`Vendas (${data.vendas.length})`}>
            {data.vendas.length === 0 && <Empty />}
            {data.vendas.slice(0, 100).map((v: any) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setDetalheId(v.id)}
                className="w-full text-left border rounded-lg p-2 text-sm hover:bg-accent active:opacity-70"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold">#{v.numero ?? "—"} · {v.cliente}</div>
                  <div className="font-bold">{brl(v.total)}</div>
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {fmtData(v.criada_em)} · {v.material} · {v.motorista} · {v.forma_pagamento ?? "—"} · {v.status}
                </div>
              </button>
            ))}
            {data.vendas.length > 100 && (
              <div className="text-xs text-muted-foreground">
                Mostrando 100 de {data.vendas.length}. Exporte CSV para ver tudo.
              </div>
            )}
          </Section>

          <Section title="Por forma de pagamento">
            {data.porPagamento.length === 0 && <Empty />}
            {data.porPagamento.map((p: any, i: number) => (
              <Row key={p.id} idx={i + 1} title={p.nome} sub={`${p.qtd} vendas`} value={brl(p.receita)} />
            ))}
          </Section>

          <Section title="Ranking de motoristas">
            {data.rankingMotoristas.length === 0 && <Empty />}
            {data.rankingMotoristas.map((m: any, i: number) => (
              <Row key={m.id} idx={i + 1} title={m.nome} sub={`${m.qtd} entregas`} value={brl(m.receita)} />
            ))}
          </Section>

          <Section title="Top clientes">
            {data.topClientes.length === 0 && <Empty />}
            {data.topClientes.map((c: any, i: number) => (
              <Row key={c.id} idx={i + 1} title={c.nome} sub={`${c.qtd} pedidos`} value={brl(c.receita)} />
            ))}
          </Section>

          <Section title="Materiais mais vendidos">
            {data.topMateriais.length === 0 && <Empty />}
            {data.topMateriais.map((m: any, i: number) => (
              <Row
                key={m.id}
                idx={i + 1}
                title={m.nome}
                sub={`${m.qtd.toLocaleString("pt-BR")} un.`}
                value={brl(m.receita)}
              />
            ))}
          </Section>

          <Section title="Consumo por caminhão">
            {data.consumoVeiculos.length === 0 && <Empty />}
            {data.consumoVeiculos.map((v: any) => (
              <div key={v.id} className="border rounded-lg p-2 text-sm">
                <div className="font-medium truncate">{v.label}</div>
                <div className="grid grid-cols-4 gap-2 text-xs text-muted-foreground mt-1">
                  <div>
                    <div className="text-foreground font-semibold">{v.kmRodado.toLocaleString("pt-BR")}</div>
                    km
                  </div>
                  <div>
                    <div className="text-foreground font-semibold">{v.kmL ? v.kmL.toFixed(2) : "—"}</div>
                    km/L
                  </div>
                  <div>
                    <div className="text-foreground font-semibold">{v.rsKm ? brl(v.rsKm) : "—"}</div>
                    R$/km
                  </div>
                  <div>
                    <div className="text-foreground font-semibold">{v.litros.toFixed(0)} L</div>
                    {brl(v.valor)}
                  </div>
                </div>
              </div>
            ))}
          </Section>

          <Section title="Vendas por dia">
            {data.serieDiaria.length === 0 && <Empty />}
            {data.serieDiaria.map((d: any) => (
              <Row key={d.dia} title={fmtDia(d.dia)} sub={`${d.qtd} vendas`} value={brl(d.receita)} />
            ))}
          </Section>
        </>
      )}

      <EntregaDetalheDialog id={detalheId} onClose={() => setDetalheId(null)} />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">{children}</CardContent>
    </Card>
  );
}

function Mini({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-base font-bold mt-1">{value}</div>
    </div>
  );
}

function Row({ idx, title, sub, value }: { idx?: number; title: string; sub?: string; value?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <div className="flex items-center gap-2 min-w-0">
        {idx != null && <span className="w-5 text-xs text-muted-foreground">#{idx}</span>}
        <div className="min-w-0">
          <div className="truncate">{title}</div>
          {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
        </div>
      </div>
      {value && <span className="font-semibold whitespace-nowrap">{value}</span>}
    </div>
  );
}

function Empty() {
  return <div className="text-xs text-muted-foreground">Sem dados no período.</div>;
}

function brl(n?: number) {
  if (n == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

function fmtDia(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

function fmtData(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function csv(s: string) {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
