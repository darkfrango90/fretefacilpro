import { createFileRoute } from "@tanstack/react-router";
import { CrudPage } from "@/components/crud-page";
import { useProfile } from "@/hooks/use-session";
import { AdminOnly } from "@/components/role-guard";

export const Route = createFileRoute("/_authenticated/materiais")({
  component: () => (
    <AdminOnly>
      <Page />
    </AdminOnly>
  ),
});

function Page() {
  const { data } = useProfile();
  if (!data) return null;
  return (
    <CrudPage
      title="Materiais"
      table="materiais"
      empresaId={data.profile.empresa_id}
      defaults={{ unidade: "m3", ativo: true }}
      fields={[
        { name: "nome", label: "Nome (ex: Areia média)", required: true },
        { name: "preco_base", label: "Preço base (R$)", type: "number", step: "0.01", required: true },
      ]}
      renderRow={(r) => (
        <div>
          <div className="font-medium truncate">{r.nome}</div>
          <div className="text-xs text-muted-foreground">
            R$ {Number(r.preco_base).toFixed(2)} / {r.unidade}
          </div>
        </div>
      )}
    />
  );
}
