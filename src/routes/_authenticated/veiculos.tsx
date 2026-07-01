import { createFileRoute } from "@tanstack/react-router";
import { CrudPage } from "@/components/crud-page";
import { useProfile } from "@/hooks/use-session";
import { AdminOnly } from "@/components/role-guard";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/veiculos")({
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
      title="Veículos"
      table="veiculos"
      empresaId={data.profile.empresa_id}
      defaults={{ ativo: true, tipo: "toco" }}
      fields={[
        { name: "placa", label: "Placa", required: true },
        { name: "descricao", label: "Descrição (ex: Caçamba trucada)" },
        {
          name: "tipo",
          label: "Tipo de Veículo",
          type: "select",
          required: true,
          options: [
            { value: "camionete", label: "Camionete / Convencional (4 rodas)" },
            { value: "toco", label: "Toco (6 rodas)" },
            { value: "truck", label: "Truck / Trucado (10 rodas)" },
            { value: "carreta", label: "Carreta (16 rodas)" },
          ],
        },
      ]}
      renderRow={(r) => (
        <div className="flex items-center justify-between w-full gap-2">
          <div className="min-w-0 flex-1">
            <div className="font-medium uppercase">{r.placa}</div>
            <div className="text-xs text-muted-foreground truncate">{r.descricao || "—"}</div>
          </div>
          <Badge variant="secondary" className="capitalize text-[10px] shrink-0 font-medium bg-primary/10 text-primary border-none hover:bg-primary/20">
            {r.tipo || "toco"}
          </Badge>
        </div>
      )}
    />
  );
}
