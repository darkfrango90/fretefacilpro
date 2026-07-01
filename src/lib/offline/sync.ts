import { supabase } from "@/integrations/supabase/client";
import {
  addHistory,
  listPending,
  markAttempt,
  removePending,
} from "./queue";
import { getDB, type OutboxItem } from "./db";
import { refreshPermissoesCache } from "@/hooks/use-permissoes";

let syncing = false;
let syncPromise: Promise<SyncResult> | null = null;
let initialized = false;
const LAST_SYNC_KEY = "offline.last_sync_at";

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

async function syncEntrega(action: "criar_venda" | "iniciar_entrega" | "finalizar_entrega", body: Record<string, any>) {
  const { data, error } = await supabase.functions.invoke("sync-entrega", {
    body: { action, ...body },
  });
  if (error) throw error;
  if (data?.erro) throw new Error(data.erro);
  return data;
}

async function pushOne(item: OutboxItem, identity: SyncIdentity): Promise<void> {
  if (item.type === "iniciar_entrega") {
    const { entrega_id, veiculo_id, km_inicial } = item.payload;
    await syncEntrega("iniciar_entrega", {
      entrega_id,
      veiculo_id,
      km_inicial,
    });
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
    const { error } = await (supabase as any).from("despesas").upsert(payload, { onConflict: "id" });
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
        descricao: `Pneu ${payload.marca ?? ""} ${payload.tipo ?? ""} - posição ${payload.posicao ?? ""}`.trim(),
        valor: Number(payload.valor),
        data: payload.data_instalacao,
        km_veiculo: payload.km_instalacao ?? null,
        foto_cupom_url: payload.foto_url ?? null,
        status: "a_conferir",
      };
      const { error: errD } = await (supabase as any)
        .from("despesas").upsert(despesaPayload, { onConflict: "id" });
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
  const { error } = await (supabase as any).from("abastecimentos").upsert(payload, { onConflict: "id" });
  if (error) throw error;
}

export interface SyncResult {
  sent: number;
  failed: number;
  total: number;
  recusados: number;
}

function isRecusaDefinitiva(msg: string): boolean {
  return /PERMISSAO_NEGADA|ENTREGA_JA_INICIADA/i.test(msg);
}

export async function syncNow(opts: { silent?: boolean } = {}): Promise<SyncResult> {
  if (syncPromise) return syncPromise;

  syncPromise = runSync(opts);
  return syncPromise;
}

async function runSync(opts: { silent?: boolean } = {}): Promise<SyncResult> {
  syncing = true;
  const started = Date.now();
  let sent = 0;
  let failed = 0;
  let recusados = 0;
  let firstError: string | null = null;
  try {
    try {
      const { data } = await supabase.auth.getUser();
      if (data?.user) await refreshPermissoesCache(data.user.id);
    } catch {}

    const identity = await getSyncIdentity();
    const items = (await listPending()).filter((i) => !i.recusado);
    for (const item of items) {
      try {
        await pushOne(item, identity);
        await removePending(item.id);
        sent++;
      } catch (e: any) {
        const msg = e?.message ?? String(e);
        if (isRecusaDefinitiva(msg)) {
          recusados++;
          await getDB().outbox.update(item.id, {
            recusado: true,
            last_error: msg,
            attempts: (item.attempts ?? 0) + 1,
          });
        } else {
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
    return { sent, failed, total, recusados };
  } finally {
    syncing = false;
    syncPromise = null;
    if (typeof window !== "undefined") window.dispatchEvent(new Event("offline-sync-finished"));
  }
}

export function initSyncEngine() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  const trigger = () => {
    if (navigator.onLine) void syncNow({ silent: true });
  };

  window.addEventListener("online", trigger);
  window.addEventListener("focus", trigger);
  window.addEventListener("offline-outbox-changed", trigger);

  setTimeout(trigger, 500);
  setInterval(trigger, 60_000);
}
