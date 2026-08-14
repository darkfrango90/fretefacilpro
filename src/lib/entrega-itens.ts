export type EntregaItem = {
  material_id: string;
  nome?: string | null;
  unidade?: string | null;
  preco_base?: number | string | null;
  valor_praticado: number | string;
  quantidade: number | string;
};

type EntregaComItens = {
  itens?: unknown;
  material_id?: string | null;
  material?: { nome?: string | null; unidade?: string | null } | null;
  materiais?: { nome?: string | null; unidade?: string | null } | null;
  preco_base_no_momento?: number | string | null;
  valor_praticado?: number | string | null;
  quantidade?: number | string | null;
};

export function obterItensEntrega(entrega: EntregaComItens): EntregaItem[] {
  if (Array.isArray(entrega.itens) && entrega.itens.length > 0) {
    return entrega.itens.slice(0, 3).filter((item): item is EntregaItem => {
      if (!item || typeof item !== "object") return false;
      const registro = item as Record<string, unknown>;
      return typeof registro.material_id === "string" && registro.material_id.length > 0;
    });
  }

  if (!entrega.material_id) return [];
  const material = entrega.material ?? entrega.materiais;
  return [
    {
      material_id: entrega.material_id,
      nome: material?.nome ?? null,
      unidade: material?.unidade ?? null,
      preco_base: entrega.preco_base_no_momento ?? 0,
      valor_praticado: entrega.valor_praticado ?? 0,
      quantidade: entrega.quantidade ?? 1,
    },
  ];
}

export function calcularValorMateriais(entrega: EntregaComItens): number {
  return obterItensEntrega(entrega).reduce(
    (total, item) => total + Number(item.valor_praticado || 0) * Number(item.quantidade || 1),
    0,
  );
}

export function entregaPossuiMaterial(entrega: EntregaComItens, materialId: string): boolean {
  return obterItensEntrega(entrega).some((item) => item.material_id === materialId);
}

export function resumoMateriais(entrega: EntregaComItens): string {
  const itens = obterItensEntrega(entrega);
  if (itens.length === 0) return "Material não informado";
  return itens
    .map((item) => {
      const nome = item.nome || "Material";
      const unidade = item.unidade ? ` ${item.unidade}` : "";
      return `${nome} · ${Number(item.quantidade || 1).toLocaleString("pt-BR")}${unidade}`;
    })
    .join(" + ");
}
