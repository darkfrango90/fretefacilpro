import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Fuel, Receipt, CircleDot, ChevronRight } from "lucide-react";
import { useProfile } from "@/hooks/use-session";

export const Route = createFileRoute("/_authenticated/operacao")({
  component: Page,
});

type Item = {
  to?: string;
  titulo: string;
  descricao: string;
  icone: React.ReactNode;
  emBreve?: boolean;
};

function Page() {
  const { data: prof } = useProfile();
  const isAdmin = !!prof?.roles.includes("admin");

  const itens: Item[] = [
    {
      to: "/abastecimento",
      titulo: "Abastecimento",
      descricao: "Registrar abastecimento com foto do cupom",
      icone: <Fuel className="h-6 w-6" />,
    },
    {
      to: isAdmin ? "/despesas" : "/despesas/nova",
      titulo: "Despesas",
      descricao: "Lançar despesas da viagem (pedágio, manutenção, etc.)",
      icone: <Receipt className="h-6 w-6" />,
    },
    {
      to: "/pneus",
      titulo: "Pneus",
      descricao: "Controle por posição, troca e durabilidade do pneu",
      icone: <CircleDot className="h-6 w-6" />,
    },
  ];

  return (
    <div className="space-y-4 pb-6">
      <div>
        <h1 className="text-xl font-bold">Operação</h1>
        <p className="text-sm text-muted-foreground">
          Funções operacionais do veículo
        </p>
      </div>

      <div className="space-y-3">
        {itens.map((item) => {
          const conteudo = (
            <CardContent className="p-4 flex items-center gap-3">
              <div className="grid place-items-center h-12 w-12 rounded-xl bg-primary/10 text-primary shrink-0">
                {item.icone}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold truncate">{item.titulo}</h2>
                  {item.emBreve && (
                    <Badge variant="secondary" className="text-[10px]">
                      Em breve
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {item.descricao}
                </p>
              </div>
              {!item.emBreve && (
                <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
              )}
            </CardContent>
          );

          if (item.emBreve || !item.to) {
            return (
              <Card key={item.titulo} className="opacity-60">
                {conteudo}
              </Card>
            );
          }
          return (
            <Link key={item.titulo} to={item.to} className="block">
              <Card className="active:scale-[0.99] transition-transform">
                {conteudo}
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
