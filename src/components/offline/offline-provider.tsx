import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { initSyncEngine, syncNow, type SyncResult } from "@/lib/offline/sync";
import { useOnline, usePendingCount } from "@/hooks/use-offline";
import { toast } from "sonner";

export function OfflineProvider() {
  const online = useOnline();
  const pending = usePendingCount();
  const queryClient = useQueryClient();

  useEffect(() => {
    initSyncEngine();
  }, []);

  // Quando a fila envia (ou o servidor recusa) algo, as listas de entregas
  // ficam desatualizadas em qualquer tela aberta. Antes só "Minhas entregas"
  // escutava isso, então "Pendentes" continuava sem a venda recém-sincronizada.
  useEffect(() => {
    const atualizarListas = () => {
      for (const queryKey of [
        ["pendentes"],
        ["minhas-entregas"],
        ["entrega-detalhe"],
        ["entrega-finalizar"],
        ["entregas"],
      ]) {
        void queryClient.invalidateQueries({ queryKey });
      }
    };
    const aoSincronizar = (e: Event) => {
      const r = (e as CustomEvent<SyncResult | undefined>).detail;
      if (r && r.sent === 0 && r.recusados === 0) return;
      atualizarListas();
      // O envio pode terminar em segundo plano, depois que a tela já seguiu.
      if (r && r.recusados > 0) {
        toast.error(
          `${r.recusados} registro(s) recusado(s) pelo servidor. Veja em Sincronização.`,
          {
            id: "sync-recusados",
          },
        );
      }
    };
    // A fila muda também quando um item acaba de ser enviado (e sai dela):
    // recarregar já nesse momento evita o card sumir da fila local antes de
    // a lista do servidor trazê-lo.
    window.addEventListener("offline-outbox-changed", atualizarListas);
    window.addEventListener("offline-sync-finished", aoSincronizar);
    return () => {
      window.removeEventListener("offline-outbox-changed", atualizarListas);
      window.removeEventListener("offline-sync-finished", aoSincronizar);
    };
  }, [queryClient]);

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
