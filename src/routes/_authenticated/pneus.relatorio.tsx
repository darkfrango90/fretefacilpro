import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-session";
import { AdminOnly } from "@/components/role-guard";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { labelPosicao } from "@/lib/pneus-constants";

export const Route = createFileRoute("/_authenticated/pneus/relatorio")({
  component: () => <AdminOnly><Page /></AdminOnly>,
});

function brl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function inicioAno() {
  return new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
}
function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function Page() {
  const { data: prof } = useProfile();
  const empresaId = prof?.profile.empresa_id;
  const [de, setDe] = useState(inicioAno());
  const [ate, setAte] = useState(hojeISO());
  const [veiculoId, setVeiculoId] = useState("__todos__");
  const [marcaF, setMarcaF] = useState("__todas__");
  const [tipoF, setTipoF] = useState("__todos__");

  const { data: veiculos } = useQuery({
    queryKey: ["veiculos-list", empresaId],
    enabled: !!empresaId,
    queryFn: async () =>
      (await (supabase as any).from("veiculos").select("id, placa").order("placa")).data ?? [],
  });

  const { data: pneus } = useQuery({
    queryKey: ["pneus-relatorio", empresaId, de, ate, veiculoId, marcaF, tipoF],
    enabled: !!empresaId,
    queryFn: async () => {
      let q = (supabase as any).from("pneus").select("*")
        .gte("data_instalacao", de).lte("data_instalacao", ate)
        .order("data_instalacao", { ascending: false });
      if (veiculoId !== "__todos__") q = q.eq("veiculo_id", veiculoId);
      if (tipoF !== "__todos__") q = q.eq("tipo", tipoF);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).filter((p: any) => marcaF === "__todas__" || p.marca === marcaF);
    },
  });

  // KM atual por veículo (uma query agregando últimos abastecimentos)
  const { data: kmPorVeiculo } = useQuery({
    queryKey: ["km-por-veiculo", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("abastecimentos").select("veiculo_id, km_atual");
      const m = new Map<string, number>();
      (data ?? []).forEach((a: any) => {
        const v = Number(a.km_atual ?? 0);
        if (!m.has(a.veiculo_id) || (m.get(a.veiculo_id) ?? 0) < v) m.set(a.veiculo_id, v);
      });
      return m;
    },
  });

  const marcas = useMemo(() => {
    const s = new Set<string>();
    (pneus ?? []).forEach((p: any) => p.marca && s.add(p.marca));
    return Array.from(s).sort();
  }, [pneus]);

  const placas = useMemo(() => {
    const m = new Map<string, string>();
    (veiculos ?? []).forEach((v: any) => m.set(v.id, v.placa));
    return m;
  }, [veiculos]);

  type Agg = { count: number; somaKm: number; somaCustoKm: number; somaCusto: number };
  const porMarca = useMemo(() => {
    const m = new Map<string, Agg>();
    (pneus ?? []).filter((p: any) => p.status === "removido").forEach((p: any) => {
      const dur = Math.max(0, Number(p.km_remocao) - Number(p.km_instalacao));
      if (dur <= 0) return;
      const k = p.marca || "—";
      const a = m.get(k) ?? { count: 0, somaKm: 0, somaCustoKm: 0, somaCusto: 0 };
      a.count++; a.somaKm += dur; a.somaCusto += Number(p.valor || 0);
      if (p.valor > 0) a.somaCustoKm += Number(p.valor) / dur;
      m.set(k, a);
    });
    return Array.from(m.entries()).sort((a, b) => (b[1].somaKm / b[1].count) - (a[1].somaKm / a[1].count));
  }, [pneus]);

  const porTipo = useMemo(() => {
    const m = new Map<string, Agg>();
    (pneus ?? []).filter((p: any) => p.status === "removido").forEach((p: any) => {
      const dur = Math.max(0, Number(p.km_remocao) - Number(p.km_instalacao));
      if (dur <= 0) return;
      const k = p.tipo || "—";
      const a = m.get(k) ?? { count: 0, somaKm: 0, somaCustoKm: 0, somaCusto: 0 };
      a.count++; a.somaKm += dur; a.somaCusto += Number(p.valor || 0);
      if (p.valor > 0) a.somaCustoKm += Number(p.valor) / dur;
      m.set(k, a);
    });
    return Array.from(m.entries());
  }, [pneus]);

  return (
    <div className="space-y-4 pb-6">
      <h1 className="text-xl font-bold">Durabilidade de pneus</h1>

      <Card><CardContent className="p-3 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div><Label className="text-xs">De</Label><Input type="date" value={de} onChange={(e) => setDe(e.target.value)} /></div>
          <div><Label className="text-xs">Até</Label><Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label className="text-xs">Veículo</Label>
            <Select value={veiculoId} onValueChange={setVeiculoId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__todos__">Todos</SelectItem>
                {(veiculos ?? []).map((v: any) => <SelectItem key={v.id} value={v.id}>{v.placa}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Marca</Label>
            <Select value={marcaF} onValueChange={setMarcaF}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__todas__">Todas</SelectItem>
                {marcas.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Tipo</Label>
            <Select value={tipoF} onValueChange={setTipoF}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__todos__">Todos</SelectItem>
                <SelectItem value="novo">Novo</SelectItem>
                <SelectItem value="recapado">Recapado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent></Card>

      <Card><CardContent className="p-3 space-y-2">
        <div className="text-sm font-semibold">Média por marca (removidos)</div>
        {porMarca.length === 0 && <div className="text-xs text-muted-foreground">Sem dados.</div>}
        {porMarca.map(([m, a]) => (
          <div key={m} className="flex items-center justify-between text-xs border-b last:border-0 py-1">
            <div>
              <div className="font-medium text-sm">{m}</div>
              <div className="text-muted-foreground">{a.count} pneu(s) • custo médio/km: {a.count > 0 && a.somaCustoKm > 0 ? brl(a.somaCustoKm / a.count) : "—"}</div>
            </div>
            <div className="text-right">
              <div className="font-semibold">{Math.round(a.somaKm / a.count).toLocaleString("pt-BR")} km</div>
              <div className="text-muted-foreground">média</div>
            </div>
          </div>
        ))}
      </CardContent></Card>

      <Card><CardContent className="p-3 space-y-2">
        <div className="text-sm font-semibold">Média por tipo</div>
        {porTipo.length === 0 && <div className="text-xs text-muted-foreground">Sem dados.</div>}
        {porTipo.map(([t, a]) => (
          <div key={t} className="flex items-center justify-between text-xs border-b last:border-0 py-1">
            <div>
              <div className="font-medium text-sm capitalize">{t}</div>
              <div className="text-muted-foreground">{a.count} pneu(s) • {brl(a.somaCusto)} investido</div>
            </div>
            <div className="font-semibold">{Math.round(a.somaKm / a.count).toLocaleString("pt-BR")} km</div>
          </div>
        ))}
      </CardContent></Card>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Pneus no período</h2>
        {(pneus ?? []).map((p: any) => {
          const removido = p.status === "removido";
          const kmAtual = kmPorVeiculo?.get(p.veiculo_id) ?? 0;
          const dur = removido
            ? Math.max(0, Number(p.km_remocao) - Number(p.km_instalacao))
            : Math.max(0, kmAtual - Number(p.km_instalacao));
          const custoKm = dur > 0 && p.valor > 0 ? Number(p.valor) / dur : 0;
          return (
            <Card key={p.id}>
              <CardContent className="p-3 text-xs">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-sm">{p.marca} {p.modelo ?? ""}</div>
                  <Badge variant={removido ? "outline" : "secondary"}>{removido ? "Removido" : "Em uso"}</Badge>
                </div>
                <div className="text-muted-foreground mt-1">
                  {placas.get(p.veiculo_id) ?? "—"} • {labelPosicao(p.posicao)} • {p.tipo}
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-muted-foreground">Duração</span>
                  <span className="font-semibold">{dur.toLocaleString("pt-BR")} km</span>
                </div>
                {custoKm > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Custo / km</span>
                    <span>{brl(custoKm)}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {(pneus ?? []).length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-6">Sem pneus no período.</div>
        )}
      </div>
    </div>
  );
}
