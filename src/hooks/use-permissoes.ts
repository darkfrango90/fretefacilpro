import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "./use-session";
import { getDB } from "@/lib/offline/db";
import { PERMISSOES_DEFAULT, parsePermissoes, type PermissoesEfetivas } from "@/lib/permissoes";

const LEGACY_CACHE_KEY = "self";
const cacheKey = (motoristaId: string) => `self:${motoristaId}`;

export async function refreshPermissoesCache(motoristaId: string): Promise<PermissoesEfetivas> {
  const { data, error } = await (supabase as any).rpc("get_permissoes_efetivas", {
    _motorista_id: motoristaId,
  });
  if (error) throw error;
  const perms = parsePermissoes(data);
  try {
    await getDB().permissoes_cache.put({
      id: cacheKey(motoristaId),
      motorista_id: motoristaId,
      data: perms,
      updated_at: Date.now(),
    });
  } catch {}
  return perms;
}

export async function getPermissoesCached(motoristaId: string): Promise<PermissoesEfetivas | null> {
  try {
    let row = await getDB().permissoes_cache.get(cacheKey(motoristaId));
    if (!row) {
      const legacy = await getDB().permissoes_cache.get(LEGACY_CACHE_KEY);
      if (legacy?.motorista_id === motoristaId) {
        row = { ...legacy, id: cacheKey(motoristaId) };
        await getDB().permissoes_cache.put(row);
        await getDB().permissoes_cache.delete(LEGACY_CACHE_KEY);
      }
    }
    return row ? parsePermissoes(row.data) : null;
  } catch {
    return null;
  }
}

export function usePermissoes() {
  const { data: prof } = useProfile();
  const motoristaId = prof?.profile.id;
  const [perms, setPerms] = useState<PermissoesEfetivas>(PERMISSOES_DEFAULT);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    if (!motoristaId) {
      setPerms(PERMISSOES_DEFAULT);
      setLoading(false);
      return;
    }
    setLoading(true);
    (async () => {
      const cached = await getPermissoesCached(motoristaId);
      if (cached && alive) {
        setPerms(cached);
        setLoading(false);
      }
      if (typeof navigator !== "undefined" && navigator.onLine) {
        try {
          const fresh = await refreshPermissoesCache(motoristaId);
          if (alive) setPerms(fresh);
        } catch {
          // mantém cache
        } finally {
          if (alive) setLoading(false);
        }
      } else {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [motoristaId]);

  return { perms, loading };
}
