import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "./use-session";
import { getDB } from "@/lib/offline/db";
import {
  PERMISSOES_DEFAULT,
  parsePermissoes,
  type PermissoesEfetivas,
} from "@/lib/permissoes";

const CACHE_KEY = "self";

export async function refreshPermissoesCache(motoristaId: string): Promise<PermissoesEfetivas> {
  const { data, error } = await (supabase as any).rpc("get_permissoes_efetivas", {
    _motorista_id: motoristaId,
  });
  if (error) throw error;
  const perms = parsePermissoes(data);
  try {
    await getDB().permissoes_cache.put({
      id: CACHE_KEY,
      motorista_id: motoristaId,
      data: perms,
      updated_at: Date.now(),
    });
  } catch {}
  return perms;
}

export async function getPermissoesCached(): Promise<PermissoesEfetivas | null> {
  try {
    const row = await getDB().permissoes_cache.get(CACHE_KEY);
    return row ? parsePermissoes(row.data) : null;
  } catch {
    return null;
  }
}

export function usePermissoes() {
  const { data: prof } = useProfile();
  const [perms, setPerms] = useState<PermissoesEfetivas>(PERMISSOES_DEFAULT);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    if (!prof) return;
    (async () => {
      const cached = await getPermissoesCached();
      if (cached && alive) {
        setPerms(cached);
        setLoading(false);
      }
      if (typeof navigator !== "undefined" && navigator.onLine) {
        try {
          const fresh = await refreshPermissoesCache(prof.profile.id);
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
    return () => { alive = false; };
  }, [prof?.profile.id]);

  return { perms, loading };
}
