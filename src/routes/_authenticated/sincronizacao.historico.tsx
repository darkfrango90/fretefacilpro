import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { listHistory } from "@/lib/offline/queue";
import type { SyncHistoryItem } from "@/lib/offline/db";
import { CheckCircle2, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/sincronizacao/historico")({
  component: HistoryPage,
});

function HistoryPage() {
  const [rows, setRows] = useState<SyncHistoryItem[]>([]);

  useEffect(() => {
    listHistory().then(setRows);
    const refresh = () => listHistory().then(setRows);
    window.addEventListener("offline-sync-finished", refresh);
    return () => window.removeEventListener("offline-sync-finished", refresh);
  }, []);

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">Histórico de sincronizações</h1>
      {rows.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhuma sincronização registrada.</p>
      )}
      {rows.map((r) => {
        const ok = (r.failed_count ?? 0) === 0;
        return (
          <Card key={r.id}>
            <CardContent className="p-3 flex items-start gap-3">
              <div className="mt-0.5">
                {ok ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">
                  {new Date(r.started_at).toLocaleString("pt-BR")}
                </div>
                <div className="text-xs text-muted-foreground">
                  Enviados: {r.sent_count} · Falhas: {r.failed_count}
                </div>
                {r.error && (
                  <div className="text-xs text-amber-600 mt-1 truncate">{r.error}</div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
      <Link to="/sincronizacao" className="block text-center text-sm text-primary pt-2">
        ← Voltar
      </Link>
    </div>
  );
}
