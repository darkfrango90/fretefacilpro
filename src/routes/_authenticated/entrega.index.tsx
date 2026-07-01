import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-session";
import { usePermissoes } from "@/hooks/use-permissoes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { enqueue } from "@/lib/offline/queue";
import { syncNow } from "@/lib/offline/sync";

export const Route = createFileRoute("/_authenticated/entrega/")({
  component: NovaVenda,
});

function NovaVenda() {
  const { data: prof } = useProfile();
  const { perms } = usePermissoes();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [clienteId, setClienteId] = useState("");
  const [materialId, setMaterialId] = useState("");
  const [precoBase, setPrecoBase] = useState<number | null>(null);
  const [valorPraticado, setValorPraticado] = useState("");
  const [quantidade, setQuantidade] = useState("1");
  const [valorFrete, setValorFrete] = useState("");
  const [endereco, setEndereco] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");
  const [obs, setObs] = useState("");
  const [formaPagamento, setFormaPagamento] = useState<string>("");

  const UFS = [
    "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
    "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
  ];

  const empresaId = prof?.profile.empresa_id;

  const { data: clientes } = useQuery({
    queryKey: ["clientes-list", empresaId],
    enabled: !!empresaId,
    queryFn: async () => (await (supabase as any).from("clientes").select("id, nome, endereco, cidade, estado").order("nome")).data ?? [],
  });
  const { data: materiaisAll } = useQuery({
    queryKey: ["materiais-list", empresaId],
    enabled: !!empresaId,
    queryFn: async () => (await (supabase as any).from("materiais").select("id, nome, preco_base, unidade").eq("ativo", true).order("nome")).data ?? [],
  });

  const materiais = useMemo(() => {
    const list = materiaisAll ?? [];
    const allow = perms.materiais_permitidos;
    if (!allow || allow.length === 0) return list;
    return list.filter((m: any) => allow.includes(m.id));
  }, [materiaisAll, perms.materiais_permitidos]);

  if (!prof) return null;
  const profile = prof.profile;

  function onMaterialChange(id: string) {
    setMaterialId(id);
    const m = (materiaisAll ?? []).find((x: any) => x.id === id);
    if (m) {
      const base = Number(m.preco_base);
      setPrecoBase(base);
      if (!perms.pode_alterar_valor_produto) {
        setValorPraticado(String(base));
      } else if (!valorPraticado) {
        setValorPraticado(String(base));
      }
    }
  }

  function validar(): string | null {
    if (!clienteId || !materialId) return "Cliente e material são obrigatórios";
    if (!formaPagamento) return "Escolha a forma de pagamento";
    if (!valorPraticado) return "Informe o valor praticado";
    const vp = Number(valorPraticado);
    if (precoBase != null) {
      if (!perms.pode_alterar_valor_produto && vp !== precoBase) {
        return "Você não pode alterar o valor do produto";
      }
      if (precoBase > 0 && vp < precoBase) {
        const pct = (precoBase - vp) / precoBase * 100;
        if (pct > (perms.desconto_maximo_percent ?? 0)) {
          return `Desconto acima do permitido (${pct.toFixed(1)}% > ${perms.desconto_maximo_percent}%)`;
        }
      }
    }
    const frete = Number(valorFrete || 0);
    if (!perms.pode_alterar_frete && frete !== 0) return "Você não pode alterar o valor do frete";
    if (perms.frete_maximo != null && frete > perms.frete_maximo) {
      return `Frete acima do máximo (R$ ${perms.frete_maximo.toFixed(2)})`;
    }
    const total = vp * Number(quantidade || 1) + frete;
    if (perms.valor_venda_minimo != null && total < perms.valor_venda_minimo) {
      return `Venda abaixo do mínimo (R$ ${perms.valor_venda_minimo.toFixed(2)})`;
    }
    if (perms.valor_venda_maximo != null && total > perms.valor_venda_maximo) {
      return `Venda acima do máximo (R$ ${perms.valor_venda_maximo.toFixed(2)})`;
    }
    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validar();
    if (err) return toast.error(err);
    setSubmitting(true);
    try {
      const id = crypto.randomUUID();
      const enderecoCompleto = [
        endereco.trim(),
        [cidade.trim(), estado.trim().toUpperCase()].filter(Boolean).join("/"),
      ].filter(Boolean).join(" - ") || null;
      const payload: any = {
        empresa_id: profile.empresa_id,
        motorista_id: profile.id,
        motorista_venda_id: profile.id,
        cliente_id: clienteId,
        material_id: materialId,
        preco_base_no_momento: precoBase ?? 0,
        valor_praticado: Number(valorPraticado),
        quantidade: Number(quantidade || 1),
        valor_frete: Number(valorFrete || 0),
        endereco: enderecoCompleto,
        status: "pendente",
        observacoes: obs || null,
        forma_pagamento: formaPagamento,
      };
      await enqueue({
        id,
        type: "entrega",
        empresa_id: profile.empresa_id,
        motorista_id: profile.id,
        payload,
        photos: [],
      });
      if (typeof navigator !== "undefined" && navigator.onLine) {
        toast.success("Venda cadastrada! Disponível em Pendentes.");
        void syncNow({ silent: true });
      } else {
        toast.success("Venda salva offline. Sincronizará quando houver conexão.");
      }
      navigate({ to: "/pendentes" });
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    } finally {
      setSubmitting(false);
    }
  }

  const diff = precoBase != null && valorPraticado && Number(valorPraticado) !== precoBase;
  const freteTravado = !perms.pode_alterar_frete;
  const valorTravado = !perms.pode_alterar_valor_produto;

  return (
    <form onSubmit={onSubmit} className="space-y-4 pb-6">
      <h1 className="text-xl font-bold">Nova venda</h1>
      <p className="text-xs text-muted-foreground -mt-2">
        Cadastre o pedido. A entrega (KM, foto, GPS, assinatura) é feita depois em "Pendentes".
      </p>

      <Card><CardContent className="p-3 space-y-3">
        <div>
          <Label>Cliente *</Label>
          <Select value={clienteId} onValueChange={(v) => {
            setClienteId(v);
            const c = (clientes ?? []).find((x: any) => x.id === v);
            if (c?.endereco && !endereco) setEndereco(c.endereco);
            if (c?.cidade && !cidade) setCidade(c.cidade);
            if (c?.estado && !estado) setEstado(c.estado);
          }}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {(clientes ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Material *</Label>
          <Select value={materialId} onValueChange={onMaterialChange}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {materiais.map((m: any) => (
                <SelectItem key={m.id} value={m.id}>{m.nome} · R$ {Number(m.preco_base).toFixed(2)}/{m.unidade}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent></Card>

      <Card><CardContent className="p-3 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Quantidade</Label>
            <Input type="number" step="0.001" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
          </div>
          <div>
            <Label className="flex items-center gap-1">
              Valor praticado *
              {valorTravado && <Lock className="h-3 w-3 text-muted-foreground" />}
            </Label>
            <Input type="number" step="0.01" value={valorPraticado}
              readOnly={valorTravado}
              onChange={(e) => setValorPraticado(e.target.value)} />
          </div>
        </div>
        {diff && !valorTravado && (
          <p className="text-xs text-amber-500">
            ⚠ Diferente do preço base (R$ {precoBase?.toFixed(2)})
          </p>
        )}
        <div>
          <Label className="flex items-center gap-1">
            Valor do frete (R$)
            {freteTravado && <Lock className="h-3 w-3 text-muted-foreground" />}
          </Label>
          <Input type="number" step="0.01" value={valorFrete}
            readOnly={freteTravado}
            onChange={(e) => setValorFrete(e.target.value)} placeholder="0,00" />
        </div>
        <div>
          <Label>Forma de pagamento *</Label>
          <Select value={formaPagamento} onValueChange={setFormaPagamento}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="dinheiro">Dinheiro</SelectItem>
              <SelectItem value="pix">Pix</SelectItem>
              <SelectItem value="deposito">Depósito</SelectItem>
              <SelectItem value="permuta">Permuta</SelectItem>
              <SelectItem value="boleto">Boleto</SelectItem>
              <SelectItem value="carteira">Carteira</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[10px] text-muted-foreground mt-1">
            Dinheiro, Pix e Depósito entram como "recebido" para confirmação. Boleto, Permuta e Carteira ficam pendentes de recebimento.
          </p>
        </div>
        <div>
          <Label>Endereço de entrega</Label>
          <Input value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Rua, número, bairro" />
        </div>
        <div className="grid grid-cols-[1fr_90px] gap-3">
          <div>
            <Label>Cidade</Label>
            <Input value={cidade} onChange={(e) => setCidade(e.target.value)} />
          </div>
          <div>
            <Label>UF</Label>
            <Select value={estado} onValueChange={setEstado}>
              <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
              <SelectContent>
                {UFS.map((uf) => (
                  <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label>Observações</Label>
          <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} />
        </div>
      </CardContent></Card>

      <Button type="submit" variant="action" size="lg" className="w-full" disabled={submitting}>
        {submitting ? "Salvando..." : "Cadastrar venda"}
      </Button>
    </form>
  );
}
