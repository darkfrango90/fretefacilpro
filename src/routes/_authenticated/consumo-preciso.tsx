import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-session";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { BarChart3, Droplets, AlertCircle } from "lucide-react";

import { AdminOnly } from "@/components/role-guard";

export const Route = createFileRoute("/_authenticated/consumo-preciso")({
  component: () => (
    <AdminOnly>
      <Page />
    </AdminOnly>
  ),
});

type Afer = { id: string; veiculo_id: string; data_hora: string; litros_aferidos: number; km_odometro: number | null };
type Abast = { id: string; veiculo_id: string; data_hora: string; litros: number | null; valor_total: number | null; km_atual: number | null };

function Page() {
  const { data: prof } = useProfile();
  const empresaId = prof?.profile.empresa_id;
  const isAdmin = prof?.roles.includes("admin");
  const [veiculoFiltro, setVeiculoFiltro] = useState<string>("all");

  const { data: veiculos } = useQuery({
    queryKey: ["veiculos-list", empresaId],
    enabled: !!empresaId,
    queryFn: async () =>
      (await (supabase as any).from("veiculos").select("id, placa").order("placa")).data ?? [],
  });

  const { data: afer } = useQuery<Afer[]>({
    queryKey: ["afericoes-all", empresaId],
    enabled: !!empresaId,
    queryFn: async () =>
      (await (supabase as any)
        .from("afericoes_tanque")
        .select("id, veiculo_id, data_hora, litros_aferidos, km_odometro")
        .order("data_hora", { ascending: true })).data ?? [],
  });

  const { data: abast } = useQuery<Abast[]>({
    queryKey: ["abast-all", empresaId],
    enabled: !!empresaId,
    queryFn: async () =>
      (await (supabase as any)
        .from("abastecimentos")
        .select("id, veiculo_id, data_hora, litros, valor_total, km_atual")
        .order("data_hora", { ascending: true })).data ?? [],
  });

  const { data: entregas } = useQuery({
    queryKey: ["entregas-km-all", empresaId],
    enabled: !!empresaId,
    queryFn: async () =>
      (await (supabase as any)
        .from("entregas")
        .select("veiculo_id, criada_em, km_final")
        .not("km_final", "is", null)).data ?? [],
  });

  const intervalos = useMemo(() => {
    if (!afer) return [];
    const porVeiculo = new Map<string, Afer[]>();
    for (const a of afer) {
      if (!porVeiculo.has(a.veiculo_id)) porVeiculo.set(a.veiculo_id, []);
      porVeiculo.get(a.veiculo_id)!.push(a);
    }
    const result: any[] = [];
    for (const [vid, lista] of porVeiculo.entries()) {
      const placa = (veiculos ?? []).find((v: any) => v.id === vid)?.placa ?? "—";
      if (lista.length < 2) {
        result.push({
          veiculo_id: vid,
          placa,
          incompleto: true,
          mensagem: "Apenas 1 aferição registrada. Registre uma segunda para fechar o primeiro intervalo.",
          fim: lista[0],
        });
        continue;
      }
      for (let i = 1; i < lista.length; i++) {
        const ini = lista[i - 1];
        const fim = lista[i];
        const tIni = new Date(ini.data_hora).getTime();
        const tFim = new Date(fim.data_hora).getTime();

        const abastNoPeriodo = (abast ?? []).filter((a) => {
          const t = new Date(a.data_hora).getTime();
          return a.veiculo_id === vid && t > tIni && t <= tFim;
        });
        const litrosAbast = abastNoPeriodo.reduce((s, a) => s + (Number(a.litros) || 0), 0);
        const valorAbast = abastNoPeriodo.reduce((s, a) => s + (Number(a.valor_total) || 0), 0);

        const dieselConsumido = Number(ini.litros_aferidos) + litrosAbast - Number(fim.litros_aferidos);

        // KM rodados: prefer aferições; fallback para min/max em abast+entregas
        let kmRodados: number | null = null;
        if (ini.km_odometro != null && fim.km_odometro != null) {
          kmRodados = Number(fim.km_odometro) - Number(ini.km_odometro);
        } else {
          const kms: number[] = [];
          for (const a of abastNoPeriodo) if (a.km_atual != null) kms.push(Number(a.km_atual));
          for (const e of (entregas ?? []) as any[]) {
            const t = new Date(e.criada_em).getTime();
            if (e.veiculo_id === vid && t > tIni && t <= tFim && e.km_final != null) kms.push(Number(e.km_final));
          }
          if (ini.km_odometro != null) kms.push(Number(ini.km_odometro));
          if (fim.km_odometro != null) kms.push(Number(fim.km_odometro));
          if (kms.length >= 2) kmRodados = Math.max(...kms) - Math.min(...kms);
        }

        const kmL = kmRodados != null && dieselConsumido > 0 ? kmRodados / dieselConsumido : null;
        const custoMedioL = litrosAbast > 0 ? valorAbast / litrosAbast : null;
        const custoKm =
          kmRodados != null && kmRodados > 0 && custoMedioL != null
            ? (dieselConsumido * custoMedioL) / kmRodados
            : null;

        result.push({
          veiculo_id: vid,
          placa,
          inicio: ini,
          fim,
          litrosAbast,
          valorAbast,
          dieselConsumido,
          kmRodados,
          kmL,
          custoMedioL,
          custoKm,
          incompleto: false,
        });
      }
    }
    return result.sort((a, b) => {
      const ta = new Date(a.fim?.data_hora ?? 0).getTime();
      const tb = new Date(b.fim?.data_hora ?? 0).getTime();
      return tb - ta;
    });
  }, [afer, abast, entregas, veiculos]);

  const filtrados = veiculoFiltro === "all" ? intervalos : intervalos.filter((i) => i.veiculo_id === veiculoFiltro);

  if (!prof) return null;
  if (!isAdmin) return <p className="text-sm text-muted-foreground">Apenas administradores podem ver este relatório.</p>;

  const fmtN = (n: number | null, d = 2) =>
    n == null || !isFinite(n) ? "—" : n.toLocaleString("pt-BR", { maximumFractionDigits: d, minimumFractionDigits: d });
  const fmtL = (n: number | null) => (n == null ? "—" : `${fmtN(n, 3)} L`);
  const fmtKm = (n: number | null) => (n == null ? "—" : `${fmtN(n, 1)} km`);
  const fmtR = (n: number | null) => (n == null ? "—" : `R$ ${fmtN(n, 2)}`);

  return (
    <div className="space-y-4 pb-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" /> Consumo preciso
        </h1>
        <Button asChild variant="outline" size="sm">
          <Link to="/afericoes">
            <Droplets className="h-4 w-4 mr-1" /> Aferições
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="p-3 text-xs text-muted-foreground">
          Relatório baseado na <strong>medição física do tanque</strong> entre duas aferições consecutivas. Diferente do relatório de média estimada por período.
          <br />
          Fórmula: <em>diesel consumido = estoque inicial + abastecimentos no intervalo − estoque final</em>.
        </CardContent>
      </Card>

      <div>
        <Select value={veiculoFiltro} onValueChange={setVeiculoFiltro}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os veículos</SelectItem>
            {(veiculos ?? []).map((v: any) => (
              <SelectItem key={v.id} value={v.id}>{v.placa}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        {filtrados.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma aferição encontrada. Registre aferições para começar.</p>
        )}

        {filtrados.map((it, idx) => {
          if (it.incompleto) {
            return (
              <Card key={`${it.veiculo_id}-incompleto-${idx}`} className="border-amber-300/60 bg-amber-50/50">
                <CardContent className="p-3 text-sm flex gap-2 items-start">
                  <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-semibold">{it.placa}</div>
                    <div className="text-xs text-muted-foreground">{it.mensagem}</div>
                  </div>
                </CardContent>
              </Card>
            );
          }
          const negativo = it.dieselConsumido < 0;
          return (
            <Card key={`${it.inicio.id}-${it.fim.id}`}>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">{it.placa}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {new Date(it.inicio.data_hora).toLocaleDateString("pt-BR")} →{" "}
                    {new Date(it.fim.data_hora).toLocaleDateString("pt-BR")}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                  <Linha label="Estoque inicial" value={fmtL(it.inicio.litros_aferidos)} />
                  <Linha label="Estoque final" value={fmtL(it.fim.litros_aferidos)} />
                  <Linha label="Abastecido no intervalo" value={fmtL(it.litrosAbast)} />
                  <Linha label="Valor abastecido" value={fmtR(it.valorAbast)} />
                  <Linha
                    label="Diesel consumido"
                    value={fmtL(it.dieselConsumido)}
                    danger={negativo}
                  />
                  <Linha label="KM rodados" value={fmtKm(it.kmRodados)} />
                  <Linha label="Custo médio diesel" value={it.custoMedioL != null ? `${fmtR(it.custoMedioL)}/L` : "—"} />
                  <Linha
                    label="Consumo preciso"
                    value={it.kmL != null ? `${fmtN(it.kmL, 2)} km/L` : "—"}
                    highlight
                  />
                  <Linha
                    label="Custo por km"
                    value={it.custoKm != null ? `${fmtR(it.custoKm)}/km` : "—"}
                    highlight
                  />
                </div>
                {negativo && (
                  <div className="text-[11px] text-destructive flex gap-1 items-center">
                    <AlertCircle className="h-3 w-3" />
                    Consumo negativo: verifique aferições e abastecimentos do intervalo.
                  </div>
                )}
                {it.kmRodados == null && (
                  <div className="text-[11px] text-amber-700 flex gap-1 items-center">
                    <AlertCircle className="h-3 w-3" />
                    KM rodados indisponíveis: informe o odômetro nas aferições.
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Linha({ label, value, highlight, danger }: { label: string; value: string; highlight?: boolean; danger?: boolean }) {
  return (
    <>
      <div className="text-muted-foreground text-xs">{label}</div>
      <div
        className={`text-right font-medium ${highlight ? "text-primary" : ""} ${danger ? "text-destructive" : ""}`}
      >
        {value}
      </div>
    </>
  );
}
