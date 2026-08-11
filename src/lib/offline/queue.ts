import { getDB, type OutboxItem, type OutboxPhoto, type SyncHistoryItem } from "./db";

export async function enqueue(item: Omit<OutboxItem, "created_at" | "attempts">) {
  await getDB().outbox.put({
    ...item,
    created_at: Date.now(),
    attempts: 0,
  });
  notifyChanged();
}

export async function listPending(motoristaId?: string, empresaId?: string): Promise<OutboxItem[]> {
  const items = motoristaId
    ? await getDB().outbox.where("motorista_id").equals(motoristaId).sortBy("created_at")
    : await getDB().outbox.orderBy("created_at").toArray();
  return empresaId ? items.filter((item) => item.empresa_id === empresaId) : items;
}

export async function countPending(motoristaId?: string, empresaId?: string): Promise<number> {
  return (await listPending(motoristaId, empresaId)).length;
}

export async function removePending(id: string) {
  await getDB().outbox.delete(id);
  notifyChanged();
}

export async function markAttempt(id: string, error: string | null) {
  const item = await getDB().outbox.get(id);
  if (!item) return;
  await getDB().outbox.update(id, {
    attempts: (item.attempts ?? 0) + 1,
    last_error: error,
  });
  notifyChanged();
}

export async function listHistory(limit = 50): Promise<SyncHistoryItem[]> {
  return getDB().sync_history.orderBy("started_at").reverse().limit(limit).toArray();
}

export async function addHistory(entry: Omit<SyncHistoryItem, "id">) {
  await getDB().sync_history.add(entry as SyncHistoryItem);
  notifyChanged();
}

export async function pendingByType(
  type: "entrega" | "abastecimento",
  motoristaId?: string,
  empresaId?: string,
) {
  const items = motoristaId
    ? await getDB().outbox.where("[motorista_id+type]").equals([motoristaId, type]).toArray()
    : await getDB().outbox.where("type").equals(type).toArray();
  return empresaId ? items.filter((item) => item.empresa_id === empresaId) : items;
}

// --- helpers de foto ---
export async function fileToPhoto(
  field: string,
  bucket: OutboxPhoto["bucket"],
  file: File,
): Promise<OutboxPhoto> {
  const ext = file.name.split(".").pop() || "jpg";
  return {
    field,
    bucket,
    blob: file,
    contentType: file.type || "image/jpeg",
    ext,
  };
}

// --- eventos para reatividade ---
const EVT = "offline-outbox-changed";
export function notifyChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVT));
}
export function onChanged(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVT, cb);
  return () => window.removeEventListener(EVT, cb);
}
