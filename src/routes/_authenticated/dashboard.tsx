import { createFileRoute, Link } from "@tanstack/react-router";
import { useProfile } from "@/hooks/use-session";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ClipboardList,
  Fuel,
  Users,
  Package,
  Car,
  TrendingUp,
  Settings,
  PackageCheck,
  Truck,
  Plus,
  BarChart3,
  Trophy,
  Wallet,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Home,
});

function Home() {
  const { data } = useProfile();
  if (!data) return null;
  const isAdmin = data.roles.includes("admin");
  return isAdmin ? <AdminDashboard empresaId={data.profile.empresa_id} /> : <MotoristaHome />;
}

function AdminDashboard({ empresaId }: { empresaId: string }) {
  const { data: stats } = useQuery({
    queryKey: ["admin-stats-30d", empresaId],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const sinceIso = since.toISOString();

      const [entregasRes, abastRes, profilesRes, veiculosRes] = await Promise.all([
        (supabase as any)
          .from("entregas")
          .select(
            "id, valor_praticado, valor_frete, quantidade, motorista_venda_id, motorista_entrega_id, status, criada_em",
          )
          .gte("criada_em", sinceIso),
        (supabase as any)
          .from("abastecimentos")
          .select("valor_total, litros, km_atual, veiculo_id, data_hora")
          .gte("data_hora", sinceIso),
        (supabase as any).from("profiles").select("id, nome").eq("empresa_id", empresaId),
        (supabase as any).from("veiculos").select("id, placa, descricao").eq("empresa_id", empresaId),
      ]);

      const ents = entregasRes.data ?? [];
      const abs = abastRes.data ?? [];
      const profiles = profilesRes.data ?? [];
      const veics = veiculosRes.data ?? [];

      const profileName = new Map<string, string>(profiles.map((p: any) => [p.id, p.nome]));
      const veicLabel = new Map<string, string>(
        veics.map((v: any) => [v.id, v.placa + (v.descricao ? ` · ${v.descricao}` : "")]),
      );

      const totalVendas = ents.length;
      const receitaProduto = ents.reduce(
        (s: number, e: any) => s + Number(e.valor_praticado || 0) * Number(e.quantidade || 1),
        0,
      );
      const receitaFrete = ents.reduce((s: number, e: any) => s + Number(e.valor_frete || 0), 0);
      const totalReceita = receitaProduto + receitaFrete;
      const ticketMedio = totalVendas > 0 ? totalReceita / totalVendas : 0;
      const gastoCombustivel = abs.reduce((s: number, a: any) => s + Number(a.valor_total || 0), 0);

      // Ranking de entregas por motorista (apenas finalizadas)
      const entreguesPorMotorista = new Map<string, number>();
      for (const e of ents) {
        if (e.status !== "entregue") continue;
        const id = e.motorista_entrega_id || e.motorista_venda_id;
        if (!id) continue;
        entreguesPorMotorista.set(id, (entreguesPorMotorista.get(id) ?? 0) + 1);
      }
      const rankingMotoristas = Array.from(entreguesPorMotorista.entries())
        .map(([id, qtd]) => ({ id, nome: profileName.get(id) ?? "—", qtd }))
        .sort((a, b) => b.qtd - a.qtd)
        .slice(0, 5);

      // Consumo por caminhão: km percorrido / litros / R$
      const porVeiculo = new Map<string, { litros: number; valor: number; kmMin: number; kmMax: number }>();
      for (const a of abs) {
        if (!a.veiculo_id) continue;
        const cur =
          porVeiculo.get(a.veiculo_id) ??
          { litros: 0, valor: 0, kmMin: Number.POSITIVE_INFINITY, kmMax: 0 };
        cur.litros += Number(a.litros || 0);
        cur.valor += Number(a.valor_total || 0);
        const km = Number(a.km_atual || 0);
        if (km > 0) {
          cur.kmMin = Math.min(cur.kmMin, km);
          cur.kmMax = Math.max(cur.kmMax, km);
        }
        porVeiculo.set(a.veiculo_id, cur);
      }
      const consumoVeiculos = Array.from(porVeiculo.entries())
        .map(([id, v]) => {
          const kmRodado = v.kmMax > 0 && v.kmMin !== Number.POSITIVE_INFINITY ? v.kmMax - v.kmMin : 0;
          const kmL = v.litros > 0 && kmRodado > 0 ? kmRodado / v.litros : 0;
          const rsKm = kmRodado > 0 ? v.valor / kmRodado : 0;
          return {
            id,
            label: veicLabel.get(id) ?? "—",
            litros: v.litros,
            valor: v.valor,
            kmRodado,
            kmL,
            rsKm,
          };
        })
        .sort((a, b) => b.kmRodado - a.kmRodado);

      return {
        totalVendas,
        totalReceita,
        ticketMedio,
        gastoCombustivel,
        rankingMotoristas,
        consumoVeiculos,
      };
    },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Painel · últimos 30 dias</h1>
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Vendas" value={stats?.totalVendas ?? "—"} icon={<ClipboardList className="h-4 w-4" />} />
        <StatCard label="Ticket médio" value={brl(stats?.ticketMedio)} icon={<TrendingUp className="h-4 w-4" />} />
        <StatCard label="Receita total" value={brl(stats?.totalReceita)} icon={<TrendingUp className="h-4 w-4" />} />
        <StatCard label="Combustível" value={brl(stats?.gastoCombustivel)} icon={<Fuel className="h-4 w-4" />} />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" /> Ranking de entregas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!stats?.rankingMotoristas?.length && (
            <div className="text-xs text-muted-foreground">Nenhuma entrega finalizada no período.</div>
          )}
          {stats?.rankingMotoristas?.map((m, i) => (
            <div key={m.id} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-5 text-xs text-muted-foreground">#{i + 1}</span>
                <span className="truncate">{m.nome}</span>
              </div>
              <span className="font-semibold">{m.qtd}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Truck className="h-4 w-4 text-primary" /> Consumo por caminhão
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!stats?.consumoVeiculos?.length && (
            <div className="text-xs text-muted-foreground">Sem abastecimentos no período.</div>
          )}
          {stats?.consumoVeiculos?.map((v) => (
            <div key={v.id} className="text-sm border rounded-lg p-2">
              <div className="font-medium truncate">{v.label}</div>
              <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground mt-1">
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
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 pt-2">
        <QuickLink to="/relatorios" icon={<BarChart3 className="h-5 w-5" />} label="Relatórios" />
        <QuickLink to="/financeiro" icon={<Wallet className="h-5 w-5" />} label="Financeiro" />
        <QuickLink to="/entregas" icon={<ClipboardList className="h-5 w-5" />} label="Entregas" />
        <QuickLink to="/clientes" icon={<Users className="h-5 w-5" />} label="Clientes" />
        <QuickLink to="/materiais" icon={<Package className="h-5 w-5" />} label="Materiais" />
        <QuickLink to="/veiculos" icon={<Car className="h-5 w-5" />} label="Veículos" />
        <QuickLink to="/configuracoes" icon={<Settings className="h-5 w-5" />} label="Configurações" />
      </div>
    </div>
  );
}

function MotoristaHome() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Olá, motorista</h1>
      <p className="text-sm text-muted-foreground">O que você quer fazer agora?</p>
      <div className="grid gap-3">
        <Link to="/pendentes" className="block rounded-xl border bg-card p-5 hover:bg-accent transition">
          <PackageCheck className="h-8 w-8 text-primary mb-2" />
          <div className="font-semibold">Pendentes de entrega</div>
          <div className="text-xs text-muted-foreground">Pegue uma venda do pool</div>
        </Link>
        <Link to="/minhas-entregas" className="block rounded-xl border bg-card p-5 hover:bg-accent transition">
          <Truck className="h-8 w-8 text-primary mb-2" />
          <div className="font-semibold">Minhas entregas em andamento</div>
          <div className="text-xs text-muted-foreground">Finalize as entregas iniciadas</div>
        </Link>
        <Link to="/entrega" className="block rounded-xl border bg-card p-5 hover:bg-accent transition">
          <Plus className="h-8 w-8 text-primary mb-2" />
          <div className="font-semibold">Cadastrar nova venda</div>
          <div className="text-xs text-muted-foreground">Cliente, material, valores</div>
        </Link>
        <Link to="/abastecimento" className="block rounded-xl border bg-card p-5 hover:bg-accent transition">
          <Fuel className="h-8 w-8 text-primary mb-2" />
          <div className="font-semibold">Abastecimento</div>
          <div className="text-xs text-muted-foreground">Foto do cupom, litros e valor</div>
        </Link>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: any; icon: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
          {icon} {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-lg font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function QuickLink({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link to={to} className="rounded-xl border bg-card p-4 flex flex-col gap-1 hover:bg-accent">
      <div className="text-primary">{icon}</div>
      <div className="text-sm font-medium">{label}</div>
    </Link>
  );
}

function brl(n?: number) {
  if (n == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}
