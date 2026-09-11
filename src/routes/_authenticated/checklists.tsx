import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, ClipboardCheck, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AdminOnly } from "@/components/role-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useProfile } from "@/hooks/use-session";
import {
  contarRespostas,
  descreverSemana,
  rotuloResposta,
  segundaDaSemana,
  somarDias,
  type ChecklistRegistro,
} from "@/lib/checklist-semanal";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/checklists")({
  component: () => (
    <AdminOnly>
      <ChecklistsAdmin />
    </AdminOnly>
  ),
});

type LinhaMotorista = {
  id: string;
  nome: string;
  checklist: (ChecklistRegistro & { motorista_id: string }) | null;
};

const COR_RESPOSTA: Record<string, string> = {
  otima: "bg-emerald-100 text-emerald-800",
  nao_verificado: "bg-amber-100 text-amber-800",
  ruim: "bg-red-100 text-red-800",
};

function fmtDataHora(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ChecklistsAdmin() {
  const { data: prof } = useProfile();
  const empresaId = prof?.profile.empresa_id;
  const semanaAtual = segundaDaSemana();
  const [semana, setSemana] = useState(semanaAtual);
  const [detalhe, setDetalhe] = useState<LinhaMotorista | null>(null);
  const ehSemanaAtual = semana === semanaAtual;

  const { data: motoristas, isLoading: carregandoMotoristas } = useQuery({
    queryKey: ["checklists-motoristas", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data: roles, error: erroRoles } = await (supabase as any)
        .from("user_roles")
        .select("user_id")
        .eq("empresa_id", empresaId)
        .eq("role", "motorista");
      if (erroRoles) throw erroRoles;
      const ids = (roles ?? []).map((r: any) => r.user_id);
      if (!ids.length) return [];
      const { data, error } = await (supabase as any)
        .from("profiles")
        .select("id, nome, ativo")
        .in("id", ids)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as { id: string; nome: string; ativo: boolean }[];
    },
  });

  const { data: checklists, isLoading: carregandoChecklists } = useQuery({
    queryKey: ["checklists-semana", empresaId, semana],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("checklists_semanais")
        .select("id, motorista_id, semana, respostas, observacoes, preenchido_em")
        .eq("empresa_id", empresaId)
        .eq("semana", semana);
      if (error) throw error;
      return (data ?? []) as (ChecklistRegistro & { motorista_id: string })[];
    },
  });

  const linhas = useMemo<LinhaMotorista[]>(() => {
    const porMotorista = new Map((checklists ?? []).map((c) => [c.motorista_id, c]));
    // Motoristas ativos sempre aparecem; inativos só se enviaram nesta semana.
    return (motoristas ?? [])
      .filter((m) => m.ativo || porMotorista.has(m.id))
      .map((m) => ({ id: m.id, nome: m.nome, checklist: porMotorista.get(m.id) ?? null }));
  }, [motoristas, checklists]);

  const enviados = linhas.filter((l) => l.checklist).length;
  const itensRuins = linhas.reduce(
    (soma, l) => soma + contarRespostas(l.checklist?.respostas).ruim,
    0,
  );
  const carregando = carregandoMotoristas || carregandoChecklists;

  return (
    <div className="space-y-4 pb-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <ClipboardCheck className="h-5 w-5" /> Checklists semanais
          </h1>
          <p className="text-sm text-muted-foreground">
            Checklist obrigatório de cada motorista, cobrado a partir de segunda-feira.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="outline"
            aria-label="Semana anterior"
            onClick={() => setSemana((s) => somarDias(s, -7))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 text-center text-sm font-medium md:min-w-[13rem] md:flex-none">
            {descreverSemana(semana)}
          </div>
          <Button
            size="icon"
            variant="outline"
            aria-label="Próxima semana"
            disabled={ehSemanaAtual}
            onClick={() => setSemana((s) => somarDias(s, 7))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          {!ehSemanaAtual && (
            <Button size="sm" variant="ghost" onClick={() => setSemana(semanaAtual)}>
              Semana atual
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Resumo titulo="Motoristas" valor={linhas.length} />
        <Resumo titulo="Enviados" valor={enviados} tom="text-emerald-700" />
        <Resumo
          titulo={ehSemanaAtual ? "Pendentes" : "Não feitos"}
          valor={linhas.length - enviados}
          tom={linhas.length - enviados > 0 ? "text-amber-700" : undefined}
        />
        <Resumo
          titulo="Itens marcados Ruim"
          valor={itensRuins}
          tom={itensRuins > 0 ? "text-red-700" : undefined}
        />
      </div>

      <div className="space-y-2 md:hidden">
        {carregando && <div className="text-sm text-muted-foreground">Carregando…</div>}
        {!carregando && linhas.length === 0 && (
          <div className="text-sm text-muted-foreground">Nenhum motorista cadastrado.</div>
        )}
        {!carregando &&
          linhas.map((linha) => {
            const totais = contarRespostas(linha.checklist?.respostas);
            return (
              <Card key={linha.id}>
                <CardContent className="space-y-2 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{linha.nome}</span>
                    <SituacaoBadge enviado={!!linha.checklist} ehSemanaAtual={ehSemanaAtual} />
                  </div>
                  {linha.checklist && (
                    <>
                      <div className="text-xs text-muted-foreground">
                        Enviado em {fmtDataHora(linha.checklist.preenchido_em)}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex flex-wrap gap-1.5 text-xs">
                          <span className={cn("rounded-full px-2 py-0.5", COR_RESPOSTA.otima)}>
                            {totais.otima} Ótima
                          </span>
                          <span
                            className={cn("rounded-full px-2 py-0.5", COR_RESPOSTA.nao_verificado)}
                          >
                            {totais.nao_verificado} Não verif.
                          </span>
                          <span className={cn("rounded-full px-2 py-0.5", COR_RESPOSTA.ruim)}>
                            {totais.ruim} Ruim
                          </span>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => setDetalhe(linha)}>
                          <Eye className="h-4 w-4" /> Ver
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
      </div>

      <Card className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Motorista</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead>Enviado em</TableHead>
              <TableHead className="text-center">Ótima</TableHead>
              <TableHead className="text-center">Não verificado</TableHead>
              <TableHead className="text-center">Ruim</TableHead>
              <TableHead className="text-right">Respostas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {carregando && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                  Carregando…
                </TableCell>
              </TableRow>
            )}
            {!carregando && linhas.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                  Nenhum motorista cadastrado.
                </TableCell>
              </TableRow>
            )}
            {!carregando &&
              linhas.map((linha) => {
                const totais = contarRespostas(linha.checklist?.respostas);
                return (
                  <TableRow key={linha.id}>
                    <TableCell className="font-medium">{linha.nome}</TableCell>
                    <TableCell>
                      <SituacaoBadge enviado={!!linha.checklist} ehSemanaAtual={ehSemanaAtual} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {linha.checklist ? fmtDataHora(linha.checklist.preenchido_em) : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      {linha.checklist ? totais.otima : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      {linha.checklist ? totais.nao_verificado : "—"}
                    </TableCell>
                    <TableCell
                      className={cn("text-center", totais.ruim > 0 && "font-bold text-red-700")}
                    >
                      {linha.checklist ? totais.ruim : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {linha.checklist && (
                        <Button size="sm" variant="outline" onClick={() => setDetalhe(linha)}>
                          <Eye className="h-4 w-4" /> Ver
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!detalhe} onOpenChange={(aberto) => !aberto && setDetalhe(null)}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detalhe?.nome}</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Semana de {descreverSemana(semana)}
              {detalhe?.checklist && ` · enviado em ${fmtDataHora(detalhe.checklist.preenchido_em)}`}
            </p>
          </DialogHeader>
          {detalhe?.checklist && (
            <div className="space-y-3">
              <div className="divide-y rounded-lg border">
                {detalhe.checklist.respostas.map((item, indice) => (
                  <div
                    key={item.codigo}
                    className="flex items-center justify-between gap-3 p-2.5 text-sm"
                  >
                    <span>
                      <span className="text-muted-foreground">{indice + 1}.</span> {item.pergunta}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                        COR_RESPOSTA[item.resposta],
                      )}
                    >
                      {rotuloResposta(item.resposta)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="text-sm">
                <div className="mb-1 font-medium">Observações</div>
                <p className="whitespace-pre-wrap text-muted-foreground">
                  {detalhe.checklist.observacoes || "Sem observações."}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SituacaoBadge({ enviado, ehSemanaAtual }: { enviado: boolean; ehSemanaAtual: boolean }) {
  if (enviado) {
    return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Enviado</Badge>;
  }
  if (ehSemanaAtual) {
    return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Pendente</Badge>;
  }
  return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Não feito</Badge>;
}

function Resumo({ titulo, valor, tom }: { titulo: string; valor: number; tom?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{titulo}</div>
        <div className={cn("text-2xl font-bold", tom)}>{valor}</div>
      </CardContent>
    </Card>
  );
}
