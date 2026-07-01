import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-session";
import { AdminOnly } from "@/components/role-guard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Wallet, CheckCircle2, Clock, BanknoteIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/financeiro")({
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
  permuta: "Permuta",
  boleto: "Boleto",
  carteira: "Carteira",
};

function brl(n: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);
}

function totalEntrega(e: any) {
  return Number(e.valor_praticado || 0) * Number(e.quantidade || 1) + Number(e.valor_frete || 0);
}

function Page() {
  const { data: prof } = useProfile();
  const empresaId = prof?.profile.empresa_id;
  const qc = useQueryClient();
  const [tab, setTab] = useState("a_confirmar");

  const { data: rows, isLoading } = useQuery({
    queryKey: ["financeiro", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("entregas")
        .select(`
          id, numero, status, status_pagamento, forma_pagamento,
          valor_praticado, valor_frete, quantidade,
          criada_em, finalizada_em, pagamento_confirmado_em,
          motorista_venda_id, motorista_entrega_id,
          cliente_id, clientes(nome),
          material_id, materiais(nome, unidade)
        `)
        .eq("empresa_id", empresaId)
        .not("forma_pagamento", "is", null)
        .order("criada_em", { ascending: false })
        .limit(500);
      if (error) throw error;
      const lista = data ?? [];
      const motoristaIds = Array.from(
        new Set(lista.flatMap((e: any) => [e.motorista_venda_id, e.motorista_entrega_id]).filter(Boolean))
      );
      let nomes = new Map<string, string>();
      if (motoristaIds.length) {
        const { data: profs } = await (supabase as any)
          .from("profiles").select("id, nome").in("id", motoristaIds);
        nomes = new Map((profs ?? []).map((p: any) => [p.id, p.nome]));
      }
      return lista.map((e: any) => ({
        ...e,
        motorista_venda_nome: e.motorista_venda_id ? nomes.get(e.motorista_venda_id) : null,
        motorista_entrega_nome: e.motorista_entrega_id ? nomes.get(e.motorista_entrega_id) : null,
      }));
    },
  });

  async function confirmar(id: string) {
    if (!prof) return;
    const { error } = await (supabase as any)
      .from("entregas")
      .update({
        status_pagamento: "confirmado",
        pagamento_confirmado_em: new Date().toISOString(),
        pagamento_confirmado_por: prof.profile.id,
      })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Pagamento confirmado");
    qc.invalidateQueries({ queryKey: ["financeiro", empresaId] });
  }

  async function reverter(id: string) {
    const { data: cur } = await (supabase as any)
      .from("entregas").select("forma_pagamento").eq("id", id).maybeSingle();
    const forma = cur?.forma_pagamento;
    const novoStatus = ["boleto","permuta","carteira"].includes(forma) ? "pendente" : "a_confirmar";
    const { error } = await (supabase as any)
      .from("entregas")
      .update({
        status_pagamento: novoStatus,
        pagamento_confirmado_em: null,
        pagamento_confirmado_por: null,
      })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Confirmação revertida");
    qc.invalidateQueries({ queryKey: ["financeiro", empresaId] });
  }

  const aConfirmar = (rows ?? []).filter((e: any) => e.status_pagamento === "a_confirmar");
  const pendentes = (rows ?? []).filter((e: any) => e.status_pagamento === "pendente");
  const confirmados = (rows ?? []).filter((e: any) => e.status_pagamento === "confirmado");

  const sum = (arr: any[]) => arr.reduce((s, e) => s + totalEntrega(e), 0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Wallet className="h-5 w-5" /> Financeiro
        </h1>
        <p className="text-xs text-muted-foreground">
          Confirme os recebimentos das vendas.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <SummaryCard label="A confirmar" value={brl(sum(aConfirmar))} qty={aConfirmar.length} tone="warn" />
        <SummaryCard label="Pendentes" value={brl(sum(pendentes))} qty={pendentes.length} tone="info" />
        <SummaryCard label="Recebidas" value={brl(sum(confirmados))} qty={confirmados.length} tone="ok" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="a_confirmar">A confirmar</TabsTrigger>
          <TabsTrigger value="pendente">Pendentes</TabsTrigger>
          <TabsTrigger value="confirmado">Recebidas</TabsTrigger>
        </TabsList>

        <TabsContent value="a_confirmar" className="space-y-2 pt-2">
          {isLoading && <Empty msg="Carregando..." />}
          {!isLoading && aConfirmar.length === 0 && (
            <Empty msg="Nenhuma venda aguardando confirmação." />
          )}
          {aConfirmar.map((e: any) => (
            <EntregaCard key={e.id} e={e} actionLabel="Confirmar recebimento" onAction={() => confirmar(e.id)} />
          ))}
        </TabsContent>

        <TabsContent value="pendente" className="space-y-2 pt-2">
          {!isLoading && pendentes.length === 0 && (
            <Empty msg="Nenhuma venda pendente de recebimento." />
          )}
          {pendentes.map((e: any) => (
            <EntregaCard key={e.id} e={e} actionLabel="Marcar como recebido" onAction={() => confirmar(e.id)} />
          ))}
        </TabsContent>

        <TabsContent value="confirmado" className="space-y-2 pt-2">
          {!isLoading && confirmados.length === 0 && (
            <Empty msg="Nenhum recebimento confirmado ainda." />
          )}
          {confirmados.map((e: any) => (
            <EntregaCard key={e.id} e={e} actionLabel="Reverter" onAction={() => reverter(e.id)} variant="ghost" />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SummaryCard({ label, value, qty, tone }: { label: string; value: string; qty: number; tone: "warn"|"info"|"ok" }) {
  const color = tone === "warn" ? "text-amber-600" : tone === "info" ? "text-sky-600" : "text-emerald-600";
  const Icon = tone === "ok" ? CheckCircle2 : tone === "info" ? Clock : BanknoteIcon;
  return (
    <Card>
      <CardContent className="p-3">
        <div className={`flex items-center gap-1 text-[10px] uppercase tracking-wide ${color}`}>
          <Icon className="h-3 w-3" /> {label}
        </div>
        <div className="text-sm font-bold mt-1">{value}</div>
        <div className="text-[10px] text-muted-foreground">{qty} venda(s)</div>
      </CardContent>
    </Card>
  );
}

function EntregaCard({
  e, actionLabel, onAction, variant = "default",
}: { e: any; actionLabel: string; onAction: () => void; variant?: "default" | "ghost" }) {
  const total = totalEntrega(e);
  const motorista = e.motorista_entrega_nome || e.motorista_venda_nome || "—";
  return (
    <Card>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-medium truncate">
              {e.numero != null && <span className="text-muted-foreground mr-1">#{e.numero}</span>}
              {e.clientes?.nome ?? "Cliente"}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {e.materiais?.nome ?? "—"} · {Number(e.quantidade || 1)} {e.materiais?.unidade ?? ""}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="font-bold">{brl(total)}</div>
            <Badge variant="outline" className="text-[10px]">
              {FORMA_LABEL[e.forma_pagamento] ?? e.forma_pagamento}
            </Badge>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
          <div>Motorista: <span className="text-foreground">{motorista}</span></div>
          <div>Status entrega: <span className="text-foreground">{e.status}</span></div>
          <div>Criada: {new Date(e.criada_em).toLocaleDateString("pt-BR")}</div>
          {e.pagamento_confirmado_em && (
            <div>Confirmado: {new Date(e.pagamento_confirmado_em).toLocaleDateString("pt-BR")}</div>
          )}
        </div>
        <Button size="sm" variant={variant === "ghost" ? "outline" : "default"} className="w-full" onClick={onAction}>
          {actionLabel}
        </Button>
      </CardContent>
    </Card>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div className="text-xs text-muted-foreground text-center py-6">{msg}</div>;
}
