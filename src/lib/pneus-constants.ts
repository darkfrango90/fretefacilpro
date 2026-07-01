export const POSICOES_PNEU: { value: string; label: string; grupo: "dianteiro" | "traseiro" | "carreta" | "estepe" }[] = [
  // Dianteiros
  { value: "dianteiro_esquerdo",         label: "Dianteiro Esquerdo",      grupo: "dianteiro" },
  { value: "dianteiro_direito",          label: "Dianteiro Direito",       grupo: "dianteiro" },
  
  // Traseiros Eixo 1 (Toco / Truck / Carreta - Rodas Duplas)
  { value: "traseiro_esquerdo_externo",  label: "Traseiro Esq. Ext. (Eixo 1)",  grupo: "traseiro" },
  { value: "traseiro_esquerdo_interno",  label: "Traseiro Esq. Int. (Eixo 1)",  grupo: "traseiro" },
  { value: "traseiro_direito_interno",   label: "Traseiro Dir. Int. (Eixo 1)",  grupo: "traseiro" },
  { value: "traseiro_direito_externo",   label: "Traseiro Dir. Ext. (Eixo 1)",  grupo: "traseiro" },

  // Traseiros Eixo 2 (Truck / Carreta - Rodas Duplas)
  { value: "traseiro_2_esquerdo_externo", label: "Traseiro Esq. Ext. (Eixo 2)",  grupo: "traseiro" },
  { value: "traseiro_2_esquerdo_interno", label: "Traseiro Esq. Int. (Eixo 2)",  grupo: "traseiro" },
  { value: "traseiro_2_direito_interno",  label: "Traseiro Dir. Int. (Eixo 2)",  grupo: "traseiro" },
  { value: "traseiro_2_direito_externo",  label: "Traseiro Dir. Ext. (Eixo 2)",  grupo: "traseiro" },

  // Carreta Trailer (Eixos 3, 4, 5 - Rodas Simples)
  { value: "carreta_1_esquerdo",         label: "Carreta Esq. (Eixo 3)",   grupo: "carreta" },
  { value: "carreta_1_direito",          label: "Carreta Dir. (Eixo 3)",   grupo: "carreta" },
  { value: "carreta_2_esquerdo",         label: "Carreta Esq. (Eixo 4)",   grupo: "carreta" },
  { value: "carreta_2_direito",          label: "Carreta Dir. (Eixo 4)",   grupo: "carreta" },
  { value: "carreta_3_esquerdo",         label: "Carreta Esq. (Eixo 5)",   grupo: "carreta" },
  { value: "carreta_3_direito",          label: "Carreta Dir. (Eixo 5)",   grupo: "carreta" },

  // Traseiros Camionete (Eixo simples)
  { value: "traseiro_esquerdo",          label: "Traseiro Esquerdo",       grupo: "traseiro" },
  { value: "traseiro_direito",           label: "Traseiro Direito",        grupo: "traseiro" },

  // Estepe
  { value: "estepe",                     label: "Estepe",                  grupo: "estepe" },
];

export const getPosicoesPorVeiculo = (tipo?: string | null) => {
  const t = tipo || "toco";
  if (t === "camionete") {
    return POSICOES_PNEU.filter(p => ["dianteiro_esquerdo", "dianteiro_direito", "traseiro_esquerdo", "traseiro_direito", "estepe"].includes(p.value));
  }
  if (t === "toco") {
    return POSICOES_PNEU.filter(p => ["dianteiro_esquerdo", "dianteiro_direito", "traseiro_esquerdo_externo", "traseiro_esquerdo_interno", "traseiro_direito_interno", "traseiro_direito_externo", "estepe"].includes(p.value));
  }
  if (t === "truck") {
    return POSICOES_PNEU.filter(p => ["dianteiro_esquerdo", "dianteiro_direito", "traseiro_esquerdo_externo", "traseiro_esquerdo_interno", "traseiro_direito_interno", "traseiro_direito_externo", "traseiro_2_esquerdo_externo", "traseiro_2_esquerdo_interno", "traseiro_2_direito_interno", "traseiro_2_direito_externo", "estepe"].includes(p.value));
  }
  if (t === "carreta") {
    // Todos, exceto os traseiros simples da camionete
    return POSICOES_PNEU.filter(p => p.value !== "traseiro_esquerdo" && p.value !== "traseiro_direito");
  }
  return POSICOES_PNEU;
};

export const labelPosicao = (v: string) =>
  POSICOES_PNEU.find((p) => p.value === v)?.label ?? v;

export const MOTIVOS_REMOCAO: { value: string; label: string }[] = [
  { value: "desgaste",  label: "Desgaste"  },
  { value: "furo",      label: "Furo"      },
  { value: "estouro",   label: "Estouro"   },
  { value: "rodizio",   label: "Rodízio"   },
  { value: "outros",    label: "Outros"    },
];
export const labelMotivo = (v?: string | null) =>
  v ? MOTIVOS_REMOCAO.find((m) => m.value === v)?.label ?? v : "—";

