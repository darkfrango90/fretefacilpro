import { useEffect, useState, useCallback } from "react";
import { countPending, onChanged } from "@/lib/offline/queue";
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
