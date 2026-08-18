import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-session";
import { AdminOnly } from "@/components/role-guard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  BanknoteIcon,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock,
  MapPin,
  Wallet,
} from "lucide-react";
import { calcularValorMateriais, obterItensEntrega, resumoMateriais } from "@/lib/entrega-itens";

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

const STATUS_ENTREGA_LABEL: Record<string, string> = {
  pendente: "Pendente",
  em_rota: "Em rota",
  entregue: "Entregue",
  cancelada: "Cancelada",
};

function brl(n: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);
}

function formatarData(data?: string | null, comHora = false) {
  if (!data) return "—";
  const valor = /^\d{4}-\d{2}-\d{2}$/.test(data) ? `${data}T00:00:00` : data;
  return new Date(valor).toLocaleString("pt-BR", comHora ? undefined : { dateStyle: "short" });
}

function hojeLocalISO() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const dia = String(hoje.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function totalEntrega(e: any) {
  return calcularValorMateriais(e) + Number(e.valor_frete || 0);
}

function Page() {
  const { data: prof } = useProfile();
  const empresaId = prof?.profile.empresa_id;
  const qc = useQueryClient();
  const [tab, setTab] = useState("a_confirmar");
  const [selecionadaId, setSelecionadaId] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["financeiro", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("entregas")
        .select(
          `
          id, numero, status, status_pagamento, forma_pagamento,
          valor_praticado, valor_frete, quantidade, itens,
          endereco, observacoes, criada_em, iniciada_em, finalizada_em,
          pagamento_confirmado_em, vencimento_pagamento,
          motorista_venda_id, motorista_entrega_id,
          cliente_id, clientes(nome),
          material_id, materiais(nome, unidade)
        `,
        )
        .eq("empresa_id", empresaId)
        .neq("status", "cancelada")
        .not("forma_pagamento", "is", null)
        .order("criada_em", { ascending: false })
        .limit(500);
      if (error) throw error;
      const lista = data ?? [];
      const motoristaIds = Array.from(
        new Set(
          lista.flatMap((e: any) => [e.motorista_venda_id, e.motorista_entrega_id]).filter(Boolean),
        ),
      );
      let nomes = new Map<string, string>();
      if (motoristaIds.length) {
        const { data: profs } = await (supabase as any)
          .from("profiles")
          .select("id, nome")
          .in("id", motoristaIds);
        nomes = new Map((profs ?? []).map((p: any) => [p.id, p.nome]));
      }
      return lista.map((e: any) => ({
        ...e,
        motorista_venda_nome: e.motorista_venda_id ? nomes.get(e.motorista_venda_id) : null,
        motorista_entrega_nome: e.motorista_entrega_id ? nomes.get(e.motorista_entrega_id) : null,
      }));
    },
  });

  const selecionada = (rows ?? []).find((e: any) => e.id === selecionadaId) ?? null;

  async function confirmar(id: string) {
    if (!prof || !empresaId) return;
    setSalvando(true);
    try {
      const { error } = await (supabase as any)
        .from("entregas")
        .update({
          status_pagamento: "confirmado",
          pagamento_confirmado_em: new Date().toISOString(),
          pagamento_confirmado_por: prof.profile.id,
        })
        .eq("id", id)
        .eq("empresa_id", empresaId)
        .neq("status", "cancelada");
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Pagamento marcado como recebido");
      setSelecionadaId(null);
      await qc.invalidateQueries({ queryKey: ["financeiro", empresaId] });
    } finally {
      setSalvando(false);
    }
  }

  async function salvarVencimento(id: string, vencimento: string) {
    if (!empresaId) return;
    if (!vencimento) {
      toast.error("Informe a data de vencimento");
      return;
    }
    setSalvando(true);
    try {
      const { error } = await (supabase as any)
        .from("entregas")
        .update({ vencimento_pagamento: vencimento })
        .eq("id", id)
        .eq("empresa_id", empresaId)
        .eq("status_pagamento", "pendente")
        .neq("status", "cancelada");
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Data de vencimento salva");
      await qc.invalidateQueries({ queryKey: ["financeiro", empresaId] });
    } finally {
      setSalvando(false);
    }
  }

  async function reverter(id: string) {
    if (!empresaId) return;
    setSalvando(true);
    try {
      const { data: cur } = await (supabase as any)
        .from("entregas")
        .select("forma_pagamento")
        .eq("id", id)
        .eq("empresa_id", empresaId)
        .maybeSingle();
      const forma = cur?.forma_pagamento;
      const novoStatus = ["boleto", "permuta", "carteira"].includes(forma)
        ? "pendente"
        : "a_confirmar";
      const { error } = await (supabase as any)
        .from("entregas")
        .update({
          status_pagamento: novoStatus,
          pagamento_confirmado_em: null,
          pagamento_confirmado_por: null,
        })
        .eq("id", id)
        .eq("empresa_id", empresaId);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Confirmação revertida");
      setSelecionadaId(null);
      await qc.invalidateQueries({ queryKey: ["financeiro", empresaId] });
    } finally {
      setSalvando(false);
    }
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
          Abra uma venda para conferir os dados e registrar o recebimento.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <SummaryCard
          label="A confirmar"
          value={brl(sum(aConfirmar))}
          qty={aConfirmar.length}
          tone="warn"
          onClick={() => setTab("a_confirmar")}
        />
        <SummaryCard
          label="Pendentes"
          value={brl(sum(pendentes))}
          qty={pendentes.length}
          tone="info"
          onClick={() => setTab("pendente")}
        />
        <SummaryCard
          label="Recebidas"
          value={brl(sum(confirmados))}
          qty={confirmados.length}
          tone="ok"
          onClick={() => setTab("confirmado")}
        />
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
            <EntregaCard key={e.id} e={e} onClick={() => setSelecionadaId(e.id)} />
          ))}
        </TabsContent>

        <TabsContent value="pendente" className="space-y-2 pt-2">
          {!isLoading && pendentes.length === 0 && (
            <Empty msg="Nenhuma venda pendente de recebimento." />
          )}
          {pendentes.map((e: any) => (
            <EntregaCard key={e.id} e={e} onClick={() => setSelecionadaId(e.id)} />
          ))}
        </TabsContent>

        <TabsContent value="confirmado" className="space-y-2 pt-2">
          {!isLoading && confirmados.length === 0 && (
            <Empty msg="Nenhum recebimento confirmado ainda." />
          )}
          {confirmados.map((e: any) => (
            <EntregaCard key={e.id} e={e} onClick={() => setSelecionadaId(e.id)} />
          ))}
        </TabsContent>
      </Tabs>

      <FinanceiroDetalheDialog
        entrega={selecionada}
        salvando={salvando}
        onClose={() => setSelecionadaId(null)}
        onConfirmar={confirmar}
        onSalvarVencimento={salvarVencimento}
        onReverter={reverter}
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  qty,
  tone,
  onClick,
}: {
  label: string;
  value: string;
  qty: number;
  tone: "warn" | "info" | "ok";
  onClick: () => void;
}) {
  const color =
    tone === "warn" ? "text-amber-600" : tone === "info" ? "text-sky-600" : "text-emerald-600";
  const Icon = tone === "ok" ? CheckCircle2 : tone === "info" ? Clock : BanknoteIcon;
  return (
    <button type="button" className="text-left" onClick={onClick} aria-label={`Ver ${label}`}>
      <Card className="h-full transition-colors hover:bg-muted/40">
        <CardContent className="p-3">
          <div className={`flex items-center gap-1 text-[10px] uppercase tracking-wide ${color}`}>
            <Icon className="h-3 w-3" /> {label}
          </div>
          <div className="text-sm font-bold mt-1">{value}</div>
          <div className="text-[10px] text-muted-foreground">{qty} venda(s)</div>
        </CardContent>
      </Card>
    </button>
  );
}

function EntregaCard({ e, onClick }: { e: any; onClick: () => void }) {
  const total = totalEntrega(e);
  const motorista = e.motorista_entrega_nome || e.motorista_venda_nome || "—";
  const vencida =
    e.status_pagamento === "pendente" &&
    e.vencimento_pagamento &&
    e.vencimento_pagamento < hojeLocalISO();

  return (
    <button
      type="button"
      className="block w-full text-left"
      onClick={onClick}
      aria-label={`Ver detalhes da venda ${e.numero ?? ""}`}
    >
      <Card className="transition-colors hover:border-primary/50 hover:bg-muted/30">
        <CardContent className="p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-medium truncate">
                {e.numero != null && (
                  <span className="text-muted-foreground mr-1">#{e.numero}</span>
                )}
                {e.clientes?.nome ?? "Cliente"}
              </div>
              <div className="text-xs text-muted-foreground truncate">{resumoMateriais(e)}</div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="text-right">
                <div className="font-bold">{brl(total)}</div>
                <Badge variant="outline" className="text-[10px]">
                  {FORMA_LABEL[e.forma_pagamento] ?? e.forma_pagamento}
                </Badge>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
            <div>
              Motorista: <span className="text-foreground">{motorista}</span>
            </div>
            <div>
              Status entrega:{" "}
              <span className="text-foreground">{STATUS_ENTREGA_LABEL[e.status] ?? e.status}</span>
            </div>
            <div>Criada: {formatarData(e.criada_em)}</div>
            {e.vencimento_pagamento && (
              <div className={vencida ? "font-medium text-destructive" : ""}>
                Vencimento: {formatarData(e.vencimento_pagamento)}
              </div>
            )}
            {e.pagamento_confirmado_em && (
              <div>Recebida: {formatarData(e.pagamento_confirmado_em)}</div>
            )}
          </div>
          <div className="text-[11px] font-medium text-primary">
            Clique para visualizar e dar baixa
          </div>
        </CardContent>
      </Card>
    </button>
  );
}

function FinanceiroDetalheDialog({
  entrega,
  salvando,
  onClose,
  onConfirmar,
  onSalvarVencimento,
  onReverter,
}: {
  entrega: any | null;
  salvando: boolean;
  onClose: () => void;
  onConfirmar: (id: string) => Promise<void>;
  onSalvarVencimento: (id: string, vencimento: string) => Promise<void>;
  onReverter: (id: string) => Promise<void>;
}) {
  const [vencimento, setVencimento] = useState("");

  useEffect(() => {
    setVencimento(entrega?.vencimento_pagamento ?? "");
  }, [entrega?.id, entrega?.vencimento_pagamento]);

  if (!entrega) return null;

  const itens = obterItensEntrega(entrega);
  const forma = FORMA_LABEL[entrega.forma_pagamento] ?? entrega.forma_pagamento ?? "—";

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {entrega.numero != null && (
              <span className="text-muted-foreground mr-1">#{entrega.numero}</span>
            )}
            {entrega.clientes?.nome ?? "Venda"}
          </DialogTitle>
          <DialogDescription>
            Confira as informações lançadas antes de registrar a baixa.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border bg-muted/30 p-3">
          <div className="text-xs text-muted-foreground">Valor total</div>
          <div className="text-2xl font-bold">{brl(totalEntrega(entrega))}</div>
          <div className="mt-1 flex flex-wrap gap-2">
            <Badge variant="outline">{forma}</Badge>
            <Badge variant="secondary">
              {entrega.status_pagamento === "confirmado"
                ? "Recebida"
                : entrega.status_pagamento === "pendente"
                  ? "Pendente"
                  : "A confirmar"}
            </Badge>
          </div>
        </div>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Itens da venda</h3>
          {itens.map((item, index) => {
            const quantidade = Number(item.quantidade || 0);
            const valor = Number(item.valor_praticado || 0);
            return (
              <div key={`${item.material_id}-${index}`} className="rounded-lg border p-3 text-sm">
                <div className="font-medium">{item.nome || `Material ${index + 1}`}</div>
                <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <span className="text-muted-foreground">Quantidade</span>
                  <span className="text-right">
                    {quantidade.toLocaleString("pt-BR")} {item.unidade ?? ""}
                  </span>
                  <span className="text-muted-foreground">Valor unitário</span>
                  <span className="text-right">{brl(valor)}</span>
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="text-right font-medium">{brl(quantidade * valor)}</span>
                </div>
              </div>
            );
          })}
          <DetailRow label="Frete" value={brl(Number(entrega.valor_frete || 0))} />
        </section>

        <section className="space-y-1">
          <h3 className="pb-1 text-sm font-semibold">Informações da venda</h3>
          <DetailRow label="Cliente" value={entrega.clientes?.nome} />
          <DetailRow label="Forma de pagamento" value={forma} />
          <DetailRow
            label="Status da entrega"
            value={STATUS_ENTREGA_LABEL[entrega.status] ?? entrega.status}
          />
          <DetailRow label="Motorista da venda" value={entrega.motorista_venda_nome} />
          <DetailRow label="Motorista da entrega" value={entrega.motorista_entrega_nome} />
          <DetailRow label="Criada em" value={formatarData(entrega.criada_em, true)} />
          <DetailRow label="Iniciada em" value={formatarData(entrega.iniciada_em, true)} />
          <DetailRow label="Finalizada em" value={formatarData(entrega.finalizada_em, true)} />
          {entrega.endereco && (
            <DetailRow
              label="Endereço"
              value={
                <span className="inline-flex items-start justify-end gap-1">
                  <MapPin className="mt-0.5 h-3 w-3 shrink-0" /> {entrega.endereco}
                </span>
              }
            />
          )}
          {entrega.observacoes && <DetailRow label="Observações" value={entrega.observacoes} />}
          {entrega.pagamento_confirmado_em && (
            <DetailRow
              label="Recebida em"
              value={formatarData(entrega.pagamento_confirmado_em, true)}
            />
          )}
        </section>

        {entrega.status_pagamento === "pendente" && (
          <div className="space-y-3 rounded-xl border border-sky-500/30 bg-sky-500/5 p-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <CalendarClock className="h-4 w-4 text-sky-600" /> Vencimento do pagamento
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vencimento-pagamento">Data de vencimento</Label>
              <Input
                id="vencimento-pagamento"
                type="date"
                value={vencimento}
                onChange={(event) => setVencimento(event.target.value)}
                disabled={salvando}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={salvando || !vencimento}
              onClick={() => onSalvarVencimento(entrega.id, vencimento)}
            >
              {salvando ? "Salvando..." : "Salvar vencimento"}
            </Button>
          </div>
        )}

        {entrega.status_pagamento !== "confirmado" ? (
          <Button
            type="button"
            className="w-full"
            disabled={salvando}
            onClick={() => onConfirmar(entrega.id)}
          >
            <CheckCircle2 className="h-4 w-4" />
            {salvando ? "Salvando..." : "Marcar como recebido"}
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={salvando}
            onClick={() => onReverter(entrega.id)}
          >
            {salvando ? "Salvando..." : "Reverter recebimento"}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b py-1.5 text-sm last:border-0">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="break-words text-right font-medium">{value || "—"}</span>
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div className="text-xs text-muted-foreground text-center py-6">{msg}</div>;
}
