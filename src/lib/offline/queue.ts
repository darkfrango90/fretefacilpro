import { getDB, type OutboxItem, type OutboxPhoto, type SyncHistoryItem } from "./db";

export async function enqueue(item: Omit<OutboxItem, "created_at" | "attempts">) {
  await getDB().outbox.put({
    ...item,
    created_at: Date.now(),
    attempts: 0,
  });
  notifyChanged();
}

export async function listPending(): Promise<OutboxItem[]> {
  return getDB().outbox.orderBy("created_at").toArray();
}

export async function countPending(): Promise<number> {
  return getDB().outbox.count();
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

export async function pendingByType(type: "entrega" | "abastecimento") {
  return getDB().outbox.where("type").equals(type).toArray();
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
