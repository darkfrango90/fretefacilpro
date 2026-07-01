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
import { LineChart, Filter, X } from "lucide-react";
import { EntregaDetalheDialog } from "@/components/entrega-detalhe-dialog";

export const Route = createFileRoute("/_authenticated/relatorios-motorista")({
  component: Page,
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

function fmtBRL(v: number) {
  return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function Page() {
  const { data: profile } = useProfile();
  const uid = profile?.profile.id;
  const empresaId = profile?.profile.empresa_id;

  const [periodo, setPeriodo] = useState<Periodo>("30");
  const [dataIni, setDataIni] = useState<string>("");
  const [dataFim, setDataFim] = useState<string>("");
  const [pagamento, setPagamento] = useState<string>("todos");
  const [materialId, setMaterialId] = useState<string>("todos");
  const [clienteId, setClienteId] = useState<string>("todos");
  const [showFiltros, setShowFiltros] = useState(false);
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

  // listas auxiliares (materiais e clientes da empresa)
  const auxQ = useQuery({
    queryKey: ["relatorio-motorista-aux", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const [matR, cliR] = await Promise.all([
        (supabase as any).from("materiais").select("id, nome").eq("empresa_id", empresaId).order("nome"),
        (supabase as any).from("clientes").select("id, nome").eq("empresa_id", empresaId).order("nome"),
      ]);
      return { materiais: matR.data ?? [], clientes: cliR.data ?? [] };
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["relatorio-motorista", uid, sinceIso, untilIso, pagamento, materialId, clienteId],
    enabled: !!uid,
    queryFn: async () => {
      let q = (supabase as any)
        .from("entregas")
        .select(
          "id, numero, criada_em, finalizada_em, status, quantidade, valor_praticado, valor_frete, forma_pagamento, cliente_id, material_id, cliente:clientes(nome), material:materiais(nome, unidade)",
        )
        .eq("status", "entregue")
        .eq("motorista_entrega_id", uid)
        .order("finalizada_em", { ascending: false });

      if (sinceIso) q = q.gte("finalizada_em", sinceIso);
      if (untilIso) q = q.lte("finalizada_em", untilIso);
      if (pagamento !== "todos") q = q.eq("forma_pagamento", pagamento);
      if (materialId !== "todos") q = q.eq("material_id", materialId);
      if (clienteId !== "todos") q = q.eq("cliente_id", clienteId);

      const { data: rows, error } = await q.limit(500);
      if (error) throw error;
      const ents = rows ?? [];
      const totalVendas = ents.reduce(
        (s: number, e: any) => s + Number(e.valor_praticado || 0) * Number(e.quantidade || 1),
        0,
      );
      const totalFrete = ents.reduce((s: number, e: any) => s + Number(e.valor_frete || 0), 0);
      return { ents, qtd: ents.length, totalVendas, totalFrete };
    },
  });

  const filtrosAtivos =
    (periodo === "custom" ? (dataIni || dataFim ? 1 : 0) : 0) +
    (pagamento !== "todos" ? 1 : 0) +
    (materialId !== "todos" ? 1 : 0) +
    (clienteId !== "todos" ? 1 : 0);

  function limpar() {
    setPeriodo("30");
    setDataIni("");
    setDataFim("");
    setPagamento("todos");
    setMaterialId("todos");
    setClienteId("todos");
  }

  return (
    <div className="space-y-3 pb-24">
      <h1 className="text-xl font-bold flex items-center gap-2">
        <LineChart className="h-5 w-5" /> Meus relatórios
      </h1>

      {/* Período rápido */}
      <div className="flex gap-1 flex-wrap">
        {(["7", "30", "90", "365"] as Periodo[]).map((p) => (
          <Button
            key={p}
            size="sm"
            variant={periodo === p ? "default" : "outline"}
            onClick={() => setPeriodo(p)}
          >
            {p === "365" ? "1 ano" : `${p} dias`}
          </Button>
        ))}
        <Button
          size="sm"
          variant={periodo === "custom" ? "default" : "outline"}
          onClick={() => setPeriodo("custom")}
        >
          Personalizado
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowFiltros((s) => !s)}
          className="ml-auto"
        >
          <Filter className="h-3 w-3 mr-1" /> Filtros
          {filtrosAtivos > 0 && (
            <span className="ml-1 rounded-full bg-primary text-primary-foreground text-[10px] px-1.5">
              {filtrosAtivos}
            </span>
          )}
        </Button>
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
          const venda = Number(e.valor_praticado || 0) * Number(e.quantidade || 1);
          const frete = Number(e.valor_frete || 0);
          return (
            <button
              key={e.id}
              onClick={() => setDetalheId(e.id)}
              className="w-full text-left"
            >
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
                        {e.material?.nome} · {e.quantidade} {e.material?.unidade}
                        {e.forma_pagamento ? ` · ${
                          PAGAMENTOS.find((p) => p.v === e.forma_pagamento)?.l ?? e.forma_pagamento
                        }` : ""}
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

      {/* Totais */}
      {data && (
        <Card className="sticky bottom-16 border-primary/40">
          <CardContent className="p-3 space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Totais do filtro
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Nº de entregas</span>
              <span className="font-semibold">{data.qtd}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Valor de vendas</span>
              <span className="font-semibold">{fmtBRL(data.totalVendas)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Valor de frete</span>
              <span className="font-semibold">{fmtBRL(data.totalFrete)}</span>
            </div>
            <div className="flex justify-between text-sm border-t pt-1 mt-1">
              <span className="text-muted-foreground">Total geral</span>
              <span className="font-bold text-primary">
                {fmtBRL(data.totalVendas + data.totalFrete)}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <EntregaDetalheDialog id={detalheId} onClose={() => setDetalheId(null)} />
    </div>
  );
}
