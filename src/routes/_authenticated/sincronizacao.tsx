import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useOnline, usePendingCount, useSyncStatus } from "@/hooks/use-offline";
import { listPending, removePending } from "@/lib/offline/queue";
import type { OutboxItem } from "@/lib/offline/db";
import { Wifi, WifiOff, RefreshCw, ClipboardList, Fuel, History, AlertOctagon, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/sincronizacao")({
  component: SyncPage,
});

function fmtDate(ts: number | null) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("pt-BR");
}

function SyncPage() {
  const online = useOnline();
  const pending = usePendingCount();
  const { busy, lastAt, run } = useSyncStatus();
  const [items, setItems] = useState<OutboxItem[]>([]);

  useEffect(() => {
    listPending().then(setItems);
    const refresh = () => listPending().then(setItems);
    window.addEventListener("offline-outbox-changed", refresh);
    window.addEventListener("offline-sync-finished", refresh);
    return () => {
      window.removeEventListener("offline-outbox-changed", refresh);
      window.removeEventListener("offline-sync-finished", refresh);
    };
  }, []);

  async function onSync() {
    if (!online) return toast.error("Sem conexão. Tente novamente quando estiver online.");
    const r = await run();
    if (r.total === 0) toast.info("Nenhum registro pendente.");
    else if (r.failed === 0) toast.success(`Sincronizados ${r.sent} registros.`);
    else toast.warning(`Sincronizados ${r.sent}, ${r.failed} falharam.`);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Sincronização</h1>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            {online ? (
              <><Wifi className="h-4 w-4 text-emerald-500" /> Online</>
            ) : (
              <><WifiOff className="h-4 w-4 text-amber-500" /> Offline</>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm">
            <span className="font-medium">{pending}</span>{" "}
            {pending === 1 ? "registro pendente" : "registros pendentes"} de envio
          </div>
          <div className="text-xs text-muted-foreground">
            Última sincronização: {fmtDate(lastAt)}
          </div>
          <Button onClick={onSync} disabled={busy || !online} className="w-full">
            <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
            {busy ? "Sincronizando..." : "Sincronizar agora"}
          </Button>
        </CardContent>
      </Card>

      <Link
        to="/sincronizacao/historico"
        className="flex items-center justify-between rounded-xl border bg-card p-3 hover:bg-accent"
      >
        <span className="flex items-center gap-2 text-sm font-medium">
          <History className="h-4 w-4" /> Histórico de sincronizações
        </span>
        <span className="text-xs text-muted-foreground">ver</span>
      </Link>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold mt-2">Itens pendentes</h2>
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground">Nada pendente no momento.</p>
        )}
        {items.map((it) => (
          <Card key={it.id} className={it.recusado ? "border-destructive/60" : undefined}>
            <CardContent className="p-3 flex items-start gap-3">
              <div className="mt-0.5">
                {it.recusado ? (
                  <AlertOctagon className="h-4 w-4 text-destructive" />
                ) : it.type === "entrega" ? (
                  <ClipboardList className="h-4 w-4 text-primary" />
                ) : (
                  <Fuel className="h-4 w-4 text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium capitalize flex items-center gap-2">
                  {it.type}
                  {it.recusado && <span className="text-[10px] uppercase text-destructive">Recusada</span>}
                </div>
                <div className="text-xs text-muted-foreground">
                  Criado em {fmtDate(it.created_at)}
                </div>
                {it.last_error && (
                  <div className={`text-xs mt-1 ${it.recusado ? "text-destructive" : "text-amber-600"}`}>
                    {it.recusado ? "Rejeitado: " : `${it.attempts} tentativa(s) · `}
                    {it.last_error}
                  </div>
                )}
              </div>
              {it.recusado && (
                <Button
                  size="icon" variant="ghost"
                  onClick={async () => {
                    await removePending(it.id);
                    setItems((cur) => cur.filter((x) => x.id !== it.id));
                  }}
                  aria-label="Descartar"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
