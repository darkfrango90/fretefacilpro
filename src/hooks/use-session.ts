import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "master" | "admin" | "motorista";

export interface AppProfile {
  id: string;
  empresa_id: string;
  nome: string;
  telefone: string | null;
  ativo?: boolean;
  precisa_trocar_senha?: boolean;
  email?: string | null;
}

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      if (cancelled) return;
      setSession(s);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, loading, user: session?.user ?? null };
}

const PROFILE_CACHE_KEY = "profile:cache:v1";

type ProfileResult = {
  profile: AppProfile;
  roles: AppRole[];
  profile_extras: { ativo: boolean; precisa_trocar_senha: boolean };
};

export function useProfile() {
  const { user } = useSession();
  return useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    // Mantém último profile carregado disponível offline
    initialData: (): ProfileResult | undefined => {
      if (typeof localStorage === "undefined" || !user) return undefined;
      try {
        const raw = localStorage.getItem(`${PROFILE_CACHE_KEY}:${user.id}`);
        if (!raw) return undefined;
        return JSON.parse(raw) as ProfileResult;
      } catch { return undefined; }
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<ProfileResult | null> => {
      if (!user) return null;
      try {
        const { data: profile, error } = await (supabase as any)
          .from("profiles")
          .select("id, empresa_id, nome, telefone, ativo, precisa_trocar_senha, email")
          .eq("id", user.id)
          .maybeSingle();
        if (error) throw error;
        if (!profile) return null;
        const { data: roles, error: rErr } = await (supabase as any)
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);
        if (rErr) throw rErr;
        const result: ProfileResult = {
          profile: profile as AppProfile,
          roles: (roles ?? []).map((r: any) => r.role as AppRole),
          profile_extras: {
            ativo: profile.ativo ?? true,
            precisa_trocar_senha: profile.precisa_trocar_senha ?? false,
          },
        };
        try { localStorage.setItem(`${PROFILE_CACHE_KEY}:${user.id}`, JSON.stringify(result)); } catch {}
        return result;
      } catch (e) {
        // Offline / sem rede: usa cache local se houver
        try {
          const raw = localStorage.getItem(`${PROFILE_CACHE_KEY}:${user.id}`);
          if (raw) return JSON.parse(raw) as ProfileResult;
        } catch {}
        throw e;
      }
    },
  });
}
