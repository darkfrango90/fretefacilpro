import { useState } from "react";
import { createFileRoute, Navigate, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { CheckCircle2, ClipboardCheck, CloudOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useProfile } from "@/hooks/use-session";
import { enqueue } from "@/lib/offline/queue";
import { syncNow } from "@/lib/offline/sync";
import {
  CHECKLIST_ITENS,
  RESPOSTAS_CHECKLIST,
  contarRespostas,
  descreverSemana,
  rotuloResposta,
  useChecklistSemanal,
  type ItemRespondido,
  type RespostaChecklist,
} from "@/lib/checklist-semanal";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/checklist")({
  validateSearch: (search: Record<string, unknown>): { voltar?: string } => ({
    voltar:
      typeof search.voltar === "string" && search.voltar.startsWith("/")
        ? search.voltar
        : undefined,
  }),
  component: ChecklistMotorista,
});

const ESTILO_RESPOSTA: Record<RespostaChecklist, { ativo: string; badge: string }> = {
  otima: {
    ativo: "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-600",
    badge: "bg-emerald-100 text-emerald-800",
  },
  nao_verificado: {
    ativo: "border-amber-500 bg-amber-500 text-white hover:bg-amber-500",
    badge: "bg-amber-100 text-amber-800",
  },
  ruim: {
    ativo: "border-red-600 bg-red-600 text-white hover:bg-red-600",
    badge: "bg-red-100 text-red-800",
  },
};

function ChecklistMotorista() {
  const { data: prof } = useProfile();
  const { voltar } = Route.useSearch();
  const router = useRouter();
  const checklist = useChecklistSemanal();
  const [respostas, setRespostas] = useState<Record<string, RespostaChecklist>>({});
  const [observacoes, setObservacoes] = useState("");
  const [enviando, setEnviando] = useState(false);

  if (!prof) return null;
  // O checklist é do motorista; o admin acompanha pela tela de checklists.
  if (!checklist.exigido) return <Navigate to="/checklists" replace />;

  const respondidos = CHECKLIST_ITENS.filter((item) => respostas[item.codigo]).length;
  const temRuim = Object.values(respostas).includes("ruim");

  async function enviar() {
    if (!prof) return;
    if (respondidos < CHECKLIST_ITENS.length) {
      toast.error("Responda todos os itens do checklist");
      return;
    }
    setEnviando(true);
    try {
      const itens: ItemRespondido[] = CHECKLIST_ITENS.map((item) => ({
        codigo: item.codigo,
        pergunta: item.pergunta,
        resposta: respostas[item.codigo],
      }));
      await enqueue({
        id: crypto.randomUUID(),
        type: "checklist_semanal",
        empresa_id: prof.profile.empresa_id,
        motorista_id: prof.profile.id,
        payload: {
          semana: checklist.semana,
          respostas: itens,
          observacoes: observacoes.trim() || null,
          preenchido_em: new Date().toISOString(),
        },
        photos: [],
      });
      if (navigator.onLine) {
        toast.success("Checklist enviado! Vendas e entregas liberadas.");
        void syncNow({ silent: true });
      } else {
        toast.success("Checklist salvo offline. Vendas e entregas liberadas.");
      }
      if (voltar) router.history.push(voltar);
    } catch (erro: any) {
      toast.error(erro?.message ?? "Não foi possível salvar o checklist");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <ClipboardCheck className="h-5 w-5" /> Checklist semanal
        </h1>
        <p className="text-sm text-muted-foreground">
          Semana de {descreverSemana(checklist.semana)}
        </p>
      </div>

      {checklist.carregando ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : checklist.registro ? (
        <ChecklistEnviado
          respostas={checklist.registro.respostas}
          observacoes={checklist.registro.observacoes}
          preenchidoEm={checklist.registro.preenchido_em}
          aguardandoSincronizacao={checklist.aguardandoSincronizacao}
        />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Avalie cada item antes de sair com o caminhão. Vendas e entregas ficam bloqueadas até o
            envio.
          </p>

          <div className="space-y-2">
            {CHECKLIST_ITENS.map((item, indice) => (
              <Card key={item.codigo}>
                <CardContent className="space-y-3 p-3">
                  <div className="flex gap-2 text-sm font-medium">
                    <span className="text-muted-foreground">{indice + 1}.</span>
                    <span>{item.pergunta}?</span>
                  </div>
                  <div
                    role="radiogroup"
                    aria-label={item.pergunta}
                    className="grid grid-cols-3 gap-2"
                  >
                    {RESPOSTAS_CHECKLIST.map((opcao) => {
                      const selecionada = respostas[item.codigo] === opcao.valor;
                      return (
                        <Button
                          key={opcao.valor}
                          type="button"
                          role="radio"
                          aria-checked={selecionada}
                          variant="outline"
                          className={cn(
                            "h-10 px-1 text-xs sm:text-sm",
                            selecionada && ESTILO_RESPOSTA[opcao.valor].ativo,
                          )}
                          onClick={() =>
                            setRespostas((atual) => ({ ...atual, [item.codigo]: opcao.valor }))
                          }
                        >
                          {opcao.label}
                        </Button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="space-y-1">
            <Label htmlFor="checklist-observacoes">Observações</Label>
            <Textarea
              id="checklist-observacoes"
              rows={3}
              value={observacoes}
              onChange={(event) => setObservacoes(event.target.value)}
              placeholder={
                temRuim ? "Descreva o problema encontrado nos itens marcados como Ruim" : "Opcional"
              }
            />
          </div>

          <div className="sticky bottom-24 z-10 md:bottom-4">
            <Button
              variant="action"
              className="h-12 w-full shadow-lg"
              disabled={enviando || respondidos < CHECKLIST_ITENS.length}
              onClick={enviar}
            >
              {enviando
                ? "Enviando…"
                : respondidos < CHECKLIST_ITENS.length
                  ? `Responda todos os itens (${respondidos}/${CHECKLIST_ITENS.length})`
                  : "Enviar checklist"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function ChecklistEnviado({
  respostas,
  observacoes,
  preenchidoEm,
  aguardandoSincronizacao,
}: {
  respostas: ItemRespondido[];
  observacoes: string | null;
  preenchidoEm: string;
  aguardandoSincronizacao: boolean;
}) {
  const totais = contarRespostas(respostas);
  return (
    <div className="space-y-3">
      <Card className="border-emerald-300 bg-emerald-50/60">
        <CardContent className="flex items-start gap-3 p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
          <div className="text-sm">
            <div className="font-semibold">Checklist desta semana enviado</div>
            <div className="text-muted-foreground">
              Preenchido em{" "}
              {new Date(preenchidoEm).toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
              . Vendas e entregas estão liberadas.
            </div>
            {aguardandoSincronizacao && (
              <div className="mt-1 flex items-center gap-1 text-amber-700">
                <CloudOff className="h-3.5 w-3.5" /> Aguardando sincronização
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        {RESPOSTAS_CHECKLIST.map((opcao) => (
          <div key={opcao.valor} className={cn("rounded-lg p-2", ESTILO_RESPOSTA[opcao.valor].badge)}>
            <div className="text-lg font-bold">{totais[opcao.valor]}</div>
            {opcao.label}
          </div>
        ))}
      </div>

      <Card>
        <CardContent className="divide-y p-0">
          {respostas.map((item, indice) => (
            <div key={item.codigo} className="flex items-center justify-between gap-3 p-3 text-sm">
              <span>
                <span className="text-muted-foreground">{indice + 1}.</span> {item.pergunta}
              </span>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                  ESTILO_RESPOSTA[item.resposta]?.badge,
                )}
              >
                {rotuloResposta(item.resposta)}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      {observacoes && (
        <Card>
          <CardContent className="p-3 text-sm">
            <div className="mb-1 font-medium">Observações</div>
            <p className="whitespace-pre-wrap text-muted-foreground">{observacoes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
