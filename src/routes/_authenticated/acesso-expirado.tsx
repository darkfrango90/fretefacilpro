import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { AlertCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/acesso-expirado")({
  component: AcessoExpirado,
});

function AcessoExpirado() {
  const navigate = useNavigate();
  return (
    <div className="min-h-[70vh] grid place-items-center p-6 text-center">
      <div className="max-w-sm space-y-4">
        <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
        <h1 className="text-xl font-heading font-bold">Acesso expirado</h1>
        <p className="text-sm text-muted-foreground">
          Sua assinatura está vencida ou inativa. Entre em contato com o suporte para regularizar.
        </p>
        <Button
          variant="outline"
          onClick={async () => {
            await supabase.auth.signOut();
            navigate({ to: "/auth", replace: true });
          }}
        >
          Sair
        </Button>
      </div>
    </div>
  );
}
