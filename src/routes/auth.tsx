import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Logo } from "@/components/logo";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Entrar — Frete Fácil PRO" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  // Check session redirect
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) {
        navigate({ to: "/dashboard", replace: true });
      }
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
    window.history.replaceState({}, "", "/auth");
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div
      style={{ background: "linear-gradient(135deg, #0b1530 0%, #1B2A4A 50%, #0f2040 100%)" }}
      className="min-h-screen flex flex-col items-center justify-center px-4 py-8"
    >
      <div className="w-full max-w-md">
        <div className="rounded-3xl bg-white text-foreground shadow-2xl border border-white/10">
          <div className="flex flex-col items-center px-6 pt-8 pb-4">
            <Logo variant="stacked" size="lg" />
          </div>

          <div className="px-6 pb-8 pt-2">
            <form onSubmit={signIn} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="li-email" className="text-sm font-medium text-slate-700">
                  Email
                </label>
                <input
                  id="li-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="voce@empresa.com"
                  style={{ WebkitAppearance: "none" }}
                  className="w-full h-11 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400 placeholder-slate-400"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="li-pwd" className="text-sm font-medium text-slate-700">
                  Senha
                </label>
                <input
                  id="li-pwd"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  style={{ WebkitAppearance: "none" }}
                  className="w-full h-11 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400 placeholder-slate-400"
                />
              </div>
              <Button type="submit" variant="action" size="lg" className="w-full mt-2" disabled={loading}>
                {loading ? "Entrando..." : "Entrar"}
              </Button>
              <p className="text-center text-xs text-slate-500 pt-1">
                Não tem cadastro? Solicite acesso ao suporte.
              </p>
            </form>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-white/60">
          © {new Date().getFullYear()} Frete Fácil PRO
        </p>
        <p className="mt-1 text-center text-[11px] text-white/40">
          Sistema desenvolvido por Rodrigo Rodrigues · Contato: (63) 98444-6555
        </p>
      </div>
    </div>
  );
}
