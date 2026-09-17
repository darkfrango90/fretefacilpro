import { useEffect, useState, useCallback } from "react";
import { countPending, listPending, onChanged } from "@/lib/offline/queue";
import type { OutboxItem } from "@/lib/offline/db";
import { getLastSyncAt, isSyncing, syncNow } from "@/lib/offline/sync";
import { useProfile } from "@/hooks/use-session";

export function useOnline() {
  const [online, setOnline] = useState<boolean>(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);
  return online;
}

export function usePendingCount() {
  const [count, setCount] = useState(0);
  const { data: profile } = useProfile();
  const motoristaId = profile?.profile.id;
  const empresaId = profile?.profile.empresa_id;

  const refresh = useCallback(() => {
    if (!motoristaId || !empresaId) {
      setCount(0);
      return;
    }
    countPending(motoristaId, empresaId)
      .then(setCount)
      .catch(() => setCount(0));
  }, [motoristaId, empresaId]);

  useEffect(() => {
    refresh();
    const off = onChanged(refresh);
    const onSync = () => refresh();
    window.addEventListener("offline-sync-finished", onSync);
    return () => {
      off();
      window.removeEventListener("offline-sync-finished", onSync);
    };
  }, [refresh]);

  return count;
}

/**
 * Vendas cadastradas, entregas iniciadas e finalizadas que ainda estão na fila
 * local (não recusadas). As telas usam isso para mostrar o estado real do
 * motorista enquanto o servidor ainda não recebeu a operação.
 */
export function useEntregasNaFila() {
  const [itens, setItens] = useState<OutboxItem[]>([]);
  const { data: profile } = useProfile();
  const motoristaId = profile?.profile.id;
  const empresaId = profile?.profile.empresa_id;

  useEffect(() => {
    let vivo = true;
    const refresh = async () => {
      if (!motoristaId || !empresaId) {
        if (vivo) setItens([]);
        return;
      }
      try {
        const todos = await listPending(motoristaId, empresaId);
        if (!vivo) return;
        setItens(
          todos.filter(
            (i) =>
              !i.recusado &&
              (i.type === "entrega" ||
                i.type === "iniciar_entrega" ||
                i.type === "finalizar_entrega"),
          ),
        );
      } catch {}
    };
    void refresh();
    const off = onChanged(refresh);
    window.addEventListener("offline-sync-finished", refresh);
    return () => {
      vivo = false;
      off();
      window.removeEventListener("offline-sync-finished", refresh);
    };
  }, [motoristaId, empresaId]);

  return itens;
}

export function useSyncStatus() {
  const [busy, setBusy] = useState(isSyncing());
  const [lastAt, setLastAt] = useState<number | null>(getLastSyncAt());

  useEffect(() => {
    const finished = () => {
      setBusy(false);
      setLastAt(getLastSyncAt());
    };
    window.addEventListener("offline-sync-finished", finished);
    return () => window.removeEventListener("offline-sync-finished", finished);
  }, []);

  const run = useCallback(async () => {
    setBusy(true);
    try {
      return await syncNow();
    } finally {
      setBusy(false);
      setLastAt(getLastSyncAt());
    }
  }, []);

  return { busy, lastAt, run };
}
