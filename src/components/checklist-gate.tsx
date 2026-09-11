import { Link, useRouterState } from "@tanstack/react-router";
import { ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { descreverSemana, useChecklistSemanal } from "@/lib/checklist-semanal";

function BotaoPreencher({ className }: { className?: string }) {
  const voltar = useRouterState({ select: (state) => state.location.pathname });
  return (
    <Button asChild variant="action" className={className}>
      <Link to="/checklist" search={{ voltar }}>
        <ClipboardCheck className="h-4 w-4" /> Preencher checklist
      </Link>
    </Button>
  );
}

/**
 * Bloqueia a tela inteira para o motorista que ainda não enviou o checklist da
 * semana. Admin e master passam direto.
 */
export function ChecklistGate({ acao, children }: { acao: string; children: React.ReactNode }) {
  const checklist = useChecklistSemanal();

  if (!checklist.exigido || checklist.feito) return <>{children}</>;
  if (checklist.carregando) {
    return <div className="text-sm text-muted-foreground">Verificando checklist semanal…</div>;
  }

  return (
    <Card className="mx-auto max-w-md border-amber-300 bg-amber-50/60">
      <CardContent className="space-y-4 p-6 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-100 text-amber-700">
          <ClipboardCheck className="h-7 w-7" />
        </div>
        <div className="space-y-1">
          <h1 className="text-lg font-bold">Checklist semanal pendente</h1>
          <p className="text-sm text-muted-foreground">
            Para {acao}, preencha antes o checklist da semana de{" "}
            {descreverSemana(checklist.semana)}.
          </p>
        </div>
        <BotaoPreencher className="w-full" />
      </CardContent>
    </Card>
  );
}

/** Aviso fixo no topo de telas que continuam acessíveis sem o checklist. */
export function ChecklistAviso() {
  const checklist = useChecklistSemanal();
  if (!checklist.exigido || checklist.feito || checklist.carregando) return null;

  return (
    <Card className="border-amber-300 bg-amber-50/60">
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <ClipboardCheck className="hidden h-6 w-6 shrink-0 text-amber-700 sm:block" />
        <div className="flex-1 text-sm">
          <div className="font-semibold">Checklist semanal pendente</div>
          <div className="text-muted-foreground">
            Vendas e entregas ficam bloqueadas até você enviar o checklist desta semana.
          </div>
        </div>
        <BotaoPreencher className="w-full sm:w-auto" />
      </CardContent>
    </Card>
  );
}
