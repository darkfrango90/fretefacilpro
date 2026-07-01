import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/trocar-senha")({
  component: TrocarSenha,
});

function TrocarSenha() {
  const { data, refetch } = useProfile();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  // Se não precisa trocar, manda pra home
  useEffect(() => {
    if (data && !data.profile_extras?.precisa_trocar_senha) {
      navigate({ to: "/", replace: true });
    }
  }, [data, navigate]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const s1 = String(fd.get("s1"));
    const s2 = String(fd.get("s2"));
    if (s1.length < 6) return toast.error("Senha deve ter ao menos 6 caracteres");
    if (s1 !== s2) return toast.error("As senhas não conferem");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: s1 });
    if (error) {
      setLoading(false);
      return toast.error(error.message);
    }
    if (data) {
      await (supabase as any)
        .from("profiles")
        .update({ precisa_trocar_senha: false })
        .eq("id", data.profile.id);
    }
    setLoading(false);
    toast.success("Senha atualizada!");
    await refetch();
    navigate({ to: "/", replace: true });
  }

  return (
    <div className="max-w-sm mx-auto space-y-4">
      <h1 className="text-xl font-bold">Definir nova senha</h1>
      <p className="text-sm text-muted-foreground">
        Por segurança, defina uma nova senha antes de continuar.
      </p>
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <Label htmlFor="s1">Nova senha</Label>
          <Input id="s1" name="s1" type="password" required minLength={6} />
        </div>
        <div>
          <Label htmlFor="s2">Confirmar nova senha</Label>
          <Input id="s2" name="s2" type="password" required minLength={6} />
        </div>
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Salvando…" : "Salvar nova senha"}
        </Button>
      </form>
    </div>
  );
}
