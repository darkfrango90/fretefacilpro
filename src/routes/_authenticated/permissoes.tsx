import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-session";
import { AdminOnly } from "@/components/role-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { RotateCcw, Save } from "lucide-react";

export const Route = createFileRoute("/_authenticated/permissoes")({
  component: () => (<AdminOnly><Page /></AdminOnly>),
});

type PadraoRow = {
  empresa_id: string;
  cpf_cnpj_obrigatorio: boolean;
  telefone_obrigatorio: boolean;
  pode_cadastrar_cliente: boolean;
  pode_alterar_valor_produto: boolean;
  desconto_maximo_percent: number;
  pode_alterar_frete: boolean;
  frete_maximo: number | null;
  materiais_permitidos: string[] | null;
  valor_venda_minimo: number | null;
  valor_venda_maximo: number | null;
  foto_odometro_obrigatoria: boolean;
  gps_obrigatorio: boolean;
  observacao_obrigatoria: boolean;
  pode_cancelar_entrega: boolean;
};

const PADRAO_DEFAULT: Omit<PadraoRow, "empresa_id"> = {
  cpf_cnpj_obrigatorio: false,
  telefone_obrigatorio: false,
  pode_cadastrar_cliente: true,
  pode_alterar_valor_produto: true,
  desconto_maximo_percent: 0,
  pode_alterar_frete: true,
  frete_maximo: null,
  materiais_permitidos: null,
  valor_venda_minimo: null,
  valor_venda_maximo: null,
  foto_odometro_obrigatoria: true,
  gps_obrigatorio: false,
  observacao_obrigatoria: false,
  pode_cancelar_entrega: false,
};

const BOOL_KEYS = [
  "cpf_cnpj_obrigatorio","telefone_obrigatorio","pode_cadastrar_cliente",
  "pode_alterar_valor_produto","pode_alterar_frete","foto_odometro_obrigatoria",
  "gps_obrigatorio","observacao_obrigatoria","pode_cancelar_entrega",
] as const;

const NUM_KEYS = [
  "desconto_maximo_percent","frete_maximo","valor_venda_minimo","valor_venda_maximo",
] as const;

const LABELS: Record<string, string> = {
  cpf_cnpj_obrigatorio: "CPF/CNPJ obrigatório no cliente",
  telefone_obrigatorio: "Telefone obrigatório no cliente",
  pode_cadastrar_cliente: "Pode cadastrar novo cliente",
  pode_alterar_valor_produto: "Pode alterar valor do produto",
  desconto_maximo_percent: "Desconto máximo (%)",
  pode_alterar_frete: "Pode alterar valor do frete",
  frete_maximo: "Frete máximo (R$)",
  valor_venda_minimo: "Venda mínima (R$)",
  valor_venda_maximo: "Venda máxima (R$)",
  foto_odometro_obrigatoria: "Foto do odômetro obrigatória",
  gps_obrigatorio: "GPS obrigatório na entrega",
  observacao_obrigatoria: "Observação obrigatória",
  pode_cancelar_entrega: "Pode cancelar entrega",
};

function Page() {
  const { data: prof } = useProfile();
  const empresaId = prof?.profile.empresa_id;
  if (!empresaId) return null;
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Permissões</h1>
      <p className="text-xs text-muted-foreground">
        Defina as regras padrão da empresa e, se necessário, sobrescreva por motorista.
      </p>
      <Tabs defaultValue="padrao">
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="padrao">Padrões da empresa</TabsTrigger>
          <TabsTrigger value="motorista">Por motorista</TabsTrigger>
        </TabsList>
        <TabsContent value="padrao" className="pt-4">
          <PadraoForm empresaId={empresaId} />
        </TabsContent>
        <TabsContent value="motorista" className="pt-4">
          <MotoristaForm empresaId={empresaId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function useMateriais(empresaId: string) {
  return useQuery({
    queryKey: ["materiais-all", empresaId],
    queryFn: async () => (await (supabase as any)
      .from("materiais").select("id, nome").order("nome")).data ?? [],
  });
}

function MateriaisMulti({
  value, onChange, materiais,
}: { value: string[] | null; onChange: (v: string[] | null) => void; materiais: any[] }) {
  const selecionados = value ?? [];
  const todos = selecionados.length === 0;
  return (
    <div className="space-y-2">
      <div className="text-xs text-muted-foreground">
        {todos ? "Todos os materiais permitidos" : `${selecionados.length} material(is) selecionado(s)`}
      </div>
      <div className="max-h-40 overflow-y-auto rounded border p-2 space-y-1">
        {materiais.map((m: any) => {
          const checked = selecionados.includes(m.id);
          return (
            <label key={m.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => {
                  if (e.target.checked) onChange([...selecionados, m.id]);
                  else {
                    const next = selecionados.filter((x) => x !== m.id);
                    onChange(next.length === 0 ? null : next);
                  }
                }}
              />
              {m.nome}
            </label>
          );
        })}
      </div>
      {!todos && (
        <Button type="button" size="sm" variant="ghost" onClick={() => onChange(null)}>
          Permitir todos
        </Button>
      )}
    </div>
  );
}

function PadraoForm({ empresaId }: { empresaId: string }) {
  const qc = useQueryClient();
  const { data: materiais = [] } = useMateriais(empresaId);
  const { data, isLoading } = useQuery({
    queryKey: ["permissoes_padrao", empresaId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("permissoes_padrao").select("*").eq("empresa_id", empresaId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const [form, setForm] = useState<Omit<PadraoRow, "empresa_id">>(PADRAO_DEFAULT);
  useEffect(() => { if (data) setForm({ ...PADRAO_DEFAULT, ...data }); }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any)
        .from("permissoes_padrao")
        .upsert({ empresa_id: empresaId, ...form, atualizado_em: new Date().toISOString() }, { onConflict: "empresa_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["permissoes_padrao", empresaId] });
      toast.success("Padrões salvos");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  return (
    <Card><CardContent className="p-3 space-y-4">
      {BOOL_KEYS.map((k) => (
        <div key={k} className="flex items-center justify-between gap-2">
          <Label className="text-sm">{LABELS[k]}</Label>
          <Switch
            checked={!!(form as any)[k]}
            onCheckedChange={(v) => setForm({ ...form, [k]: v } as any)}
          />
        </div>
      ))}
      {NUM_KEYS.map((k) => (
        <div key={k}>
          <Label className="text-sm">{LABELS[k]}</Label>
          <Input
            type="number" step="0.01"
            value={(form as any)[k] ?? ""}
            onChange={(e) => setForm({ ...form, [k]: e.target.value === "" ? (k === "desconto_maximo_percent" ? 0 : null) : Number(e.target.value) } as any)}
            placeholder={k === "desconto_maximo_percent" ? "0" : "sem limite"}
          />
        </div>
      ))}
      <div>
        <Label className="text-sm">Materiais permitidos</Label>
        <MateriaisMulti
          value={form.materiais_permitidos}
          onChange={(v) => setForm({ ...form, materiais_permitidos: v })}
          materiais={materiais}
        />
      </div>
      <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-full">
        <Save className="h-4 w-4 mr-1" />{save.isPending ? "Salvando..." : "Salvar padrões"}
      </Button>
    </CardContent></Card>
  );
}

type OverrideRow = Partial<Omit<PadraoRow, "empresa_id">> & {
  motorista_id?: string;
  empresa_id?: string;
};

function MotoristaForm({ empresaId }: { empresaId: string }) {
  const qc = useQueryClient();
  const { data: materiais = [] } = useMateriais(empresaId);
  const [motoristaId, setMotoristaId] = useState<string>("");

  const { data: motoristas = [] } = useQuery({
    queryKey: ["motoristas-list", empresaId],
    queryFn: async () => {
      // motoristas da empresa
      const { data: roles } = await (supabase as any)
        .from("user_roles").select("user_id").eq("role", "motorista").eq("empresa_id", empresaId);
      const ids = (roles ?? []).map((r: any) => r.user_id);
      if (ids.length === 0) return [];
      const { data: profs } = await (supabase as any)
        .from("profiles").select("id, nome, email").in("id", ids).order("nome");
      return profs ?? [];
    },
  });

  const { data: padrao } = useQuery({
    queryKey: ["permissoes_padrao", empresaId],
    queryFn: async () => (await (supabase as any)
      .from("permissoes_padrao").select("*").eq("empresa_id", empresaId).maybeSingle()).data,
  });

  const { data: override } = useQuery({
    queryKey: ["permissoes_motorista", motoristaId],
    enabled: !!motoristaId,
    queryFn: async () => (await (supabase as any)
      .from("permissoes_motorista").select("*").eq("motorista_id", motoristaId).maybeSingle()).data as OverrideRow | null,
  });

  const padraoMerged = useMemo(() => ({ ...PADRAO_DEFAULT, ...(padrao ?? {}) }), [padrao]);
  const [form, setForm] = useState<OverrideRow>({});
  useEffect(() => { setForm(override ?? {}); }, [override, motoristaId]);

  const save = useMutation({
    mutationFn: async () => {
      const row: any = { motorista_id: motoristaId, empresa_id: empresaId, ...form, atualizado_em: new Date().toISOString() };
      const { error } = await (supabase as any)
        .from("permissoes_motorista").upsert(row, { onConflict: "motorista_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["permissoes_motorista", motoristaId] });
      toast.success("Permissões do motorista salvas");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const limpar = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any)
        .from("permissoes_motorista").delete().eq("motorista_id", motoristaId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["permissoes_motorista", motoristaId] });
      setForm({});
      toast.success("Voltou a herdar todos os padrões");
    },
    onError: (e: any) => toast.error(e.message),
  });

  function isHerdado(k: string): boolean {
    const v = (form as any)[k];
    return v === undefined || v === null;
  }
  function herdar(k: string) {
    const copy: any = { ...form }; delete copy[k]; setForm(copy);
  }
  function setVal(k: string, v: any) { setForm({ ...form, [k]: v }); }

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-3 space-y-2">
        <Label>Motorista</Label>
        <Select value={motoristaId} onValueChange={setMotoristaId}>
          <SelectTrigger><SelectValue placeholder="Selecione um motorista" /></SelectTrigger>
          <SelectContent>
            {motoristas.map((m: any) => (
              <SelectItem key={m.id} value={m.id}>{m.nome} {m.email ? `· ${m.email}` : ""}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent></Card>

      {motoristaId && (
        <Card><CardContent className="p-3 space-y-4">
          {BOOL_KEYS.map((k) => {
            const herdado = isHerdado(k);
            const efetivo = herdado ? (padraoMerged as any)[k] : (form as any)[k];
            return (
              <div key={k} className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-sm">{LABELS[k]}</Label>
                  <Switch
                    checked={!!efetivo}
                    onCheckedChange={(v) => setVal(k, v)}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{herdado ? "Herdado do padrão" : "Customizado"}</span>
                  {!herdado && (
                    <Button type="button" variant="ghost" size="sm" className="h-6 px-2" onClick={() => herdar(k)}>
                      <RotateCcw className="h-3 w-3 mr-1" />voltar ao padrão
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
          {NUM_KEYS.map((k) => {
            const herdado = isHerdado(k);
            const efetivo = herdado ? (padraoMerged as any)[k] : (form as any)[k];
            return (
              <div key={k} className="space-y-1">
                <Label className="text-sm">{LABELS[k]}</Label>
                <Input
                  type="number" step="0.01"
                  value={efetivo ?? ""}
                  onChange={(e) => setVal(k, e.target.value === "" ? null : Number(e.target.value))}
                  placeholder={herdado ? "(herdado do padrão)" : ""}
                />
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{herdado ? "Herdado do padrão" : "Customizado"}</span>
                  {!herdado && (
                    <Button type="button" variant="ghost" size="sm" className="h-6 px-2" onClick={() => herdar(k)}>
                      <RotateCcw className="h-3 w-3 mr-1" />voltar ao padrão
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
          <div className="space-y-1">
            <Label className="text-sm">Materiais permitidos</Label>
            <MateriaisMulti
              value={(form.materiais_permitidos !== undefined ? form.materiais_permitidos : padraoMerged.materiais_permitidos) ?? null}
              onChange={(v) => setVal("materiais_permitidos", v)}
              materiais={materiais}
            />
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{isHerdado("materiais_permitidos") ? "Herdado do padrão" : "Customizado"}</span>
              {!isHerdado("materiais_permitidos") && (
                <Button type="button" variant="ghost" size="sm" className="h-6 px-2" onClick={() => herdar("materiais_permitidos")}>
                  <RotateCcw className="h-3 w-3 mr-1" />voltar ao padrão
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => limpar.mutate()} disabled={limpar.isPending}>
              Voltar tudo ao padrão
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              <Save className="h-4 w-4 mr-1" />{save.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </CardContent></Card>
      )}
    </div>
  );
}
