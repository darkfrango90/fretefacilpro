import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Droplets, BarChart3, Trash2 } from "lucide-react";

import { AdminOnly } from "@/components/role-guard";

export const Route = createFileRoute("/_authenticated/afericoes")({
  component: () => (
    <AdminOnly>
      <Page />
    </AdminOnly>
  ),
});

function Page() {
  const { data: prof } = useProfile();
  const qc = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [veiculoId, setVeiculoId] = useState("");
  const [litros, setLitros] = useState("");
  const [km, setKm] = useState("");
  const [obs, setObs] = useState("");
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 16));

  const empresaId = prof?.profile.empresa_id;
  const isAdmin = prof?.roles.includes("admin");

  const { data: veiculos } = useQuery({
    queryKey: ["veiculos-list", empresaId],
    enabled: !!empresaId,
    queryFn: async () =>
      (await (supabase as any).from("veiculos").select("id, placa").eq("ativo", true).order("placa")).data ?? [],
  });

  const { data: lista } = useQuery({
    queryKey: ["afericoes", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("afericoes_tanque")
        .select("id, data_hora, litros_aferidos, km_odometro, observacao, veiculo_id, veiculos(placa)")
        .order("data_hora", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  if (!prof) return null;
  if (!isAdmin) {
    return <p className="text-sm text-muted-foreground">Apenas administradores podem registrar aferições.</p>;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!veiculoId) return toast.error("Selecione o veículo");
    if (!litros) return toast.error("Informe os litros aferidos");
    setSubmitting(true);
    try {
      const { error } = await (supabase as any).from("afericoes_tanque").insert({
        id: crypto.randomUUID(),
        empresa_id: prof!.profile.empresa_id,
        veiculo_id: veiculoId,
        data_hora: new Date(data).toISOString(),
        litros_aferidos: Number(litros),
        km_odometro: km ? Number(km) : null,
        observacao: obs || null,
        criado_por: prof!.profile.id,
      });
      if (error) throw error;
      toast.success("Aferição registrada");
      setLitros("");
      setKm("");
      setObs("");
      qc.invalidateQueries({ queryKey: ["afericoes"] });
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao salvar");
    } finally {
      setSubmitting(false);
    }
  }

  async function remover(id: string) {
    if (!confirm("Excluir esta aferição?")) return;
    const { error } = await (supabase as any).from("afericoes_tanque").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Removida");
    qc.invalidateQueries({ queryKey: ["afericoes"] });
  }

  return (
    <div className="space-y-4 pb-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Droplets className="h-5 w-5 text-primary" /> Aferição de tanque
        </h1>
        <Button asChild variant="outline" size="sm">
          <Link to="/consumo-preciso">
            <BarChart3 className="h-4 w-4 mr-1" /> Relatório
          </Link>
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Registre a medição física do diesel no tanque. Usada para calcular o consumo preciso entre aferições.
      </p>

      <Card>
        <CardContent className="p-3">
          <form onSubmit={onSubmit} className="space-y-3">
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
              <Label>Data/hora *</Label>
              <Input type="datetime-local" value={data} onChange={(e) => setData(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Litros aferidos *</Label>
                <Input
                  type="number"
                  step="0.001"
                  inputMode="decimal"
                  value={litros}
                  onChange={(e) => setLitros(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label>KM odômetro</Label>
                <Input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  value={km}
                  onChange={(e) => setKm(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label>Observação</Label>
              <Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
            </div>
            <Button type="submit" variant="action" size="lg" className="w-full" disabled={submitting}>
              {submitting ? "Salvando..." : "Registrar aferição"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-sm font-semibold mb-2 text-muted-foreground">Aferições recentes</h2>
        <div className="space-y-2">
          {(lista ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma aferição registrada ainda.</p>
          )}
          {(lista ?? []).map((a: any) => (
            <Card key={a.id}>
              <CardContent className="p-3 flex items-start justify-between gap-3">
                <div className="text-sm">
                  <div className="font-medium">{a.veiculos?.placa ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(a.data_hora).toLocaleString("pt-BR")}
                  </div>
                  <div className="mt-1">
                    {Number(a.litros_aferidos).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} L
                    {a.km_odometro != null && (
                      <span className="text-muted-foreground"> · {Number(a.km_odometro).toLocaleString("pt-BR")} km</span>
                    )}
                  </div>
                  {a.observacao && <div className="text-xs text-muted-foreground mt-1">{a.observacao}</div>}
                </div>
                <Button variant="ghost" size="icon" onClick={() => remover(a.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
