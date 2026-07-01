import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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

export const Route = createFileRoute("/_authenticated/despesas/nova")({
  component: Page,
});

const CATEGORIAS: { value: string; label: string }[] = [
  { value: "manutencao", label: "Manutenção" },
  { value: "pneu", label: "Pneu" },
  { value: "peca", label: "Peça" },
  { value: "pedagio", label: "Pedágio" },
  { value: "alimentacao", label: "Alimentação" },
  { value: "documentacao", label: "Documentação" },
  { value: "outros", label: "Outros" },
];

function hojeISO() {
  const d = new Date();
  const o = d.getTimezoneOffset();
  return new Date(d.getTime() - o * 60_000).toISOString().slice(0, 10);
}

function Page() {
  const { data: prof } = useProfile();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [categoria, setCategoria] = useState("outros");
  const [veiculoId, setVeiculoId] = useState<string>("__nenhum__");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(hojeISO());
  const [km, setKm] = useState("");
  const [obs, setObs] = useState("");
  const [foto, setFoto] = useState<File | null>(null);

  const empresaId = prof?.profile.empresa_id;
  const cacheKey = empresaId ? `veiculos-cache:${empresaId}` : null;
  const { data: veiculos } = useQuery({
    queryKey: ["veiculos-list", empresaId],
    enabled: !!empresaId,
    retry: false,
    staleTime: 60_000,
    networkMode: "offlineFirst",
    initialData: () => {
      if (typeof window === "undefined" || !cacheKey) return undefined;
      try {
        const raw = localStorage.getItem(cacheKey);
        return raw ? JSON.parse(raw) : undefined;
      } catch { return undefined; }
    },
    queryFn: async () => {
      const list =
        (await (supabase as any).from("veiculos").select("id, placa").eq("ativo", true).order("placa")).data ?? [];
      if (cacheKey) {
        try { localStorage.setItem(cacheKey, JSON.stringify(list)); } catch {}
      }
      return list;
    },
  });

  if (!prof) return null;
  const profile = prof.profile;
  const isAdmin = prof.roles.includes("admin");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valor || Number(valor) <= 0) return toast.error("Informe o valor da despesa");
    if (!data) return toast.error("Informe a data");
    setSubmitting(true);
    try {
      const id = crypto.randomUUID();
      const payload: any = {
        empresa_id: profile.empresa_id,
        lancado_por: profile.id,
        categoria,
        veiculo_id: veiculoId === "__nenhum__" ? null : veiculoId,
        descricao: descricao || null,
        valor: Number(valor),
        data,
        km_veiculo: km ? Number(km) : null,
        observacoes: obs || null,
        status: "a_conferir",
      };
      const photos = foto ? [await fileToPhoto("foto_cupom_url", "despesas", foto)] : [];
      await enqueue({
        id,
        type: "despesa",
        empresa_id: profile.empresa_id,
        motorista_id: profile.id,
        payload,
        photos,
      });
      if (typeof navigator !== "undefined" && navigator.onLine) {
        toast.success("Despesa registrada! Sincronizando...");
        void syncNow({ silent: true });
      } else {
        toast.success("Despesa salva offline. Será enviada quando houver conexão.");
      }
      navigate({ to: isAdmin ? "/despesas" : "/operacao" });
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 pb-6">
      <h1 className="text-xl font-bold">Nova despesa</h1>

      <Card>
        <CardContent className="p-3 space-y-3">
          <div>
            <Label>Categoria *</Label>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIAS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Veículo</Label>
            <Select value={veiculoId} onValueChange={setVeiculoId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__nenhum__">Despesa geral (sem veículo)</SelectItem>
                {(veiculos ?? []).map((v: any) => (
                  <SelectItem key={v.id} value={v.id}>{v.placa}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Descrição</Label>
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Pedágio BR-153" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Valor (R$) *</Label>
              <Input
                type="number"
                step="0.01"
                inputMode="decimal"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                required
              />
            </div>
            <div>
              <Label>Data *</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} required />
            </div>
          </div>

          <div>
            <Label>KM do veículo</Label>
            <Input type="number" inputMode="numeric" value={km} onChange={(e) => setKm(e.target.value)} />
          </div>

          <div>
            <Label className="flex items-center gap-1">
              <Camera className="h-4 w-4" /> Foto do cupom / pedido
            </Label>
            <div className="flex items-center gap-2 mt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    const f = await capturarFoto();
                    if (f) setFoto(f);
                  } catch (e: any) {
                    toast.error(e?.message ?? "Não foi possível acessar a câmera.");
                  }
                }}
              >
                <Camera className="h-4 w-4 mr-1" />
                {foto ? "Trocar foto" : "Tirar foto"}
              </Button>
              {foto && (
                <span className="text-xs text-muted-foreground truncate">
                  {foto.name}
                </span>
              )}
            </div>
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Button type="submit" size="lg" className="w-full" disabled={submitting}>
        {submitting ? "Salvando..." : "Registrar despesa"}
      </Button>
    </form>
  );
}
