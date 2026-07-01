import { createFileRoute, Outlet, redirect, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import React, { useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-session";
import {
  LayoutDashboard,
  Users,
  Car,
  LogOut,
  Wrench,
  ClipboardList,
  RefreshCw,
  Settings,
  Building2,
  PackageCheck,
  Truck,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { OfflineProvider } from "@/components/offline/offline-provider";
import { SyncStatus } from "@/components/offline/sync-status";
import { Logo } from "@/components/logo";

const OFFLINE_VALIDATION_KEY = "auth:last_online_validation";
const MAX_OFFLINE_DAYS = 14;
const MAX_OFFLINE_MS = MAX_OFFLINE_DAYS * 24 * 60 * 60 * 1000;

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (!session) throw redirect({ to: "/auth" });

    let lastValidated = 0;
    try {
      lastValidated = Number(localStorage.getItem(OFFLINE_VALIDATION_KEY) ?? 0);
    } catch {}
    const online = typeof navigator !== "undefined" ? navigator.onLine : true;
    if (!online) {
      if (!lastValidated) {
        try { localStorage.setItem(OFFLINE_VALIDATION_KEY, String(Date.now())); } catch {}
        lastValidated = Date.now();
      }
      if (Date.now() - lastValidated > MAX_OFFLINE_MS) {
        await supabase.auth.signOut();
        throw redirect({ to: "/auth" });
      }
    }
    return { user: session.user };
  },
  component: AuthedLayout,
});


type NavItem = { to: string; icon: React.ReactNode; label: string };

const ADMIN_NAV: NavItem[] = [
  { to: "/", icon: <LayoutDashboard className="h-5 w-5" />, label: "Painel" },
  { to: "/entrega", icon: <Plus className="h-5 w-5" />, label: "Nova venda" },
  { to: "/clientes", icon: <Users className="h-5 w-5" />, label: "Clientes" },
  { to: "/veiculos", icon: <Car className="h-5 w-5" />, label: "Veículos" },
  { to: "/entregas", icon: <ClipboardList className="h-5 w-5" />, label: "Entregas" },
  { to: "/configuracoes", icon: <Settings className="h-5 w-5" />, label: "Config." },
];

const MOTORISTA_NAV: NavItem[] = [
  { to: "/pendentes", icon: <PackageCheck className="h-5 w-5" />, label: "Pendentes" },
  { to: "/minhas-entregas", icon: <Truck className="h-5 w-5" />, label: "Em rota" },
  { to: "/entrega", icon: <Plus className="h-5 w-5" />, label: "Nova venda" },
  { to: "/operacao", icon: <Wrench className="h-5 w-5" />, label: "Operação" },
  { to: "/configuracoes", icon: <Settings className="h-5 w-5" />, label: "Config." },
];

const MASTER_NAV: NavItem[] = [
  { to: "/master", icon: <Building2 className="h-5 w-5" />, label: "Empresas" },
];


function AuthedLayout() {
  const { data, isLoading, refetch: refetchProfile } = useProfile();
  const navigate = useNavigate();
  const path = useRouterState({ select: (state) => state.location.pathname });
  const isMaster = !!data?.roles.includes("master");
  const isAdmin = !!data?.roles.includes("admin");

  useEffect(() => {
    let cancelado = false;
    const revalidar = async () => {
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      const { data: u, error } = await supabase.auth.getUser();
      if (cancelado) return;
      if (error || !u.user) {
        await supabase.auth.signOut();
        navigate({ to: "/auth", replace: true });
        return;
      }
      try { localStorage.setItem(OFFLINE_VALIDATION_KEY, String(Date.now())); } catch {}
      void refetchProfile();
    };
    void revalidar();
    window.addEventListener("online", revalidar);
    return () => {
      cancelado = true;
      window.removeEventListener("online", revalidar);
    };
  }, [navigate, refetchProfile]);

  useEffect(() => {
    if (data && data.profile_extras && !data.profile_extras.ativo && !isMaster) {
      (async () => {
        await supabase.auth.signOut();
        toast.error("Acesso desativado, contate o administrador");
        navigate({ to: "/auth", replace: true });
      })();
    }
  }, [data, navigate, isMaster]);

  const empresaId = data?.profile.empresa_id;
  useEffect(() => {
    if (!empresaId || isMaster) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    (async () => {
      const { data: emp, error } = await (supabase as any)
        .from("empresas")
        .select("ativa, data_vencimento")
        .eq("id", empresaId)
        .maybeSingle();
      if (error) return;
      const hoje = new Date().toISOString().slice(0, 10);
      const bloqueada = !emp || !emp.ativa || (emp.data_vencimento && emp.data_vencimento < hoje);
      if (bloqueada && window.location.pathname !== "/acesso-expirado") {
        navigate({ to: "/acesso-expirado", replace: true });
      }
    })();
  }, [empresaId, isMaster, navigate]);

  useEffect(() => {
    if (
      data &&
      data.profile_extras?.precisa_trocar_senha &&
      window.location.pathname !== "/trocar-senha"
    ) {
      navigate({ to: "/trocar-senha", replace: true });
    }
  }, [data, navigate]);

  const masterForaDaArea = isMaster && !path.startsWith("/master");
  useEffect(() => {
    if (masterForaDaArea) {
      navigate({ to: "/master", replace: true });
    }
  }, [masterForaDaArea, navigate]);


  if (isLoading || masterForaDaArea) {
    return (
      <div className="min-h-screen grid place-items-center text-muted-foreground">
        Carregando...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen grid place-items-center p-6 text-center">
        <div>
          <p className="text-sm text-muted-foreground mb-4">Perfil não encontrado.</p>
          <Button
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/auth" });
            }}
          >
            Sair
          </Button>
        </div>
      </div>
    );
  }

  const items = isMaster ? MASTER_NAV : isAdmin ? ADMIN_NAV : MOTORISTA_NAV;


  async function handleLogout() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      <aside className="hidden md:flex flex-col w-64 fixed inset-y-0 left-0 bg-card border-r z-30 shadow-md">
        <div className="p-5 border-b flex items-center justify-between">
          <Logo variant="horizontal" size="md" />
        </div>
        
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          {items.map((item) => (
            <SidebarNavBtn key={item.to} {...item} />
          ))}
        </nav>
        
        <div className="p-4 border-t bg-muted/40 space-y-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-full bg-primary/10 text-primary font-heading font-bold text-sm grid place-items-center shrink-0">
              {data.profile.nome.substring(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-foreground truncate leading-tight">
                {data.profile.nome}
              </div>
              <div className="text-[10px] text-muted-foreground capitalize leading-tight">
                {data.roles.join(", ")}
              </div>
            </div>
            <SyncStatus />
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="w-full justify-start text-xs font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-2 h-9 rounded-xl"
          >
            <LogOut className="h-4 w-4" />
            Sair da conta
          </Button>
        </div>
      </aside>

      <header className="md:hidden sticky top-0 z-30 border-b bg-card/90 backdrop-blur-md px-4 h-14 flex items-center justify-between shadow-sm">
        <Logo variant="horizontal" size="sm" />
        <div className="flex items-center gap-2 max-w-[50%]">
          <SyncStatus />
          <Button
            size="icon"
            variant="ghost"
            onClick={handleLogout}
            aria-label="Sair"
            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl"
          >
            <LogOut className="h-4.5 w-4.5" />
          </Button>
        </div>
      </header>

      <OfflineProvider />

      <div className="flex-1 flex flex-col min-w-0 md:pl-64 min-h-screen">
        <main className="px-4 py-6 md:py-8 max-w-4xl mx-auto flex-1 w-full pb-28 md:pb-8">
          <Outlet />
        </main>
      </div>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t bg-card/90 backdrop-blur-md shadow-[0_-5px_15px_rgba(0,0,0,0.03)] z-30 pb-[calc(env(safe-area-inset-bottom)+0.25rem)]">
        <div
          className="max-w-3xl mx-auto grid gap-1 px-3 py-1.5"
          style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
        >
          {items.map((item) => (
            <NavBtn key={item.to} {...item} />
          ))}
        </div>
      </nav>
    </div>
  );
}

function SidebarNavBtn({ to, icon, label }: NavItem) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground [&.active]:bg-primary [&.active]:text-primary-foreground hover:bg-muted/70 hover:text-foreground transition-all duration-200"
      activeOptions={{ exact: true }}
    >
      {({ isActive }) => (
        <>
          <div className={`transition-colors ${isActive ? 'text-inherit' : 'text-[#F57C00]'}`}>
            {icon}
          </div>
          <span className="truncate">{label}</span>
        </>
      )}
    </Link>
  );
}

function NavBtn({ to, icon, label }: NavItem) {
  return (
    <Link
      to={to}
      className="flex flex-col items-center justify-center gap-1 py-1 text-[10px] font-medium text-muted-foreground [&.active]:text-primary [&.active]:font-semibold transition-all duration-200 active:scale-95"
      activeOptions={{ exact: true }}
    >
      {({ isActive }) => (
        <>
          <div className={`p-1.5 rounded-xl transition-all duration-200 ${isActive ? 'bg-primary/10 text-[#F57C00] scale-110 shadow-sm' : 'text-muted-foreground hover:bg-muted/30'}`}>
            {React.cloneElement(icon as React.ReactElement, { className: "h-5 w-5 stroke-[2]" })}
          </div>
          <span className={`text-[9px] tracking-wide transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>{label}</span>
        </>
      )}
    </Link>
  );
}
