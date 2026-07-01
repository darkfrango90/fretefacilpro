import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useProfile, type AppRole } from "@/hooks/use-session";

export function RoleGuard({
  role,
  children,
  fallback = "/",
}: {
  role: AppRole;
  children: React.ReactNode;
  fallback?: string;
}) {
  const { data, isLoading } = useProfile();
  const navigate = useNavigate();
  const allowed = !!data && data.roles.includes(role);

  useEffect(() => {
    if (!isLoading && data && !allowed) {
      navigate({ to: fallback, replace: true });
    }
  }, [isLoading, data, allowed, navigate, fallback]);

  if (isLoading || !data) {
    return <div className="text-sm text-muted-foreground">Carregando…</div>;
  }
  if (!allowed) {
    return (
      <div className="text-sm text-muted-foreground">
        Acesso restrito. Redirecionando…
      </div>
    );
  }
  return <>{children}</>;
}

export const AdminOnly = ({ children }: { children: React.ReactNode }) => (
  <RoleGuard role="admin">{children}</RoleGuard>
);
