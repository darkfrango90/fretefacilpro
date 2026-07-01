import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Camera } from "lucide-react";
import { capturarFoto } from "@/lib/native";
import { enqueue, fileToPhoto } from "@/lib/offline/queue";
import { syncNow } from "@/lib/offline/sync";
import { POSICOES_PNEU, labelPosicao, getPosicoesPorVeiculo } from "@/lib/pneus-constants";

const searchSchema = z.object({
  veiculo_id: z.string().optional(),
  posicao: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/pneus/instalar")({
  validateSearch: searchSchema,
  component: Page,
});

function hojeISO() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function Page() {
  const { data: prof } = useProfile();
  const navigate = useNavigate();
  const search = useSearch({ from: "/_authenticated/pneus/instalar" });

  const [submitting, setSubmitting] = useState(false);
  const [veiculoId, setVeiculoId] = useState(search.veiculo_id ?? "");
  const [posicao, setPosicao] = useState(search.posicao ?? "");
  const [tipo, setTipo] = useState("novo");
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [km, setKm] = useState("");
  const [data, setData] = useState(hojeISO());
  const [valor, setValor] = useState("");
  const [obs, setObs] = useState("");
  const [foto, setFoto] = useState<File | null>(null);

  const empresaId = prof?.profile.empresa_id;
  const cacheKey = empresaId ? `pneus-veiculos-cache:${empresaId}` : null;
  const { data: veiculos } = useQuery({
    queryKey: ["pneus-veiculos-list", empresaId],
    enabled: !!empresaId,
    networkMode: "offlineFirst",
    retry: false,
    staleTime: 60_000,
    initialData: () => {
      if (typeof window === "undefined" || !cacheKey) return undefined;
      try {
        const raw = localStorage.getItem(cacheKey);
        return raw ? JSON.parse(raw) : undefined;
      } catch { return undefined; }
    },
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("veiculos")
        .select("id, placa, tipo")
        .eq("ativo", true)
        .order("placa");
      
      if (error) {
        console.error("Erro ao carregar veiculos em instalar:", error);
        throw error;
      }
      
      const list = data ?? [];
      if (cacheKey) try { localStorage.setItem(cacheKey, JSON.stringify(list)); } catch {}
      return list;
    },
  });

  const selectedVeiculo = useMemo(() => {
    return (veiculos ?? []).find((v: any) => v.id === veiculoId);
  }, [veiculos, veiculoId]);

  if (!prof) return null;
  const profile = prof.profile;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!veiculoId) return toast.error("Selecione o veículo");
    if (!posicao) return toast.error("Selecione a posição");
    if (!marca.trim()) return toast.error("Informe a marca");
    if (!km) return toast.error("Informe o KM de instalação");
    
    setSubmitting(true);
    try {
      const posicoesArray = posicao.split(",");
      
      // Laço de inserção para cada pneu selecionado
      for (const posItem of posicoesArray) {
        const id = crypto.randomUUID();
        const valorNum = valor ? Number(valor) : 0;
        const despesaId = valorNum > 0 ? crypto.randomUUID() : null;

        const payload: any = {
          empresa_id: profile.empresa_id,
          lancado_por: profile.id,
          veiculo_id: veiculoId,
          posicao: posItem,
          tipo,
          marca: marca.trim(),
          modelo: modelo.trim() || null,
          km_instalacao: Number(km),
          data_instalacao: data,
          valor: valorNum,
          despesa_id: despesaId,
          status: "instalado",
          observacoes: obs || null,
        };
        
        const photos = foto ? [await fileToPhoto("foto_url", "pneus", foto)] : [];

        await enqueue({
          id,
          type: "pneu_instalacao",
          empresa_id: profile.empresa_id,
          motorista_id: profile.id,
          payload,
          photos,
        });
      }

      if (typeof navigator !== "undefined" && navigator.onLine) {
        toast.success(`${posicoesArray.length} pneu(s) instalado(s)! Sincronizando...`);
        void syncNow({ silent: true });
      } else {
        toast.success("Instalação(ões) salva(s) offline.");
      }
      navigate({ to: "/pneus" });
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 pb-6">
      <h1 className="text-xl font-bold">Instalar pneu</h1>

      <Card><CardContent className="p-3 space-y-3">
        <div>
          <Label>Veículo *</Label>
          <Select value={veiculoId} onValueChange={setVeiculoId}>
            <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {(veiculos ?? []).map((v: any) => (
                <SelectItem key={v.id} value={v.id}>{v.placa}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label>Posição do Pneu *</Label>
          {posicao.includes(",") ? (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-xs font-semibold text-primary uppercase">
              {posicao.split(",").map(p => labelPosicao(p)).join(", ")}
            </div>
          ) : (
            <Select value={posicao} onValueChange={setPosicao}>
              <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecione a posição" /></SelectTrigger>
              <SelectContent>
                {getPosicoesPorVeiculo(selectedVeiculo?.tipo).map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Tipo *</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="novo">Novo</SelectItem>
                <SelectItem value="recapado">Recapado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Data *</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} required className="rounded-xl" />
          </div>
        </div>
        
        <div>
          <Label>Marca *</Label>
          <Input value={marca} onChange={(e) => setMarca(e.target.value)} placeholder="Ex.: Pirelli" required className="rounded-xl" />
        </div>
        <div>
          <Label>Modelo</Label>
          <Input value={modelo} onChange={(e) => setModelo(e.target.value)} placeholder="Ex.: FG01" className="rounded-xl" />
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>KM instalação *</Label>
            <Input type="number" inputMode="numeric" value={km} onChange={(e) => setKm(e.target.value)} required className="rounded-xl" />
          </div>
          <div>
            <Label>Valor Unitário (R$)</Label>
            <Input type="number" step="0.01" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} className="rounded-xl" />
          </div>
        </div>
        
        <p className="text-[11px] text-muted-foreground -mt-1">
          {posicao.includes(",") ? "O valor informado será lançado para cada pneu individualmente nas Despesas." : "Quando há valor, lançamos automaticamente em Despesas → Pneu."}
        </p>
        
        <div>
          <Label className="flex items-center gap-1"><Camera className="h-4 w-4" /> Foto (cupom/nota)</Label>
          <div className="flex items-center gap-2 mt-1">
            <Button
              type="button" variant="outline" size="sm"
              onClick={async () => {
                try { const f = await capturarFoto(); if (f) setFoto(f); }
                catch (e: any) { toast.error(e?.message ?? "Câmera indisponível"); }
              }}
              className="rounded-xl active-scale"
            >
              <Camera className="h-4 w-4 mr-1" /> {foto ? "Trocar foto" : "Tirar foto"}
            </Button>
            {foto && <span className="text-xs text-muted-foreground truncate">{foto.name}</span>}
          </div>
        </div>
        
        <div>
          <Label>Observações</Label>
          <Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} className="rounded-xl" />
        </div>
      </CardContent></Card>

      <Button type="submit" size="lg" className="w-full rounded-xl active-scale bg-primary text-primary-foreground hover:bg-primary/90" disabled={submitting}>
        {submitting ? "Salvando..." : posicao.includes(",") ? `Instalar ${posicao.split(",").length} Pneus` : "Instalar pneu"}
      </Button>
    </form>
  );
}
