import Dexie, { type Table } from "dexie";

export type OutboxType =
  | "entrega"           // cadastro de venda (status pendente) - legado também
  | "abastecimento"
  | "despesa"
  | "pneu_instalacao"
  | "pneu_remocao"
  | "iniciar_entrega"   // motorista pega venda pendente -> em_rota
  | "finalizar_entrega"; // motorista finaliza entrega em_rota -> entregue

export interface OutboxPhoto {
  field: string;
  bucket: "odometros" | "abastecimentos" | "entregas" | "assinaturas" | "despesas" | "pneus";
  blob: Blob;
  contentType: string;
  ext: string;
}

export interface OutboxItem {
  id: string;
  type: OutboxType;
  empresa_id: string;
  motorista_id: string;
  payload: Record<string, any>;
  photos: OutboxPhoto[];
  created_at: number;
  attempts: number;
  last_error?: string | null;
  recusado?: boolean; // sinaliza rejeição definitiva (permissão / concorrência)
}

export interface SyncHistoryItem {
  id?: number;
  started_at: number;
  finished_at: number;
  sent_count: number;
  failed_count: number;
  error?: string | null;
}

export interface PermissoesCache {
  id: string; // "self"
  motorista_id: string;
  data: Record<string, any>;
  updated_at: number;
}

class OfflineDB extends Dexie {
  outbox!: Table<OutboxItem, string>;
  sync_history!: Table<SyncHistoryItem, number>;
  permissoes_cache!: Table<PermissoesCache, string>;

  constructor() {
    super("entrega_facil_offline");
    this.version(1).stores({
      outbox: "id, type, created_at",
      sync_history: "++id, started_at",
    });
    this.version(2).stores({
      outbox: "id, type, created_at",
      sync_history: "++id, started_at",
      permissoes_cache: "id, motorista_id",
    });
    this.version(3).stores({
      outbox: "id, type, created_at",
      sync_history: "++id, started_at",
      permissoes_cache: "id, motorista_id",
    });
  }
}

let _db: OfflineDB | null = null;
export function getDB(): OfflineDB {
  if (typeof window === "undefined") {
    throw new Error("OfflineDB só está disponível no navegador");
  }
  if (!_db) _db = new OfflineDB();
  return _db;
}
