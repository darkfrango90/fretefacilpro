import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-session";
import { AdminOnly } from "@/components/role-guard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Plus, CheckCircle2, ImageIcon } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/despesas/")({
  component: () => (
    <AdminOnly>
      <DespesasAdmin />
    </AdminOnly>
  ),
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
const labelCategoria = (v: string) =>
  CATEGORIAS.find((c) => c.value === v)?.label ?? v;

function brl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function inicioDoMes() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function DespesasAdmin() {
  const { data: prof } = useProfile();
  const empresaId = prof?.profile.empresa_id;
  const qc = useQueryClient();

  const [de, setDe] = useState(inicioDoMes());
  const [ate, setAte] = useState(hojeISO());
  const [categoria, setCategoria] = useState<string>("__todas__");
  const [veiculoId, setVeiculoId] = useState<string>("__todos__");
  const [status, setStatus] = useState<string>("__todos__");

  const { data: veiculos } = useQuery({
    queryKey: ["veiculos-list", empresaId],
    enabled: !!empresaId,
    queryFn: async () =>
      (await (supabase as any).from("veiculos").select("id, placa").order("placa")).data ?? [],
  });

  const { data: despesas, isLoading } = useQuery({
    queryKey: ["despesas-admin", empresaId, de, ate, categoria, veiculoId, status],
    enabled: !!empresaId,
    queryFn: async () => {
      let q = (supabase as any)
        .from("despesas")
        .select("*")
        .gte("data", de)
        .lte("data", ate)
        .order("data", { ascending: false })
        .order("criado_em", { ascending: false });
      if (categoria !== "__todas__") q = q.eq("categoria", categoria);
      if (veiculoId !== "__todos__") q = q.eq("veiculo_id", veiculoId);
      if (status !== "__todos__") q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const userIds = useMemo(() => {
    const s = new Set<string>();
    (despesas ?? []).forEach((d: any) => d.lancado_por && s.add(d.lancado_por));
    return Array.from(s);
  }, [despesas]);

  const { data: nomes } = useQuery({
    queryKey: ["profiles-nomes", userIds.join(",")],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("profiles").select("id, nome").in("id", userIds);
      const m = new Map<string, string>();
      (data ?? []).forEach((p: any) => m.set(p.id, p.nome));
      return m;
    },
  });

  const placas = useMemo(() => {
    const m = new Map<string, string>();
    (veiculos ?? []).forEach((v: any) => m.set(v.id, v.placa));
    return m;
  }, [veiculos]);

  const total = (despesas ?? []).reduce((s: number, d: any) => s + Number(d.valor || 0), 0);
  const porCategoria = useMemo(() => {
    const m = new Map<string, number>();
    (despesas ?? []).forEach((d: any) => {
      m.set(d.categoria, (m.get(d.categoria) ?? 0) + Number(d.valor || 0));
    });
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [despesas]);

  const [detalhe, setDetalhe] = useState<any | null>(null);

  async function conferir(id: string) {
    const { error } = await (supabase as any)
      .from("despesas")
      .update({ status: "conferida", conferida_em: new Date().toISOString(), conferida_por: prof?.profile.id })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Despesa conferida");
    qc.invalidateQueries({ queryKey: ["despesas-admin"] });
    setDetalhe(null);
  }

  return (
    <div className="space-y-4 pb-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Despesas</h1>
        <Link to="/despesas/nova">
          <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Nova</Button>
        </Link>
      </div>

      <Card>
        <CardContent className="p-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">De</Label>
              <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Até</Label>
              <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">Categoria</Label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__todas__">Todas</SelectItem>
                  {CATEGORIAS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Veículo</Label>
              <Select value={veiculoId} onValueChange={setVeiculoId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__todos__">Todos</SelectItem>
                  {(veiculos ?? []).map((v: any) => (
                    <SelectItem key={v.id} value={v.id}>{v.placa}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__todos__">Todos</SelectItem>
                  <SelectItem value="a_conferir">A conferir</SelectItem>
                  <SelectItem value="conferida">Conferida</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total no período</span>
            <span className="font-bold">{brl(total)}</span>
          </div>
          {porCategoria.length > 0 && (
            <div className="pt-2 border-t mt-2 space-y-1">
              {porCategoria.map(([cat, v]) => (
                <div key={cat} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{labelCategoria(cat)}</span>
                  <span>{brl(v)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-2">
        {isLoading && <div className="text-sm text-muted-foreground">Carregando…</div>}
        {!isLoading && (despesas ?? []).length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-6">
            Nenhuma despesa no período.
          </div>
        )}
        {(despesas ?? []).map((d: any) => (
          <Card
            key={d.id}
            onClick={() => setDetalhe(d)}
            className="cursor-pointer active:scale-[0.99] transition-transform"
          >
            <CardContent className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">
                      {labelCategoria(d.categoria)}
                    </Badge>
                    {d.status === "a_conferir" ? (
                      <Badge className="text-[10px] bg-amber-500">A conferir</Badge>
                    ) : (
                      <Badge className="text-[10px] bg-emerald-600">Conferida</Badge>
                    )}
                    {d.foto_cupom_url && <ImageIcon className="h-3 w-3 text-muted-foreground" />}
                  </div>
                  <div className="text-sm font-medium truncate mt-1">
                    {d.descricao || "(sem descrição)"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(d.data).toLocaleDateString("pt-BR")}
                    {d.veiculo_id && ` • ${placas.get(d.veiculo_id) ?? "—"}`}
                    {" • "}{nomes?.get(d.lancado_por) ?? "—"}
                  </div>
                </div>
                <div className="font-bold whitespace-nowrap">{brl(Number(d.valor))}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!detalhe} onOpenChange={(o) => !o && setDetalhe(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Detalhe da despesa</DialogTitle>
          </DialogHeader>
          {detalhe && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Categoria</div>
                  <div>{labelCategoria(detalhe.categoria)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Valor</div>
                  <div className="font-semibold">{brl(Number(detalhe.valor))}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Data</div>
                  <div>{new Date(detalhe.data).toLocaleDateString("pt-BR")}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Veículo</div>
                  <div>{detalhe.veiculo_id ? placas.get(detalhe.veiculo_id) ?? "—" : "Geral"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">KM</div>
                  <div>{detalhe.km_veiculo ?? "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Lançado por</div>
                  <div>{nomes?.get(detalhe.lancado_por) ?? "—"}</div>
                </div>
              </div>
              {detalhe.descricao && (
                <div>
                  <div className="text-xs text-muted-foreground">Descrição</div>
                  <div className="text-sm">{detalhe.descricao}</div>
                </div>
              )}
              {detalhe.observacoes && (
                <div>
                  <div className="text-xs text-muted-foreground">Observações</div>
                  <div className="text-sm">{detalhe.observacoes}</div>
                </div>
              )}
              <FotoCupom path={detalhe.foto_cupom_url} />
              {detalhe.status === "a_conferir" && (
                <Button className="w-full" onClick={() => conferir(detalhe.id)}>
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Marcar como conferida
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FotoCupom({ path }: { path?: string | null }) {
  const clean = path?.trim() || null;
  const isHttp = !!clean && /^https?:\/\//i.test(clean);
  const { data: signed } = useQuery({
    queryKey: ["despesa-foto", clean],
    enabled: !!clean && !isHttp,
    staleTime: 50 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from("despesas").createSignedUrl(clean!, 60 * 60);
      if (error) throw error;
      return data.signedUrl;
    },
  });
  const url = isHttp ? clean : signed;
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-1">Foto do cupom</div>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer">
          <img src={url} alt="cupom" className="w-full max-h-64 object-contain rounded border" />
        </a>
      ) : (
        <div className="w-full h-24 rounded border bg-muted flex items-center justify-center text-xs text-muted-foreground">
          sem foto
        </div>
      )}
    </div>
  );
}
