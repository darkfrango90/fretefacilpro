import { useEffect } from "react";
import { initSyncEngine, syncNow } from "@/lib/offline/sync";
import { useOnline, usePendingCount } from "@/hooks/use-offline";
import { toast } from "sonner";

export function OfflineProvider() {
  const online = useOnline();
  const pending = usePendingCount();

  useEffect(() => {
    initSyncEngine();
  }, []);

  // Feedback quando a conexão volta e há itens pendentes
  useEffect(() => {
    if (online && pending > 0) {
      void (async () => {
        const r = await syncNow();
        if (r.total > 0) {
          if (r.failed === 0) toast.success(`Sincronizados ${r.sent} registros.`);
          else toast.warning(`Sincronizados ${r.sent}, ${r.failed} falharam.`);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  return null;
}
