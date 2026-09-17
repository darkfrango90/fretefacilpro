import { readOfflineCache } from "./cache";
import { listPending } from "./queue";
import type { OutboxItem } from "./db";

/**
 * Venda, início e finalização feitos sem internet ficam só na fila local até
 * sincronizar. Estas funções montam, a partir da fila e dos caches de listas,
 * as linhas que as telas exibem no lugar dos dados do servidor.
 */

export type EstadoNaFila = "venda" | "iniciando" | "finalizando";

function lerListaCache(empresaId: string | undefined, prefixos: string[]): any[] {
  if (!empresaId || typeof localStorage === "undefined") return [];
  for (const prefixo of prefixos) {
    try {
      const raw = localStorage.getItem(`${prefixo}:${empresaId}`);
      const lista = raw ? JSON.parse(raw) : null;
      if (Array.isArray(lista)) return lista;
    } catch {}
  }
  return [];
}

/** Card de uma venda cadastrada neste aparelho e ainda não enviada. */
export function vendaDaFilaParaLinha(item: OutboxItem, empresaId?: string) {
  const payload = item.payload;
  const clientes = lerListaCache(empresaId, ["clientes-list:cache", "clientes:cache"]);
  const materiais = lerListaCache(empresaId, ["materiais-list:cache", "crud:materiais:cache"]);
  const itens = Array.isArray(payload.itens)
    ? payload.itens.map((it: any) => {
        const material = materiais.find((m) => m.id === it.material_id);
        return { ...it, nome: it.nome ?? material?.nome, unidade: it.unidade ?? material?.unidade };
      })
    : payload.itens;
  return {
    ...payload,
    id: item.id,
    itens,
    criada_em: new Date(item.created_at).toISOString(),
    cliente: { nome: clientes.find((c) => c.id === payload.cliente_id)?.nome ?? "Cliente" },
    _naFila: "venda" as EstadoNaFila,
  };
}

/** Dados da venda: fila local primeiro, depois o último resultado de Pendentes. */
function localizarVenda(
  entregaId: string,
  fila: OutboxItem[],
  empresaId: string | undefined,
  uid: string | undefined,
): Record<string, any> | undefined {
  const vendaNaFila = fila.find((i) => i.type === "entrega" && i.id === entregaId);
  if (vendaNaFila) return vendaDaFilaParaLinha(vendaNaFila, empresaId);
  if (!empresaId || !uid) return undefined;
  return [
    ...(readOfflineCache<any[]>(`entregas:pendentes:${empresaId}:${uid}`) ?? []),
    ...(readOfflineCache<any[]>(`entregas:pendentes:${empresaId}:admin`) ?? []),
    ...(readOfflineCache<any[]>(`entregas:em-rota:${uid}`) ?? []),
  ].find((r) => r.id === entregaId);
}

/** Card "em rota" de uma entrega cujo início ainda está só na fila local. */
export function inicioDaFilaParaLinha(
  item: OutboxItem,
  fila: OutboxItem[],
  empresaId: string | undefined,
  uid: string | undefined,
) {
  const payload = item.payload;
  const entregaId = payload.entrega_id as string;
  const venda = localizarVenda(entregaId, fila, empresaId, uid);
  const veiculo = empresaId
    ? readOfflineCache<any[]>(`veiculos:ativos:${empresaId}`)?.find(
        (v) => v.id === payload.veiculo_id,
      )
    : undefined;
  const finalizando = fila.some(
    (i) => i.type === "finalizar_entrega" && i.payload.entrega_id === entregaId,
  );
  return {
    ...venda,
    id: entregaId,
    km_inicial: payload.km_inicial,
    status: "em_rota",
    veiculo: veiculo ? { placa: veiculo.placa } : null,
    cliente: venda?.cliente ?? { nome: "Entrega" },
    _naFila: (finalizando ? "finalizando" : "iniciando") as EstadoNaFila,
    _filaId: item.id,
  };
}

/**
 * Entrega iniciada offline e ainda não sincronizada, no formato usado pela
 * tela de finalização. `null` quando o início já está no servidor.
 */
export async function entregaIniciadaNaFila(
  entregaId: string,
  empresaId: string | undefined,
  uid: string | undefined,
) {
  if (!empresaId || !uid) return null;
  const fila = (await listPending(uid, empresaId)).filter((i) => !i.recusado);
  const inicio = fila.find(
    (i) => i.type === "iniciar_entrega" && i.payload.entrega_id === entregaId,
  );
  return inicio ? inicioDaFilaParaLinha(inicio, fila, empresaId, uid) : null;
}
