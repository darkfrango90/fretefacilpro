import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Logo } from "@/components/logo";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Entrar — Frete Fácil PRO" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) navigate({ to: "/", replace: true });
    });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  async function signIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    e.stopPropagation();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim();
    const password = String(fd.get("password") ?? "");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    // limpa qualquer querystring residual (ex: email/password no URL)
    window.history.replaceState({}, "", "/auth");
    navigate({ to: "/", replace: true });
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0b1530] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-24 h-96 w-96 rounded-full bg-[#1B2A4A] blur-3xl opacity-70" />
        <div className="absolute top-1/3 -right-32 h-[28rem] w-[28rem] rounded-full bg-[#F57C00] blur-[120px] opacity-30" />
        <div className="absolute bottom-0 left-1/4 h-80 w-80 rounded-full bg-[#3b5998] blur-3xl opacity-40" />
      </div>

      <div className="relative grid min-h-screen place-items-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/95 text-foreground shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]">
            <div className="flex flex-col items-center px-6 pt-6 pb-2">
              <Logo variant="stacked" size="lg" />
            </div>

            <div className="px-6 pb-8 pt-2">
              <form onSubmit={signIn} action="#" method="post" className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="li-email">Email</Label>
                  <input
                    id="li-email"
                    name="email"
                    type="email"
                    required
                    autoComplete="username"
                    placeholder="voce@empresa.com"
                    className="flex h-11 w-full rounded-xl border border-input bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#F57C00] focus:border-[#F57C00] placeholder:text-muted-foreground"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="li-pwd">Senha</Label>
                  <input
                    id="li-pwd"
                    name="password"
                    type="password"
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="flex h-11 w-full rounded-xl border border-input bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#F57C00] focus:border-[#F57C00] placeholder:text-muted-foreground"
                  />
                </div>
                <Button type="submit" variant="action" size="lg" className="w-full" disabled={loading}>
                  {loading ? "Entrando..." : "Entrar"}
                </Button>
                <p className="text-center text-xs text-muted-foreground pt-2">
                  Não tem cadastro? Solicite acesso ao suporte.
                </p>
              </form>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-white/70">
            © {new Date().getFullYear()} Frete Fácil PRO
          </p>
          <p className="mt-1 text-center text-[11px] text-white/50">
            Sistema desenvolvido por Rodrigo Rodrigues · Contato: (63) 98444-6555
          </p>
        </div>
      </div>
    </div>
  );
}
