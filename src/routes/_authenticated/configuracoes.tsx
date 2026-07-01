import { createFileRoute, Link } from "@tanstack/react-router";
import { useProfile } from "@/hooks/use-session";
import {
  Droplets,
  BarChart3,
  Package,
  ClipboardList,
  Users,
  Car,
  UserCog,
  ShieldCheck,
  LineChart,
  Wallet,
  RefreshCw,
  Receipt,
  CircleDot,
  Fuel,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  component: Page,
});

function Page() {
  const { data, isLoading } = useProfile();
  if (isLoading || !data) {
    return <div className="text-sm text-muted-foreground">Carregando…</div>;
  }
  const isAdmin = data.roles.includes("admin");
  return isAdmin ? <AdminConfig /> : <MotoristaConfig />;
}

function AdminConfig() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Configurações</h1>
        <p className="text-xs text-muted-foreground">
          Gestão avançada e cadastros de uso eventual.
        </p>
      </div>

      <Section title="Cadastros">
        <Item to="/clientes" icon={<Users className="h-5 w-5" />} label="Clientes" />
        <Item to="/materiais" icon={<Package className="h-5 w-5" />} label="Materiais" />
      </Section>

      <Section title="Pessoas">
        <Item to="/motoristas" icon={<UserCog className="h-5 w-5" />} label="Motoristas" hint="Cadastrar, desativar, reativar" />
        <Item to="/permissoes" icon={<ShieldCheck className="h-5 w-5" />} label="Permissões" hint="Padrões da empresa e por motorista" />
      </Section>

      <Section title="Operação">
        <Item to="/entregas" icon={<ClipboardList className="h-5 w-5" />} label="Entregas" />
        <Item to="/financeiro" icon={<Wallet className="h-5 w-5" />} label="Financeiro" hint="Confirmar recebimentos das vendas" />
        <Item to="/relatorios" icon={<LineChart className="h-5 w-5" />} label="Relatórios" hint="Métricas e indicadores da empresa" />
      </Section>

      <Section title="Veículo">
        <Item to="/abastecimento" icon={<Fuel className="h-5 w-5" />} label="Abastecimento" hint="Registrar abastecimento com cupom" />
        <Item to="/despesas" icon={<Receipt className="h-5 w-5" />} label="Despesas" hint="Lançar e conferir despesas operacionais" />
        <Item to="/pneus" icon={<CircleDot className="h-5 w-5" />} label="Pneus" hint="Instalar, trocar e acompanhar pneus" />
      </Section>

      <Section title="Combustível">

        <Item
          to="/afericoes"
          icon={<Droplets className="h-5 w-5" />}
          label="Aferição de tanque"
          hint="Medição física semanal do diesel"
        />
        <Item
          to="/consumo-preciso"
          icon={<BarChart3 className="h-5 w-5" />}
          label="Consumo preciso"
          hint="km/L e R$/km entre aferições"
        />
      </Section>
    </div>
  );
}

function MotoristaConfig() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Configurações</h1>
        <p className="text-xs text-muted-foreground">
          Sincronização e relatórios das suas entregas.
        </p>
      </div>

      <Section title="Operação">
        <Item
          to="/sincronizacao"
          icon={<RefreshCw className="h-5 w-5" />}
          label="Sincronização"
          hint="Enviar pendências e ver histórico"
        />
        <Item
          to="/relatorios-motorista"
          icon={<LineChart className="h-5 w-5" />}
          label="Relatórios"
          hint="Minhas entregas por período"
        />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      <div className="grid gap-2">{children}</div>
    </div>
  );
}

function Item({
  to,
  icon,
  label,
  hint,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  hint?: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-xl border bg-card p-4 hover:bg-accent transition"
    >
      <div className="text-primary">{icon}</div>
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-xs text-muted-foreground truncate">{hint}</div>}
      </div>
    </Link>
  );
}
