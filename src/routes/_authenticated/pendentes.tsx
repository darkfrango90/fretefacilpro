import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-session";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { MapPin, Truck, PackageCheck, RefreshCw } from "lucide-react";
import { enqueue, listPending } from "@/lib/offline/queue";
import { syncNow } from "@/lib/offline/sync";

export const Route = createFileRoute("/_authenticated/pendentes")({
  component: Pendentes,
});

function Pendentes() {
  const { data: prof } = useProfile();
  const empresaId = prof?.profile.empresa_id;
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
      </p>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}

      {visible.map((r: any) => (
        <Card key={r.id}>
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
            <Button size="sm" variant="action" className="w-full" onClick={() => abrir(r)}>
              <Truck className="h-4 w-4 mr-1" /> Iniciar entrega
            </Button>
          </CardContent>
        </Card>
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
    </div>
  );
}
