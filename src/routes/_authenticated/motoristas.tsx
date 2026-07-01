import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-session";
import { AdminOnly } from "@/components/role-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UserPlus, Power, RotateCcw, Copy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/motoristas")({
  component: () => (
    <AdminOnly>
      <Page />
    </AdminOnly>
  ),
});

function Page() {
  const { data: me } = useProfile();
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [criado, setCriado] = useState<{ email: string; senha: string } | null>(
    null,
  );

  const { data: motoristas, refetch } = useQuery({
    enabled: !!me,
    queryKey: ["motoristas", me?.profile.empresa_id],
    queryFn: async () => {
      // perfis da empresa que possuem role motorista
      const { data: roles } = await (supabase as any)
        .from("user_roles")
        .select("user_id")
        .eq("empresa_id", me!.profile.empresa_id)
        .eq("role", "motorista");
      const ids = (roles ?? []).map((r: any) => r.user_id);
      if (!ids.length) return [];
      const { data: profs, error } = await (supabase as any)
        .from("profiles")
        .select("id, nome, email, telefone, ativo")
        .in("id", ids)
        .order("nome");
      if (error) throw error;
      return profs ?? [];
    },
  });

  async function criar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      nome: String(fd.get("nome")),
      email: String(fd.get("email")).trim().toLowerCase(),
      senha: String(fd.get("senha")),
      telefone: String(fd.get("telefone") || ""),
      precisa_trocar_senha: true,
    };
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("criar-motorista", {
      body: payload,
    });
    setLoading(false);
    if (error || (data as any)?.erro) {
      return toast.error(
        (data as any)?.erro || error?.message || "Falha ao criar motorista",
      );
    }
    setCriado({ email: payload.email, senha: payload.senha });
    (e.currentTarget as HTMLFormElement).reset();
    qc.invalidateQueries({ queryKey: ["motoristas"] });
    toast.success("Motorista cadastrado");
  }

  async function toggleAtivo(id: string, ativo: boolean) {
    const { error } = await (supabase as any)
      .from("profiles")
      .update({ ativo: !ativo })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(!ativo ? "Motorista reativado" : "Motorista desativado");
    refetch();
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">Motoristas</h1>
        <p className="text-xs text-muted-foreground">
          Cadastre, desative ou reative motoristas da sua empresa.
        </p>
      </div>

      <section className="rounded-xl border bg-card p-4 space-y-3">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <UserPlus className="h-4 w-4" /> Novo motorista
        </h2>
        <form onSubmit={criar} className="grid gap-3">
          <div>
            <Label htmlFor="nome">Nome</Label>
            <Input id="nome" name="nome" required />
          </div>
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div>
            <Label htmlFor="senha">Senha inicial</Label>
            <Input id="senha" name="senha" type="text" required minLength={6} />
          </div>
          <div>
            <Label htmlFor="telefone">Telefone (opcional)</Label>
            <Input id="telefone" name="telefone" type="tel" />
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? "Cadastrando…" : "Cadastrar motorista"}
          </Button>
        </form>

        {criado && (
          <div className="rounded-lg border bg-accent/40 p-3 text-xs space-y-1">
            <div className="font-semibold">Conta criada — repasse ao motorista:</div>
            <div>
              <span className="text-muted-foreground">E-mail:</span> {criado.email}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Senha:</span> {criado.senha}
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={() => {
                  navigator.clipboard?.writeText(
                    `E-mail: ${criado.email}\nSenha: ${criado.senha}`,
                  );
                  toast.success("Copiado");
                }}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
            <div className="text-muted-foreground">
              No primeiro acesso será solicitada a troca de senha.
            </div>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Cadastrados</h2>
        <div className="grid gap-2">
          {(motoristas ?? []).map((m: any) => (
            <div
              key={m.id}
              className="rounded-xl border bg-card p-3 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="font-medium truncate">{m.nome}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {m.email || "—"} {m.telefone ? `· ${m.telefone}` : ""}
                </div>
                <div className="text-[10px] mt-0.5">
                  {m.ativo ? (
                    <span className="text-emerald-600">● ativo</span>
                  ) : (
                    <span className="text-destructive">● inativo</span>
                  )}
                </div>
              </div>
              <Button
                size="sm"
                variant={m.ativo ? "destructive" : "default"}
                onClick={() => toggleAtivo(m.id, m.ativo)}
              >
                {m.ativo ? (
                  <>
                    <Power className="h-3 w-3 mr-1" /> Desativar
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-3 w-3 mr-1" /> Reativar
                  </>
                )}
              </Button>
            </div>
          ))}
          {motoristas && motoristas.length === 0 && (
            <div className="text-xs text-muted-foreground">
              Nenhum motorista cadastrado ainda.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
