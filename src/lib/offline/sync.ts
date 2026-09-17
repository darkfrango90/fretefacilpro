import { supabase } from "@/integrations/supabase/client";
import { addHistory, listPending, markAttempt, removePending } from "./queue";
import { getDB, type OutboxItem } from "./db";
import { refreshPermissoesCache } from "@/hooks/use-permissoes";
import { parseQuilometragem } from "@/lib/quilometragem";

let syncing = false;
let syncPromise: Promise<SyncResult> | null = null;
let initialized = false;
const LAST_SYNC_KEY = "offline.last_sync_at";
let ultimaExecucao: { identity: NonNullable<SyncIdentity>; tentados: Set<string> } | null = null;

type SyncIdentity = {
  userId: string;
  empresaId: string;
} | null;

export function isSyncing() {
  return syncing;
}

export function getLastSyncAt(): number | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(LAST_SYNC_KEY);
  return v ? Number(v) : null;
}

function setLastSyncAt(ts: number) {
  try {
    localStorage.setItem(LAST_SYNC_KEY, String(ts));
  } catch {}
}

async function uploadOnePhoto(item: OutboxItem, photoIndex: number): Promise<string> {
  const photo = item.photos[photoIndex];
  const path = `${item.empresa_id}/${item.motorista_id}/${item.id}-${photoIndex}.${photo.ext}`;
  const { error } = await supabase.storage.from(photo.bucket).upload(path, photo.blob, {
    cacheControl: "3600",
    upsert: true,
    contentType: photo.contentType,
  });
  if (error) throw error;
  return path;
}

async function getSyncIdentity(): Promise<SyncIdentity> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return null;

  const { data: profile, error: profileError } = await (supabase as any)
    .from("profiles")
    .select("id, empresa_id")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profileError || !profile?.empresa_id) return null;
  return { userId: userData.user.id, empresaId: profile.empresa_id };
}

async function syncEntrega(
  action: "criar_venda" | "iniciar_entrega" | "finalizar_entrega",
  body: Record<string, any>,
) {
  const { data, error } = await supabase.functions.invoke("sync-entrega", {
    body: { action, ...body },
  });
  if (error) throw error;
  if (data?.erro) throw new Error(data.erro);
  return data;
}

async function entregaJaEstaComMotorista(entregaId: string, userId: string): Promise<boolean> {
  const { data, error } = await (supabase as any)
    .from("entregas")
    .select("id")
    .eq("id", entregaId)
    .eq("motorista_entrega_id", userId)
    .in("status", ["em_rota", "entregue"])
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

/** Entrega a que o item pertence, para respeitar a ordem venda → início → fim. */
function entregaDoItem(item: OutboxItem): string | null {
  if (item.type === "entrega") return item.id;
  if (item.type === "iniciar_entrega" || item.type === "finalizar_entrega") {
    return (item.payload.entrega_id as string | undefined) ?? null;
  }
  return null;
}

async function pushOne(item: OutboxItem, identity: SyncIdentity): Promise<void> {
  if (item.type === "iniciar_entrega") {
    const payload: Record<string, any> = { ...item.payload };
    for (let i = 0; i < item.photos.length; i++) {
      payload[item.photos[i].field] = await uploadOnePhoto(item, i);
    }
    try {
      await syncEntrega("iniciar_entrega", payload);
    } catch (e: any) {
      // Reenvio de um início que o servidor já aplicou (a resposta se perdeu
      // na rede): a entrega já está com este motorista, então não é recusa.
      if (
        identity &&
        /ENTREGA_JA_INICIADA/.test(e?.message ?? "") &&
        (await entregaJaEstaComMotorista(payload.entrega_id, identity.userId))
      ) {
        return;
      }
      throw e;
    }
    return;
  }

  if (item.type === "finalizar_entrega") {
    const payload: Record<string, any> = { ...item.payload };
    for (let i = 0; i < item.photos.length; i++) {
      const url = await uploadOnePhoto(item, i);
      payload[item.photos[i].field] = url;
    }
    await syncEntrega("finalizar_entrega", payload);
    return;
  }

  // entrega (cadastro de venda), abastecimento, despesa ou pneu
  const payload: Record<string, any> = { ...item.payload, id: item.id };
  if (identity) {
    if (item.type === "pneu_remocao") {
      // update — não sobrescrever empresa/lançador originais
    } else {
      payload.empresa_id = identity.empresaId;
      if (item.type === "despesa" || item.type === "pneu_instalacao") {
        payload.lancado_por = identity.userId;
      } else {
        payload.motorista_id = identity.userId;
      }
      if (item.type === "entrega") {
        payload.motorista_venda_id = identity.userId;
        payload.motorista_entrega_id = null;
        payload.status = "pendente";
        payload.veiculo_id = null;
      }
    }
  }
  for (let i = 0; i < item.photos.length; i++) {
    const url = await uploadOnePhoto(item, i);
    payload[item.photos[i].field] = url;
  }
  if (item.type === "entrega") {
    await syncEntrega("criar_venda", { local_id: item.id, payload });
    return;
  }
  if (item.type === "despesa") {
    const { error } = await (supabase as any)
      .from("despesas")
      .upsert(payload, { onConflict: "id" });
    if (error) throw error;
    return;
  }
  if (item.type === "pneu_instalacao") {
    // 1. Se houver valor + despesa_id, cria/atualiza a despesa primeiro (idempotente por id)
    if (Number(payload.valor || 0) > 0 && payload.despesa_id && identity) {
      const despesaPayload: Record<string, any> = {
        id: payload.despesa_id,
        empresa_id: identity.empresaId,
        lancado_por: identity.userId,
        categoria: "pneu",
        veiculo_id: payload.veiculo_id,
        descricao:
          `Pneu ${payload.marca ?? ""} ${payload.tipo ?? ""} - posição ${payload.posicao ?? ""}`.trim(),
        valor: Number(payload.valor),
        data: payload.data_instalacao,
        km_veiculo: payload.km_instalacao ?? null,
        foto_cupom_url: payload.foto_url ?? null,
        status: "a_conferir",
      };
      const { error: errD } = await (supabase as any)
        .from("despesas")
        .upsert(despesaPayload, { onConflict: "id" });
      if (errD) throw errD;
    }
    const { error } = await (supabase as any).from("pneus").upsert(payload, { onConflict: "id" });
    if (error) throw error;
    return;
  }
  if (item.type === "pneu_remocao") {
    const { id, ...rest } = payload;
    const { error } = await (supabase as any).from("pneus").update(rest).eq("id", id);
    if (error) throw error;
    return;
  }
  if (item.type === "abastecimento") {
    const kmAtual = parseQuilometragem(payload.km_atual);
    if (kmAtual == null || kmAtual <= 0) throw new Error("KM_ATUAL_INVALIDO");
    payload.km_atual = kmAtual;
  }
  if (item.type === "checklist_semanal") {
    const { error } = await (supabase as any).from("checklists_semanais").insert(payload);
    // 23505: o checklist desta semana já está no servidor (reenvio ou outro
    // aparelho). Não há o que corrigir, então a pendência é descartada.
    if (error && error.code !== "23505") throw error;
    return;
  }
  if (item.type === "troca_oleo") {
    const { error } = await (supabase as any)
      .from("trocas_oleo")
      .upsert(payload, { onConflict: "id" });
    if (error) throw error;
    return;
  }
  const { error } = await (supabase as any)
    .from("abastecimentos")
    .upsert(payload, { onConflict: "id" });
  if (error) throw error;
}

export interface SyncResult {
  sent: number;
  failed: number;
  total: number;
  recusados: number;
}

function isRecusaDefinitiva(msg: string): boolean {
  return /PERMISSAO_NEGADA|ENTREGA_JA_INICIADA|ENTREGA_NAO_ENCONTRADA|CAMINHO_ARQUIVO_INVALIDO|KM_(INICIAL|FINAL)_INVALIDO|FOTO_ODOMETRO_INICIAL_OBRIGATORIA/i.test(
    msg,
  );
}

export function syncNow(opts: { silent?: boolean } = {}): Promise<SyncResult> {
  if (syncPromise) {
    // Uma sincronização já está rodando e pode ter listado a fila antes do item
    // que acabou de ser enfileirado. Espera terminar e roda de novo se sobrou
    // item que ela não tentou; sem isso o item ficava parado até o próximo
    // gatilho (até 60s) e sumia das listas de Pendentes e Em rota.
    return syncPromise.then(async (anterior) => {
      if (!(await temItemNaoTentado())) return anterior;
      return syncNow(opts);
    });
  }

  syncPromise = runSync(opts);
  return syncPromise;
}

async function temItemNaoTentado(): Promise<boolean> {
  if (!ultimaExecucao) return false;
  const { identity, tentados } = ultimaExecucao;
  const itens = await listPending(identity.userId, identity.empresaId);
  return itens.some((i) => !i.recusado && !tentados.has(i.id));
}

async function runSync(opts: { silent?: boolean } = {}): Promise<SyncResult> {
  syncing = true;
  let result: SyncResult = { sent: 0, failed: 0, total: 0, recusados: 0 };
  const started = Date.now();
  let sent = 0;
  let failed = 0;
  let recusados = 0;
  let firstError: string | null = null;
  try {
    const identity = await getSyncIdentity();
    if (!identity) {
      ultimaExecucao = null;
      return result;
    }
    const tentados = new Set<string>();
    ultimaExecucao = { identity, tentados };
    try {
      await refreshPermissoesCache(identity.userId);
    } catch {}

    const items = (await listPending(identity.userId, identity.empresaId)).filter(
      (i) => !i.recusado,
    );
    // Venda, início e finalização feitos offline dependem um do outro. Se uma
    // etapa não subiu nesta rodada, as seguintes da mesma entrega esperam a
    // próxima; enviadas fora de ordem, o servidor as recusaria em definitivo.
    const entregasTravadas = new Set<string>();
    const entregasRecusadas = new Set<string>();
    for (const item of items) {
      tentados.add(item.id);
      const entregaId = entregaDoItem(item);
      if (entregaId && entregasRecusadas.has(entregaId)) {
        recusados++;
        await getDB().outbox.update(item.id, {
          recusado: true,
          last_error: "ETAPA_ANTERIOR_RECUSADA",
          attempts: (item.attempts ?? 0) + 1,
        });
        continue;
      }
      if (entregaId && entregasTravadas.has(entregaId)) {
        failed++;
        if (!firstError) firstError = "Aguardando etapa anterior da entrega";
        continue;
      }
      try {
        await pushOne(item, identity);
        await removePending(item.id);
        sent++;
      } catch (e: any) {
        const msg = e?.message ?? String(e);
        if (isRecusaDefinitiva(msg)) {
          if (entregaId) entregasRecusadas.add(entregaId);
          recusados++;
          await getDB().outbox.update(item.id, {
            recusado: true,
            last_error: msg,
            attempts: (item.attempts ?? 0) + 1,
          });
        } else {
          if (entregaId) entregasTravadas.add(entregaId);
          failed++;
          if (!firstError) firstError = msg;
          await markAttempt(item.id, msg);
        }
      }
    }
    const total = items.length;
    if (total > 0) {
      await addHistory({
        started_at: started,
        finished_at: Date.now(),
        sent_count: sent,
        failed_count: failed + recusados,
        error: firstError ?? (recusados > 0 ? `${recusados} recusado(s)` : null),
      });
      setLastSyncAt(Date.now());
    } else if (!opts.silent) {
      setLastSyncAt(Date.now());
    }
    result = { sent, failed, total, recusados };
    return result;
  } finally {
    syncing = false;
    syncPromise = null;
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent<SyncResult>("offline-sync-finished", { detail: result }),
      );
    }
  }
}

/**
 * Sincroniza, mas não prende a tela quando a rede está lenta: depois de
 * `limiteMs` devolve `null` e o envio segue em segundo plano.
 */
export function syncNowComLimite(limiteMs = 8000): Promise<SyncResult | null> {
  return Promise.race([
    syncNow({ silent: true }),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), limiteMs)),
  ]);
}

export function initSyncEngine() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  const trigger = () => {
    if (navigator.onLine) void syncNow({ silent: true });
  };

  window.addEventListener("online", trigger);
  window.addEventListener("focus", trigger);
  // No Android (Capacitor) voltar do segundo plano não dispara "focus" de forma
  // confiável; a mudança de visibilidade sim.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") trigger();
  });
  window.addEventListener("offline-outbox-changed", trigger);

  setTimeout(trigger, 500);
  setInterval(trigger, 60_000);
}
