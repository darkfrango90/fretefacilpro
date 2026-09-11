import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-session";
import { pendingByType } from "@/lib/offline/queue";
import { readOfflineCache, writeOfflineCache } from "@/lib/offline/cache";

/**
 * Checklist semanal obrigatório do motorista: um por semana, cobrado a partir
 * de segunda. Enquanto não é enviado, o app bloqueia vendas e entregas.
 */

export const CHECKLIST_ITENS = [
  { codigo: "pneus_rodas", pergunta: "Pneus e rodas" },
  { codigo: "freios", pergunta: "Freios do caminhão" },
  { codigo: "direcao_suspensao", pergunta: "Direção e suspensão" },
  { codigo: "farois_sinalizacao", pergunta: "Faróis, lanternas e sinalização" },
  { codigo: "vidros_retrovisores", pergunta: "Vidros, retrovisores e limpadores" },
  { codigo: "cinto_banco_portas", pergunta: "Cinto de segurança, banco e portas" },
  { codigo: "motor_niveis", pergunta: "Motor e níveis de óleo e água" },
  { codigo: "cacamba_basculamento", pergunta: "Caçamba e sistema de basculamento" },
  { codigo: "lona_travas", pergunta: "Lona e travas da caçamba" },
  { codigo: "equipamentos_seguranca", pergunta: "Equipamentos de segurança e emergência" },
  { codigo: "documentacao", pergunta: "Documentação do caminhão e do motorista" },
  { codigo: "disposicao_motorista", pergunta: "Disposição e atenção do motorista para dirigir" },
  {
    codigo: "higiene_epi",
    pergunta: "Higiene pessoal, uniforme e equipamentos de proteção",
  },
  { codigo: "limpeza_caminhao", pergunta: "Limpeza e organização do caminhão" },
] as const;

export type RespostaChecklist = "otima" | "nao_verificado" | "ruim";

export const RESPOSTAS_CHECKLIST: { valor: RespostaChecklist; label: string }[] = [
  { valor: "otima", label: "Ótima" },
  { valor: "nao_verificado", label: "Não verificado" },
  { valor: "ruim", label: "Ruim" },
];

export function rotuloResposta(valor: string): string {
  return RESPOSTAS_CHECKLIST.find((r) => r.valor === valor)?.label ?? valor;
}

export type ItemRespondido = {
  codigo: string;
  pergunta: string;
  resposta: RespostaChecklist;
};

export type ChecklistRegistro = {
  id: string;
  semana: string;
  respostas: ItemRespondido[];
  observacoes: string | null;
  preenchido_em: string;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function isoLocal(data: Date) {
  return `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}`;
}

/** Segunda-feira (aaaa-mm-dd, horário local) da semana da data informada. */
export function segundaDaSemana(data: Date = new Date()): string {
  const d = new Date(data.getFullYear(), data.getMonth(), data.getDate());
  const diasDesdeSegunda = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diasDesdeSegunda);
  return isoLocal(d);
}

/** Soma dias a uma data aaaa-mm-dd. */
export function somarDias(iso: string, dias: number): string {
  const [ano, mes, dia] = iso.split("-").map(Number);
  return isoLocal(new Date(ano, mes - 1, dia + dias));
}

export function descreverSemana(segunda: string): string {
  const br = (iso: string) => {
    const [a, m, d] = iso.split("-");
    return `${d}/${m}/${a}`;
  };
  return `${br(segunda)} a ${br(somarDias(segunda, 6))}`;
}

export function contarRespostas(respostas: ItemRespondido[] | null | undefined) {
  const total = { otima: 0, nao_verificado: 0, ruim: 0 };
  for (const item of respostas ?? []) {
    if (item.resposta in total) total[item.resposta] += 1;
  }
  return total;
}

/**
 * Situação do checklist da semana atual para o usuário logado.
 * Só motoristas são cobrados — admin e master nunca ficam bloqueados.
 * Um checklist ainda na fila offline já conta como enviado.
 */
export function useChecklistSemanal() {
  const { data: prof } = useProfile();
  const queryClient = useQueryClient();
  const roles = prof?.roles ?? [];
  const exigido =
    roles.includes("motorista") && !roles.includes("admin") && !roles.includes("master");
  const userId = prof?.profile.id;
  const empresaId = prof?.profile.empresa_id;
  const semana = segundaDaSemana();
  const cacheKey = userId ? `checklist-semanal:${userId}:${semana}` : null;

  const consulta = useQuery({
    queryKey: ["checklist-semanal", userId, semana],
    enabled: exigido && !!userId,
    retry: 1,
    networkMode: "offlineFirst",
    initialData: () => readOfflineCache<ChecklistRegistro>(cacheKey),
    queryFn: async (): Promise<ChecklistRegistro | null> => {
      const { data, error } = await (supabase as any)
        .from("checklists_semanais")
        .select("id, semana, respostas, observacoes, preenchido_em")
        .eq("motorista_id", userId)
        .eq("semana", semana)
        .maybeSingle();
      if (error) throw error;
      // Só guarda o resultado positivo: "ainda não fez" nunca fica em cache.
      if (data) writeOfflineCache(cacheKey, data);
      return data ?? null;
    },
  });

  const [naFila, setNaFila] = useState<ChecklistRegistro | null | undefined>(undefined);

  useEffect(() => {
    if (!exigido || !userId || !empresaId) return;
    let ativo = true;
    const atualizar = async () => {
      const itens = await pendingByType("checklist_semanal", userId, empresaId);
      const item = itens.find((i) => i.payload.semana === semana && !i.recusado);
      if (!ativo) return;
      setNaFila(item ? ({ id: item.id, ...item.payload } as ChecklistRegistro) : null);
    };
    const aoSincronizar = () => {
      void atualizar();
      void queryClient.invalidateQueries({ queryKey: ["checklist-semanal", userId] });
    };
    void atualizar();
    window.addEventListener("offline-outbox-changed", atualizar);
    window.addEventListener("offline-sync-finished", aoSincronizar);
    return () => {
      ativo = false;
      window.removeEventListener("offline-outbox-changed", atualizar);
      window.removeEventListener("offline-sync-finished", aoSincronizar);
    };
  }, [exigido, userId, empresaId, semana, queryClient]);

  const registro = consulta.data ?? naFila ?? null;
  return {
    exigido,
    semana,
    registro,
    aguardandoSincronizacao: !consulta.data && !!naFila,
    feito: !!registro,
    carregando: exigido && !registro && (consulta.isLoading || naFila === undefined),
  };
}
