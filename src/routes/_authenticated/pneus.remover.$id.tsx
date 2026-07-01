import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { enqueue } from "@/lib/offline/queue";
import { syncNow } from "@/lib/offline/sync";
import { MOTIVOS_REMOCAO, labelPosicao } from "@/lib/pneus-constants";

export const Route = createFileRoute("/_authenticated/pneus/remover/$id")({
  component: Page,
});

function hojeISO() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function Page() {
  const { id } = useParams({ from: "/_authenticated/pneus/remover/$id" });
  const { data: prof } = useProfile();
  const navigate = useNavigate();

  const { data: pneu, isLoading } = useQuery({
    queryKey: ["pneu", id],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("pneus").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [km, setKm] = useState("");
  const [data, setData] = useState(hojeISO());
  const [motivo, setMotivo] = useState("desgaste");
  const [encadear, setEncadear] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  if (!prof) return null;
  if (isLoading) return <div className="text-sm text-muted-foreground">Carregando…</div>;
  if (!pneu) return <div className="text-sm text-muted-foreground">Pneu não encontrado.</div>;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!km) return toast.error("Informe o KM de remoção");
    if (Number(km) < Number(pneu.km_instalacao)) {
      return toast.error("KM de remoção menor que o de instalação");
    }
    setSubmitting(true);
    try {
      await enqueue({
        id: `rem-${id}`,
        type: "pneu_remocao",
        empresa_id: pneu.empresa_id,
        motorista_id: prof!.profile.id,
        payload: {
          id,
          status: "removido",
          km_remocao: Number(km),
          data_remocao: data,
          motivo_remocao: motivo,
        },
        photos: [],
      });
      if (typeof navigator !== "undefined" && navigator.onLine) {
        toast.success("Pneu removido! Sincronizando...");
        void syncNow({ silent: true });
      } else {
        toast.success("Remoção salva offline.");
      }
      if (encadear) {
        navigate({
          to: "/pneus/instalar",
          search: { veiculo_id: pneu.veiculo_id, posicao: pneu.posicao } as any,
        });
      } else {
        navigate({ to: "/pneus" });
      }
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    } finally {
      setSubmitting(false);
    }
  }

  const duracao = km ? Math.max(0, Number(km) - Number(pneu.km_instalacao || 0)) : 0;

  return (
    <form onSubmit={onSubmit} className="space-y-4 pb-6">
      <h1 className="text-xl font-bold">Trocar / remover pneu</h1>

      <Card><CardContent className="p-3 text-sm space-y-1">
        <div><span className="text-muted-foreground">Posição:</span> <b>{labelPosicao(pneu.posicao)}</b></div>
        <div><span className="text-muted-foreground">Pneu:</span> {pneu.marca} {pneu.modelo ?? ""} ({pneu.tipo})</div>
        <div><span className="text-muted-foreground">Instalado em:</span> {new Date(pneu.data_instalacao).toLocaleDateString("pt-BR")} • KM {Number(pneu.km_instalacao).toLocaleString("pt-BR")}</div>
      </CardContent></Card>

      <Card><CardContent className="p-3 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>KM de remoção *</Label>
            <Input type="number" inputMode="numeric" value={km} onChange={(e) => setKm(e.target.value)} required />
          </div>
          <div>
            <Label>Data *</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} required />
          </div>
        </div>
        <div>
          <Label>Motivo *</Label>
          <Select value={motivo} onValueChange={setMotivo}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {MOTIVOS_REMOCAO.map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {km && (
          <div className="text-xs text-muted-foreground">
            Duração: <b className="text-foreground">{duracao.toLocaleString("pt-BR")} km</b>
          </div>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={encadear} onChange={(e) => setEncadear(e.target.checked)} />
          Instalar novo pneu nesta posição em seguida
        </label>
      </CardContent></Card>

      <Button type="submit" size="lg" className="w-full" disabled={submitting}>
        {submitting ? "Salvando..." : (encadear ? "Remover e instalar novo" : "Remover pneu")}
      </Button>
    </form>
  );
}
