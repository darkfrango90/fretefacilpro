import { createFileRoute } from "@tanstack/react-router";
import { CrudPage } from "@/components/crud-page";
import { useProfile } from "@/hooks/use-session";
import { AdminOnly } from "@/components/role-guard";
import { supabase } from "@/integrations/supabase/client";

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
  const empresaId = data.profile.empresa_id;

  async function loadRows() {
    const [{ data: materiais, error: materiaisError }, { data: custos, error: custosError }] =
      await Promise.all([
        (supabase as any)
          .from("materiais")
          .select("*")
          .eq("empresa_id", empresaId)
          .order("criado_em", { ascending: false }),
        (supabase as any)
          .from("materiais_custos")
          .select("material_id, custo_compra")
          .eq("empresa_id", empresaId),
      ]);
    if (materiaisError) throw materiaisError;
    if (custosError) throw custosError;
    const custoPorMaterial = new Map(
      (custos ?? []).map((custo: any) => [custo.material_id, Number(custo.custo_compra || 0)]),
    );
    return (materiais ?? []).map((material: any) => ({
      ...material,
      custo_compra: custoPorMaterial.get(material.id) ?? 0,
    }));
  }

  async function saveRow(row: Record<string, any>, editing: any | null) {
    const { custo_compra, ...material } = row;
    let materialId = editing?.id as string | undefined;

    if (materialId) {
      const { error } = await (supabase as any)
        .from("materiais")
        .update(material)
        .eq("id", materialId);
      if (error) throw error;
    } else {
      const { data: criado, error } = await (supabase as any)
        .from("materiais")
        .insert(material)
        .select("id")
        .single();
      if (error) throw error;
      materialId = criado.id;
    }

    const { error: custoError } = await (supabase as any).from("materiais_custos").upsert(
      {
        material_id: materialId,
        empresa_id: empresaId,
        custo_compra: Number(custo_compra || 0),
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: "material_id" },
    );
    if (custoError) throw custoError;
  }

  return (
    <CrudPage
      title="Materiais"
      table="materiais"
      empresaId={empresaId}
      defaults={{ unidade: "m3", ativo: true }}
      loadRows={loadRows}
      saveRow={saveRow}
      cacheEnabled={false}
      fields={[
        { name: "nome", label: "Nome (ex: Areia média)", required: true },
        { name: "preco_base", label: "Preço base (R$)", type: "currency", required: true },
        {
          name: "custo_compra",
          label: "Custo de compra (R$)",
          type: "currency",
          required: true,
        },
      ]}
      renderRow={(r) => (
        <div>
          <div className="font-medium truncate">{r.nome}</div>
          <div className="text-xs text-muted-foreground">
            Venda: R$ {Number(r.preco_base).toFixed(2)} / {r.unidade}
          </div>
          <div className="text-xs text-muted-foreground">
            Custo: R$ {Number(r.custo_compra || 0).toFixed(2)} / {r.unidade}
          </div>
        </div>
      )}
    />
  );
}
