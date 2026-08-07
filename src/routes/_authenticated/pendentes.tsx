import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-session";
import { usePermissoes } from "@/hooks/use-permissoes";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { MapPin, Truck, PackageCheck, RefreshCw, Trash2 } from "lucide-react";
import { enqueue, listPending } from "@/lib/offline/queue";
import { syncNow } from "@/lib/offline/sync";
import { SwipeToAction } from "@/components/swipe-to-action";

export const Route = createFileRoute("/_authenticated/pendentes")({
  component: Pendentes,
});

function Pendentes() {
  const { data: prof } = useProfile();
  const { perms } = usePermissoes();
  const empresaId = prof?.profile.empresa_id;
  const isAdmin = !!prof?.roles.includes("admin") || !!prof?.roles.includes("master");
  const podeExcluir = isAdmin || perms.pode_cancelar_entrega;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [iniciandoIds, setIniciandoIds] = useState<string[]>([]);

  // Carrega IDs já enfileirados localmente para esconder do pool
  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      try {
        const all = await listPending();
        const ids = all
          .filter((i) => i.type === "iniciar_entrega" && !i.recusado)
          .map((i) => i.payload.entrega_id as string);
        if (alive) setIniciandoIds(ids);
      } catch {}
    };
    refresh();
    window.addEventListener("offline-outbox-changed", refresh);
    window.addEventListener("offline-sync-finished", refresh);
    return () => {
      alive = false;
      window.removeEventListener("offline-outbox-changed", refresh);
      window.removeEventListener("offline-sync-finished", refresh);
    };
  }, []);

  const { data: rows, refetch, isLoading } = useQuery({
    queryKey: ["pendentes", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("entregas")
        .select("id, valor_praticado, valor_frete, quantidade, endereco, criada_em, cliente:clientes(nome), material:materiais(nome, unidade)")
        .eq("status", "pendente")
        .order("criada_em", { ascending: true })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<any>(null);
  const [veiculoId, setVeiculoId] = useState("");
  const [kmInicial, setKmInicial] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: veiculos } = useQuery({
    queryKey: ["veiculos-list", empresaId],
    enabled: !!empresaId,
    queryFn: async () => (await (supabase as any).from("veiculos").select("id, placa").eq("ativo", true).order("placa")).data ?? [],
  });

  function abrir(r: any) {
    setSel(r);
    setVeiculoId("");
    setKmInicial("");
    setOpen(true);
  }

  async function iniciar() {
    if (!sel) return;
    if (!veiculoId) return toast.error("Selecione o veículo");
    if (!kmInicial) return toast.error("Informe o KM inicial");
    setSubmitting(true);
    try {
      await enqueue({
        id: crypto.randomUUID(),
        type: "iniciar_entrega",
        empresa_id: prof!.profile.empresa_id,
        motorista_id: prof!.profile.id,
        payload: {
          entrega_id: sel.id,
          veiculo_id: veiculoId,
          km_inicial: Number(kmInicial),
        },
        photos: [],
      });
      setOpen(false);
      if (navigator.onLine) {
        const res = await syncNow({ silent: true });
        if (res.recusados > 0) {
          toast.error("Esta entrega já foi iniciada por outro motorista.");
        } else {
          toast.success("Entrega iniciada!");
        }
      } else {
        toast.success("Entrega iniciada offline. Confirmará ao sincronizar.");
      }
      await Promise.all([
        refetch(),
        queryClient.invalidateQueries({ queryKey: ["pendentes"] }),
        queryClient.invalidateQueries({ queryKey: ["minhas-entregas"] }),
        queryClient.invalidateQueries({ queryKey: ["entrega-finalizar"] }),
      ]);
      navigate({ to: "/minhas-entregas" });
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao iniciar");
    } finally {
      setSubmitting(false);
    }
  }

  const [confirmarExcluirId, setConfirmarExcluirId] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  async function excluir(id: string) {
    setExcluindo(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-entrega", {
        body: { action: "cancelar_entrega", entrega_id: id },
      });
      if (error) return toast.error(error.message);
      if (data?.erro) {
        return toast.error(
          data.erro === "SEM_PERMISSAO" ? "Sem permissão para excluir esta venda" : data.erro,
        );
      }
      toast.success("Venda removida");
      setConfirmarExcluirId(null);
      await Promise.all([
        refetch(),
        queryClient.invalidateQueries({ queryKey: ["entregas"] }),
      ]);
    } finally {
      setExcluindo(false);
    }
  }

  const visible = (rows ?? []).filter((r: any) => !iniciandoIds.includes(r.id));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <PackageCheck className="h-5 w-5" /> Pendentes de entrega
        </h1>
        <Button
          size="sm"
          variant="outline"
          onClick={() => refetch()}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>
      <p className="text-xs text-muted-foreground -mt-2">
        Pool compartilhado. Quem pegar primeiro, faz a entrega.
        {podeExcluir && " Arraste um card para o lado para excluir."}
      </p>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}

      {visible.map((r: any) => (
        <SwipeToAction
          key={r.id}
          actionLabel="Excluir"
          actionIcon={<Trash2 className="h-4 w-4" />}
          actionClassName="bg-destructive text-destructive-foreground"
          disabled={!podeExcluir}
          onAction={() => setConfirmarExcluirId(r.id)}
        >
          <Card>
            <CardContent className="p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium truncate">{r.cliente?.nome ?? "—"}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {r.material?.nome} · {r.quantidade} {r.material?.unidade}
                  </div>
                </div>
                <div className="text-right text-sm font-semibold whitespace-nowrap">
                  R$ {(Number(r.valor_praticado) * Number(r.quantidade || 1) + Number(r.valor_frete || 0)).toFixed(2)}
                </div>
              </div>
              {r.endereco && (
                <div className="text-xs text-muted-foreground flex items-start gap-1">
                  <MapPin className="h-3 w-3 mt-0.5 shrink-0" /> {r.endereco}
                </div>
              )}
              <div className="flex gap-2">
                <Button size="sm" variant="action" className="flex-1" onClick={() => abrir(r)}>
                  <Truck className="h-4 w-4 mr-1" /> Iniciar entrega
                </Button>
                {podeExcluir && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 text-destructive hover:bg-destructive/10"
                    aria-label="Excluir venda"
                    onClick={() => setConfirmarExcluirId(r.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </SwipeToAction>
      ))}

      {!isLoading && visible.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          Nenhuma venda pendente no momento.
        </p>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Iniciar entrega</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Veículo *</Label>
              <Select value={veiculoId} onValueChange={setVeiculoId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {(veiculos ?? []).map((v: any) => (
                    <SelectItem key={v.id} value={v.id}>{v.placa}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>KM inicial *</Label>
              <Input type="number" inputMode="numeric" value={kmInicial}
                onChange={(e) => setKmInicial(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button variant="action" onClick={iniciar} disabled={submitting}>
              {submitting ? "Iniciando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmarExcluirId} onOpenChange={(o) => !o && setConfirmarExcluirId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir venda pendente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A venda será removida da lista de pendentes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluindo}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={excluindo}
              onClick={(e) => {
                e.preventDefault();
                if (confirmarExcluirId) excluir(confirmarExcluirId);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {excluindo ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
