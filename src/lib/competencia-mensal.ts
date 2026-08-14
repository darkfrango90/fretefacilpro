import { calcularValorMateriais } from "@/lib/entrega-itens";

export type IntervaloCompetencia = {
  inicioIso: string;
  fimIso: string;
  inicioLabel: string;
  fimLabel: string;
  fechamentoLabel: string;
  emAberto: boolean;
};

export function competenciaAtual(agora = new Date()): string {
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;
}

export function obterIntervaloCompetencia(
  competencia: string,
  agora = new Date(),
): IntervaloCompetencia {
  const [anoTexto, mesTexto] = competencia.split("-");
  const ano = Number(anoTexto);
  const mes = Number(mesTexto);
  const inicio = new Date(ano, mes - 1, 1, 0, 0, 0, 0);
  const fechamento = new Date(ano, mes, 0, 23, 59, 59, 999);
  const emAberto = competencia === competenciaAtual(agora);
  const fim = emAberto && agora < fechamento ? agora : fechamento;
  const formatar = (data: Date) => data.toLocaleDateString("pt-BR");

  return {
    inicioIso: inicio.toISOString(),
    fimIso: fim.toISOString(),
    inicioLabel: formatar(inicio),
    fimLabel: formatar(fim),
    fechamentoLabel: formatar(fechamento),
    emAberto,
  };
}

export function calcularValoresEntrega(entrega: {
  itens?: unknown;
  material_id?: string | null;
  quantidade?: number | string | null;
  valor_praticado?: number | string | null;
  valor_frete?: number | string | null;
}) {
  return {
    vendasMaterial: calcularValorMateriais(entrega),
    fretes: Number(entrega.valor_frete || 0),
  };
}
