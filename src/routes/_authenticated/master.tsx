import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RoleGuard } from "@/components/role-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Search,
  Building2,
  Users,
  Truck,
  Fuel,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  MoreVertical,
  CalendarPlus,
  Pause,
  Play,
  Trash2,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

export const Route = createFileRoute("/_authenticated/master")({
  component: () => (
    <RoleGuard role="master">
      <MasterPanel />
    </RoleGuard>
  ),
});

type Empresa = {
  id: string;
  nome: string;
  data_inicio: string;
  data_vencimento: string;
  limite_usuarios: number;
  ativa: boolean;
  plano: string | null;
};

type Status = "ativa" | "vencendo" | "vencida" | "inativa";

const HOJE = () => new Date().toISOString().slice(0, 10);
function diasAte(data: string) {
  const ms = new Date(data + "T00:00:00").getTime() - new Date(HOJE() + "T00:00:00").getTime();
  return Math.round(ms / 86400000);
}
function statusEmpresa(e: Empresa): { key: Status; label: string; tone: string } {
  if (!e.ativa) return { key: "inativa", label: "Inativa", tone: "bg-zinc-500" };
  const d = diasAte(e.data_vencimento);
  if (d < 0) return { key: "vencida", label: "Vencida", tone: "bg-red-600" };
  if (d <= 7) return { key: "vencendo", label: `Vence em ${d}d`, tone: "bg-amber-500" };
  return { key: "ativa", label: "Ativa", tone: "bg-emerald-600" };
}
const fmtData = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString("pt-BR");

function MasterPanel() {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<"todos" | Status>("todos");

  const { data: empresas = [] } = useQuery({
    queryKey: ["master-empresas"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("empresas")
        .select("*")
        .not("nome", "ilike", "%sistema%")
        .order("nome");
      if (error) throw error;
      return data as Empresa[];
    },
  });

  const { data: usos } = useQuery({
    queryKey: ["master-usos", empresas.map((e) => e.id).join(",")],
    enabled: empresas.length > 0,
    queryFn: async () => {
      const ids = empresas.map((e) => e.id);
      const [users, ent, abast] = await Promise.all([
        (supabase as any).from("profiles").select("empresa_id").in("empresa_id", ids),
        (supabase as any).from("entregas").select("empresa_id, criada_em").in("empresa_id", ids),
        (supabase as any)
          .from("abastecimentos")
          .select("empresa_id, criado_em")
          .in("empresa_id", ids),
      ]);
      const count = (rows: any[]) =>
        (rows ?? []).reduce((acc: Record<string, number>, r: any) => {
          acc[r.empresa_id] = (acc[r.empresa_id] ?? 0) + 1;
          return acc;
        }, {});
      return {
        users: count(users.data ?? []) as Record<string, number>,
        entregas: count(ent.data ?? []) as Record<string, number>,
        abastecimentos: count(abast.data ?? []) as Record<string, number>,
        entregasRows: (ent.data ?? []) as { empresa_id: string; criada_em: string }[],
      };
    },
  });

  const kpis = useMemo(() => {
    let ativas = 0,
      vencendo = 0,
      vencidas = 0,
      inativas = 0;
    for (const e of empresas) {
      const s = statusEmpresa(e).key;
      if (s === "ativa") ativas++;
      else if (s === "vencendo") vencendo++;
      else if (s === "vencida") vencidas++;
      else inativas++;
    }
    const totalUsuarios = Object.values(usos?.users ?? {}).reduce((a, b) => a + b, 0);
    const totalEntregas = Object.values(usos?.entregas ?? {}).reduce((a, b) => a + b, 0);
    const totalAbast = Object.values(usos?.abastecimentos ?? {}).reduce((a, b) => a + b, 0);
    return {
      total: empresas.length,
      ativas,
      vencendo,
      vencidas,
      inativas,
      totalUsuarios,
      totalEntregas,
      totalAbast,
    };
  }, [empresas, usos]);

  const empresasFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return empresas.filter((e) => {
      if (q && !e.nome.toLowerCase().includes(q)) return false;
      if (filtroStatus !== "todos" && statusEmpresa(e).key !== filtroStatus) return false;
      return true;
    });
  }, [empresas, busca, filtroStatus]);

  const topEmpresas = useMemo(() => {
    return [...empresas]
      .map((e) => ({
        nome: e.nome.length > 14 ? e.nome.slice(0, 14) + "…" : e.nome,
        usuarios: usos?.users?.[e.id] ?? 0,
        entregas: usos?.entregas?.[e.id] ?? 0,
      }))
      .sort((a, b) => b.entregas - a.entregas)
      .slice(0, 6);
  }, [empresas, usos]);

  const distribStatus = [
    { name: "Ativas", value: kpis.ativas, color: "#059669" },
    { name: "Vencendo", value: kpis.vencendo, color: "#f59e0b" },
    { name: "Vencidas", value: kpis.vencidas, color: "#dc2626" },
    { name: "Inativas", value: kpis.inativas, color: "#71717a" },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-wider">
              Master Console
            </Badge>
            <Badge className="bg-emerald-600 text-[10px]">SaaS</Badge>
          </div>
          <h1 className="text-2xl font-heading font-bold mt-1">Painel de Administração</h1>
          <p className="text-sm text-muted-foreground">
            Gestão global das empresas, assinaturas e uso da plataforma
          </p>
        </div>
        <NovaEmpresaDialog
          onCreated={() => qc.invalidateQueries({ queryKey: ["master-empresas"] })}
        />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi
          icon={<Building2 className="h-4 w-4" />}
          label="Empresas"
          value={kpis.total}
          hint={`${kpis.ativas} ativas`}
          tone="primary"
        />
        <Kpi
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Vencendo (≤7d)"
          value={kpis.vencendo}
          hint={`${kpis.vencidas} já vencidas`}
          tone="warning"
        />
        <Kpi
          icon={<Users className="h-4 w-4" />}
          label="Usuários ativos"
          value={kpis.totalUsuarios}
          hint="Motoristas + Admins"
          tone="default"
        />
        <Kpi
          icon={<TrendingUp className="h-4 w-4" />}
          label="Operações"
          value={kpis.totalEntregas + kpis.totalAbast}
          hint={`${kpis.totalEntregas} entregas · ${kpis.totalAbast} abast.`}
          tone="success"
        />
      </div>

      <Tabs defaultValue="empresas" className="space-y-4">
        <TabsList>
          <TabsTrigger value="empresas">Empresas</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="empresas" className="space-y-3">
          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar empresa..."
                className="pl-8"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
            <Select value={filtroStatus} onValueChange={(v) => setFiltroStatus(v as any)}>
              <SelectTrigger className="w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="ativa">Ativas</SelectItem>
                <SelectItem value="vencendo">Vencendo</SelectItem>
                <SelectItem value="vencida">Vencidas</SelectItem>
                <SelectItem value="inativa">Inativas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tabela desktop */}
          <Card className="hidden md:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Usuários</TableHead>
                    <TableHead>Uso</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {empresasFiltradas.map((e) => {
                    const st = statusEmpresa(e);
                    const u = usos?.users?.[e.id] ?? 0;
                    const pct = Math.min(100, Math.round((u / e.limite_usuarios) * 100));
                    return (
                      <TableRow key={e.id}>
                        <TableCell>
                          <div className="font-medium">{e.nome}</div>
                          <div className="text-[11px] text-muted-foreground">
                            Desde {fmtData(e.data_inicio)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center gap-1.5 text-xs`}>
                            <span className={`h-2 w-2 rounded-full ${st.tone}`} />
                            {st.label}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm">{e.plano ?? "—"}</TableCell>
                        <TableCell className="text-sm">{fmtData(e.data_vencimento)}</TableCell>
                        <TableCell>
                          <div className="text-sm font-medium">
                            {u}/{e.limite_usuarios}
                          </div>
                          <div className="h-1.5 w-24 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full ${
                                pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-primary"
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {usos?.entregas?.[e.id] ?? 0} entr · {usos?.abastecimentos?.[e.id] ?? 0}{" "}
                          abast
                        </TableCell>
                        <TableCell className="text-right">
                          <AcoesEmpresa empresa={e} qc={qc} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {empresasFiltradas.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center text-sm text-muted-foreground py-8"
                      >
                        Nenhuma empresa encontrada.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Cards mobile */}
          <div className="grid gap-3 md:hidden">
            {empresasFiltradas.map((e) => {
              const st = statusEmpresa(e);
              const u = usos?.users?.[e.id] ?? 0;
              return (
                <Card key={e.id}>
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-base truncate">{e.nome}</CardTitle>
                    <span className="inline-flex items-center gap-1.5 text-xs">
                      <span className={`h-2 w-2 rounded-full ${st.tone}`} />
                      {st.label}
                    </span>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground space-y-1">
                    <div>Vencimento: {fmtData(e.data_vencimento)}</div>
                    <div>
                      Usuários: <strong>{u}</strong>/{e.limite_usuarios} · Entregas:{" "}
                      {usos?.entregas?.[e.id] ?? 0}
                    </div>
                    <div className="pt-2">
                      <AcoesEmpresa empresa={e} qc={qc} />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-3">
          <div className="grid md:grid-cols-2 gap-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Top empresas por entregas</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                {topEmpresas.length === 0 ? (
                  <EmptyChart />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topEmpresas}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="nome" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="entregas" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Distribuição de status</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                {distribStatus.length === 0 ? (
                  <EmptyChart />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={distribStatus}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={45}
                        outerRadius={80}
                        paddingAngle={3}
                      >
                        {distribStatus.map((d) => (
                          <Cell key={d.name} fill={d.color} />
                        ))}
                      </Pie>
                      <Legend />
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Saúde da carteira</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <Health label="Ativas" value={kpis.ativas} icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />} />
              <Health label="Vencendo em ≤7 dias" value={kpis.vencendo} icon={<AlertTriangle className="h-4 w-4 text-amber-500" />} />
              <Health label="Vencidas" value={kpis.vencidas} icon={<XCircle className="h-4 w-4 text-red-600" />} />
              <Health label="Inativas" value={kpis.inativas} icon={<Pause className="h-4 w-4 text-zinc-500" />} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Health({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-3 flex items-center gap-3">
      <div className="grid place-items-center h-9 w-9 rounded-md bg-muted">{icon}</div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-lg font-bold leading-none">{value}</div>
      </div>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="h-full grid place-items-center text-xs text-muted-foreground">
      Sem dados para exibir
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  hint?: string;
  tone: "primary" | "warning" | "success" | "default";
}) {
  const toneClass = {
    primary: "bg-primary/10 text-primary",
    warning: "bg-amber-500/10 text-amber-600",
    success: "bg-emerald-600/10 text-emerald-600",
    default: "bg-muted text-foreground",
  }[tone];
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`h-10 w-10 rounded-lg grid place-items-center ${toneClass}`}>{icon}</div>
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="text-2xl font-heading font-bold leading-tight">{value}</div>
          {hint && <div className="text-[11px] text-muted-foreground truncate">{hint}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

function AcoesEmpresa({ empresa, qc }: { empresa: Empresa; qc: ReturnType<typeof useQueryClient> }) {
  const [confirmDel, setConfirmDel] = useState(false);
  const [nomeConfirm, setNomeConfirm] = useState("");

  const mut = useMutation({
    mutationFn: async (payload: Partial<Empresa>) => {
      const { error } = await (supabase as any)
        .from("empresas")
        .update(payload)
        .eq("id", empresa.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Atualizado");
      qc.invalidateQueries({ queryKey: ["master-empresas"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any)
        .from("empresas")
        .delete()
        .eq("id", empresa.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Empresa removida");
      setConfirmDel(false);
      setNomeConfirm("");
      qc.invalidateQueries({ queryKey: ["master-empresas"] });
    },
    onError: (e: any) =>
      toast.error(
        e.message?.includes("foreign key") || e.code === "23503"
          ? "Não é possível remover: a empresa ainda possui dados vinculados (usuários, entregas, etc.). Suspenda-a no lugar."
          : e.message,
      ),
  });

  const renovar = () => {
    const novaData = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    mut.mutate({ data_vencimento: novaData });
  };

  return (
    <div className="flex items-center justify-end gap-1">
      <EditarEmpresaDialog
        empresa={empresa}
        onSaved={() => qc.invalidateQueries({ queryKey: ["master-empresas"] })}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" className="h-8 w-8">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={renovar}>
            <CalendarPlus className="h-4 w-4 mr-2" /> Renovar +30 dias
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {empresa.ativa ? (
            <DropdownMenuItem onClick={() => mut.mutate({ ativa: false })}>
              <Pause className="h-4 w-4 mr-2" /> Suspender
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => mut.mutate({ ativa: true })}>
              <Play className="h-4 w-4 mr-2" /> Reativar
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setConfirmDel(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" /> Remover empresa
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmDel} onOpenChange={(o) => { setConfirmDel(o); if (!o) setNomeConfirm(""); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Remover empresa?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Esta ação é <strong>permanente</strong> e irá excluir a empresa{" "}
                  <strong>{empresa.nome}</strong>. Dados vinculados (usuários, entregas,
                  abastecimentos, veículos, clientes, etc.) impedirão a exclusão — nesse caso, prefira <em>Suspender</em>.
                </p>
                <p className="text-sm">
                  Para confirmar, digite o nome da empresa abaixo:
                </p>
                <Input
                  value={nomeConfirm}
                  onChange={(e) => setNomeConfirm(e.target.value)}
                  placeholder={empresa.nome}
                  autoFocus
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={delMut.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={nomeConfirm.trim() !== empresa.nome || delMut.isPending}
              onClick={(e) => {
                e.preventDefault();
                delMut.mutate();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {delMut.isPending ? "Removendo..." : "Remover definitivamente"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function NovaEmpresaDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    const { data: session } = await supabase.auth.getSession();
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/criar-empresa`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.session?.access_token}`,
        },
        body: JSON.stringify({
          nome: fd.get("nome"),
          data_vencimento: fd.get("data_vencimento"),
          limite_usuarios: Number(fd.get("limite_usuarios")),
          plano: fd.get("plano") || null,
          admin_email: fd.get("admin_email"),
          admin_senha: fd.get("admin_senha"),
          admin_nome: fd.get("admin_nome"),
        }),
      },
    );
    setLoading(false);
    const body = await res.json();
    if (!res.ok) return toast.error(body?.erro ?? "Falha ao criar empresa");
    toast.success("Empresa criada");
    setOpen(false);
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" /> Nova empresa
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova empresa</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <Field label="Nome da empresa" name="nome" required />
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Vencimento"
              name="data_vencimento"
              type="date"
              required
              defaultValue={new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)}
            />
            <Field
              label="Limite usuários"
              name="limite_usuarios"
              type="number"
              required
              defaultValue="5"
            />
          </div>
          <Field label="Plano (opcional)" name="plano" placeholder="Ex: Starter, Pro..." />
          <div className="pt-2 border-t">
            <p className="text-xs font-semibold mb-2">Administrador inicial</p>
            <Field label="Nome" name="admin_nome" required />
            <Field label="E-mail" name="admin_email" type="email" required />
            <Field label="Senha" name="admin_senha" type="password" required minLength={6} />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Criando..." : "Criar empresa"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditarEmpresaDialog({
  empresa,
  onSaved,
}: {
  empresa: Empresa;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const mut = useMutation({
    mutationFn: async (payload: Partial<Empresa>) => {
      const { error } = await (supabase as any)
        .from("empresas")
        .update(payload)
        .eq("id", empresa.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Salvo");
      setOpen(false);
      onSaved();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-8">
          <Pencil className="h-3 w-3 mr-1" /> Editar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar — {empresa.nome}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            mut.mutate({
              data_vencimento: String(fd.get("data_vencimento")),
              limite_usuarios: Number(fd.get("limite_usuarios")),
              ativa: fd.get("ativa") === "on",
              plano: (fd.get("plano") as string) || null,
            });
          }}
          className="space-y-3"
        >
          <Field
            label="Vencimento"
            name="data_vencimento"
            type="date"
            defaultValue={empresa.data_vencimento}
            required
          />
          <Field
            label="Limite usuários"
            name="limite_usuarios"
            type="number"
            defaultValue={String(empresa.limite_usuarios)}
            required
          />
          <Field label="Plano" name="plano" defaultValue={empresa.plano ?? ""} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="ativa" defaultChecked={empresa.ativa} /> Ativa
          </label>
          <Button type="submit" disabled={mut.isPending} className="w-full">
            {mut.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1">
      <Label htmlFor={props.name}>{label}</Label>
      <Input id={props.name} {...props} />
    </div>
  );
}

// suprime ícones não usados em algumas builds
void Truck;
void Fuel;
