import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { formatarMoeda } from "@/lib/moeda";
import {
  calcularValoresEntrega,
  competenciaAtual,
  obterIntervaloCompetencia,
} from "@/lib/competencia-mensal";

type Props = {
  empresaId: string;
  motoristaId: string;
  onMotoristaIdChange: (motoristaId: string) => void;
};

type TotaisMotorista = {
  id: string;
  nome: string;
  entregas: number;
  vendasMaterial: number;
  fretes: number;
};

export function RelatorioMensalMotoristas({
  empresaId,
  motoristaId,
  onMotoristaIdChange,
}: Props) {
  const mesAtual = competenciaAtual();
  const [competencia, setCompetencia] = useState(mesAtual);
  const intervalo = useMemo(() => obterIntervaloCompetencia(competencia), [competencia]);

  const relatorio = useQuery({
    queryKey: ["relatorio-mensal-motoristas", empresaId, competencia],
    enabled: !!empresaId,
    queryFn: async () => {
      const [entregasResult, perfisResult, papeisResult] = await Promise.all([
        (supabase as any)
          .from("entregas")
          .select(
            "motorista_entrega_id, motorista_venda_id, material_id, itens, quantidade, valor_praticado, valor_frete",
          )
          .eq("empresa_id", empresaId)
          .eq("status", "entregue")
          .gte("finalizada_em", intervalo.inicioIso)
          .lte("finalizada_em", intervalo.fimIso),
        (supabase as any)
          .from("profiles")
          .select("id, nome")
          .eq("empresa_id", empresaId)
          .order("nome"),
        (supabase as any)
          .from("user_roles")
          .select("user_id")
          .eq("empresa_id", empresaId)
          .eq("role", "motorista"),
      ]);

      if (entregasResult.error) throw entregasResult.error;
      if (perfisResult.error) throw perfisResult.error;
      if (papeisResult.error) throw papeisResult.error;

      const idsMotoristas = new Set(
        (papeisResult.data ?? []).map((papel: any) => String(papel.user_id)),
      );
      const totais = new Map<string, TotaisMotorista>();

      for (const perfil of perfisResult.data ?? []) {
        if (!idsMotoristas.has(perfil.id)) continue;
        totais.set(perfil.id, {
          id: perfil.id,
          nome: perfil.nome,
          entregas: 0,
          vendasMaterial: 0,
          fretes: 0,
        });
      }

      for (const entrega of entregasResult.data ?? []) {
        const motoristaId = entrega.motorista_entrega_id ?? entrega.motorista_venda_id;
        if (!motoristaId) continue;
        const atual = totais.get(motoristaId);
        if (!atual) continue;
        const valores = calcularValoresEntrega(entrega);
        atual.entregas += 1;
        atual.vendasMaterial += valores.vendasMaterial;
        atual.fretes += valores.fretes;
      }

      return Array.from(totais.values()).sort(
        (a, b) =>
          b.vendasMaterial + b.fretes - (a.vendasMaterial + a.fretes) ||
          a.nome.localeCompare(b.nome, "pt-BR"),
      );
    },
  });

  const opcoesMotoristas = useMemo(
    () =>
      [...(relatorio.data ?? [])].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [relatorio.data],
  );

  const motoristasExibidos = useMemo(() => {
    if (motoristaId === "todos") return relatorio.data ?? [];
    return (relatorio.data ?? []).filter((motorista) => motorista.id === motoristaId);
  }, [relatorio.data, motoristaId]);

  return (
    <section className="space-y-3" aria-labelledby="relatorio-mensal-motoristas-title">
      <Card className="border-primary/30">
        <CardContent className="space-y-3 p-4">
          <div>
            <h2
              id="relatorio-mensal-motoristas-title"
              className="flex items-center gap-2 font-semibold"
            >
              <Users className="h-4 w-4 text-primary" /> Relatório individual por motorista
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {intervalo.inicioLabel} até {intervalo.fimLabel}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="competencia-motoristas">Competência</Label>
              <Input
                id="competencia-motoristas"
                type="month"
                value={competencia}
                max={mesAtual}
                onChange={(event) => setCompetencia(event.target.value || mesAtual)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="motorista-relatorio-mensal">Motorista</Label>
              <Select value={motoristaId} onValueChange={onMotoristaIdChange}>
                <SelectTrigger id="motorista-relatorio-mensal">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os motoristas</SelectItem>
                  {opcoesMotoristas.map((motorista) => (
                    <SelectItem key={motorista.id} value={motorista.id}>
                      {motorista.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" />
            {intervalo.emAberto
              ? `Em aberto. Fechamento automático em ${intervalo.fechamentoLabel}.`
              : `Competência fechada em ${intervalo.fechamentoLabel}.`}
          </p>
        </CardContent>
      </Card>

      {relatorio.isLoading ? (
        <p className="py-4 text-center text-sm text-muted-foreground">Carregando motoristas...</p>
      ) : null}

      {motoristasExibidos.map((motorista) => (
        <Card key={motorista.id}>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold">{motorista.nome}</h3>
              <span className="text-xs text-muted-foreground">
                {motorista.entregas} {motorista.entregas === 1 ? "entrega" : "entregas"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-muted/60 p-3">
                <div className="text-xs text-muted-foreground">Vendas material</div>
                <div className="mt-1 font-bold text-foreground">
                  {formatarMoeda(motorista.vendasMaterial)}
                </div>
              </div>
              <div className="rounded-lg bg-muted/60 p-3">
                <div className="text-xs text-muted-foreground">Fretes</div>
                <div className="mt-1 font-bold text-foreground">
                  {formatarMoeda(motorista.fretes)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {!relatorio.isLoading && (relatorio.data?.length ?? 0) === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          Nenhum motorista cadastrado para esta empresa.
        </p>
      ) : null}
    </section>
  );
}
