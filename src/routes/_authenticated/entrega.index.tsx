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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Lock, Plus, Trash2 } from "lucide-react";
import { enqueue } from "@/lib/offline/queue";
import { syncNow } from "@/lib/offline/sync";
import { ClienteCombobox } from "@/components/cliente-combobox";
import { MoneyInput } from "@/components/money-input";

export const Route = createFileRoute("/_authenticated/entrega/")({
  component: NovaVenda,
});

function materialEhFrete(material: { nome?: unknown } | undefined): boolean {
  return (
    String(material?.nome ?? "")
      .trim()
      .toLocaleUpperCase("pt-BR") === "FRETE"
  );
}

type MaterialVendaForm = {
  key: string;
  materialId: string;
  precoBase: number | null;
  valorPraticado: string;
  quantidade: string;
};

function novoMaterial(key: string = crypto.randomUUID()): MaterialVendaForm {
  return { key, materialId: "", precoBase: null, valorPraticado: "", quantidade: "1" };
}

function NovaVenda() {
  const { data: prof } = useProfile();
  const { perms } = usePermissoes();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [clienteId, setClienteId] = useState("");
  const [itens, setItens] = useState<MaterialVendaForm[]>(() => [novoMaterial("material-1")]);
  const [valorFrete, setValorFrete] = useState("");
  const [endereco, setEndereco] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");
  const [obs, setObs] = useState("");
  const [formaPagamento, setFormaPagamento] = useState<string>("");

  const UFS = [
    "AC",
    "AL",
    "AP",
    "AM",
    "BA",
    "CE",
    "DF",
    "ES",
    "GO",
    "MA",
    "MT",
    "MS",
    "MG",
    "PA",
    "PB",
    "PR",
    "PE",
    "PI",
    "RJ",
    "RN",
    "RS",
    "RO",
    "RR",
    "SC",
    "SP",
    "SE",
    "TO",
  ];

  const empresaId = prof?.profile.empresa_id;

  const { data: clientes } = useQuery({
    queryKey: ["clientes-list", empresaId],
    enabled: !!empresaId,
    initialData: () => {
      if (typeof window === "undefined" || !empresaId) return undefined;
      try {
        const raw =
          localStorage.getItem(`clientes:cache:${empresaId}`) ||
          localStorage.getItem(`clientes-list:cache:${empresaId}`);
        return raw ? JSON.parse(raw) : undefined;
      } catch {
        return undefined;
      }
    },
    queryFn: async () => {
      try {
        const { data, error } = await (supabase as any)
          .from("clientes")
          .select("id, nome, endereco, cidade, estado")
          .order("nome");
        if (error) throw error;
        const result = data ?? [];
        try {
          localStorage.setItem(`clientes-list:cache:${empresaId}`, JSON.stringify(result));
        } catch {}
        return result;
      } catch (err) {
        if (typeof window !== "undefined") {
          try {
            const raw =
              localStorage.getItem(`clientes:cache:${empresaId}`) ||
              localStorage.getItem(`clientes-list:cache:${empresaId}`);
            if (raw) return JSON.parse(raw);
          } catch {}
        }
        throw err;
      }
    },
  });

  const { data: materiaisAll } = useQuery({
    queryKey: ["materiais-list", empresaId],
    enabled: !!empresaId,
    initialData: () => {
      if (typeof window === "undefined" || !empresaId) return undefined;
      try {
        const raw =
          localStorage.getItem(`crud:materiais:cache:${empresaId}`) ||
          localStorage.getItem(`materiais-list:cache:${empresaId}`);
        return raw ? JSON.parse(raw) : undefined;
      } catch {
        return undefined;
      }
    },
    queryFn: async () => {
      try {
        const { data, error } = await (supabase as any)
          .from("materiais")
          .select("id, nome, preco_base, unidade")
          .eq("ativo", true)
          .order("nome");
        if (error) throw error;
        const result = data ?? [];
        try {
          localStorage.setItem(`materiais-list:cache:${empresaId}`, JSON.stringify(result));
        } catch {}
        return result;
      } catch (err) {
        if (typeof window !== "undefined") {
          try {
            const raw =
              localStorage.getItem(`crud:materiais:cache:${empresaId}`) ||
              localStorage.getItem(`materiais-list:cache:${empresaId}`);
            if (raw) return JSON.parse(raw);
          } catch {}
        }
        throw err;
      }
    },
  });

  const materiais = useMemo(() => {
    const list = materiaisAll ?? [];
    const allow = perms.materiais_permitidos;
    if (!allow || allow.length === 0) return list;
    return list.filter((m: any) => allow.includes(m.id));
  }, [materiaisAll, perms.materiais_permitidos]);

  const materiaisSelecionados = itens.map((item) =>
    (materiaisAll ?? []).find((material: any) => material.id === item.materialId),
  );
  const somenteFrete = itens.length === 1 && materialEhFrete(materiaisSelecionados[0]);

  if (!prof) return null;
  const profile = prof.profile;

  function onMaterialChange(index: number, id: string) {
    const m = (materiaisAll ?? []).find((x: any) => x.id === id);
    const base = m ? Number(m.preco_base) : null;
    setItens((atuais) =>
      atuais.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        if (!m) return { ...item, materialId: id, precoBase: null };
        const frete = materialEhFrete(m);
        const manterValor = item.valorPraticado && Number(item.valorPraticado) !== 0;
        return {
          ...item,
          materialId: id,
          precoBase: base,
          quantidade: frete ? "1" : item.quantidade,
          valorPraticado: frete
            ? "0"
            : !perms.pode_alterar_valor_produto || !manterValor
              ? String(base)
              : item.valorPraticado,
        };
      }),
    );
  }

  function atualizarItem(index: number, patch: Partial<MaterialVendaForm>) {
    setItens((atuais) =>
      atuais.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    );
  }

  function adicionarMaterial() {
    setItens((atuais) => (atuais.length < 3 ? [...atuais, novoMaterial()] : atuais));
  }

  function removerMaterial(index: number) {
    setItens((atuais) => atuais.filter((_, itemIndex) => itemIndex !== index));
  }

  function validar(): string | null {
    if (!clienteId || itens.some((item) => !item.materialId)) {
      return "Cliente e todos os materiais são obrigatórios";
    }
    if (itens.length < 1 || itens.length > 3) return "A venda deve ter de 1 a 3 materiais";
    if (new Set(itens.map((item) => item.materialId)).size !== itens.length) {
      return "Não adicione o mesmo material mais de uma vez";
    }
    if (materiaisSelecionados.some(materialEhFrete) && !somenteFrete) {
      return "O material FRETE deve ser usado sozinho na venda";
    }
    if (!formaPagamento) return "Escolha a forma de pagamento";
    let totalMateriais = 0;
    for (const item of itens) {
      const material = (materiaisAll ?? []).find((m: any) => m.id === item.materialId);
      const itemFrete = materialEhFrete(material);
      if (!itemFrete && !item.valorPraticado) return "Informe o valor de todos os materiais";
      const vp = itemFrete ? 0 : Number(item.valorPraticado);
      const qtd = itemFrete ? 1 : Number(item.quantidade || 0);
      if (!Number.isFinite(vp) || vp < 0) return "Valor praticado inválido";
      if (!Number.isFinite(qtd) || qtd <= 0) return "Quantidade inválida";
      if (!itemFrete && item.precoBase != null) {
        if (!perms.pode_alterar_valor_produto && vp !== item.precoBase) {
          return "Você não pode alterar o valor do produto";
        }
        if (item.precoBase > 0 && vp < item.precoBase) {
          const pct = ((item.precoBase - vp) / item.precoBase) * 100;
          if (pct > (perms.desconto_maximo_percent ?? 0)) {
            return `Desconto acima do permitido (${pct.toFixed(1)}% > ${perms.desconto_maximo_percent}%)`;
          }
        }
      }
      totalMateriais += vp * qtd;
    }
    const frete = Number(valorFrete || 0);
    if (!Number.isFinite(frete) || frete < 0) return "Valor do frete inválido";
    if (somenteFrete && frete <= 0) return "Informe o valor do frete";
    if (!perms.pode_alterar_frete && frete !== 0) return "Você não pode alterar o valor do frete";
    if (perms.frete_maximo != null && frete > perms.frete_maximo) {
      return `Frete acima do máximo (R$ ${perms.frete_maximo.toFixed(2)})`;
    }
    const total = totalMateriais + frete;
    if (perms.valor_venda_minimo != null && total < perms.valor_venda_minimo) {
      return `Venda abaixo do mínimo (R$ ${perms.valor_venda_minimo.toFixed(2)})`;
    }
    if (perms.valor_venda_maximo != null && total > perms.valor_venda_maximo) {
      return `Venda acima do máximo (R$ ${perms.valor_venda_maximo.toFixed(2)})`;
    }
    if (perms.observacao_obrigatoria && !obs.trim()) {
      return "Observação é obrigatória";
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
      const enderecoCompleto =
        [endereco.trim(), [cidade.trim(), estado.trim().toUpperCase()].filter(Boolean).join("/")]
          .filter(Boolean)
          .join(" - ") || null;
      const itensPayload = itens.map((item, index) => {
        const material = materiaisSelecionados[index];
        const itemFrete = materialEhFrete(material);
        return {
          material_id: item.materialId,
          preco_base: itemFrete ? 0 : Number(item.precoBase ?? 0),
          valor_praticado: itemFrete ? 0 : Number(item.valorPraticado),
          quantidade: itemFrete ? 1 : Number(item.quantidade || 1),
        };
      });
      const primeiroItem = itensPayload[0];
      const totalMateriais = itensPayload.reduce(
        (total, item) => total + item.valor_praticado * item.quantidade,
        0,
      );
      const payload: any = {
        empresa_id: profile.empresa_id,
        motorista_id: profile.id,
        motorista_venda_id: profile.id,
        cliente_id: clienteId,
        material_id: primeiroItem.material_id,
        preco_base_no_momento:
          itensPayload.length === 1
            ? primeiroItem.preco_base
            : itensPayload.reduce((total, item) => total + item.preco_base * item.quantidade, 0),
        valor_praticado: itensPayload.length === 1 ? primeiroItem.valor_praticado : totalMateriais,
        quantidade: itensPayload.length === 1 ? primeiroItem.quantidade : 1,
        itens: itensPayload,
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

  const freteTravado = !perms.pode_alterar_frete;

  return (
    <form onSubmit={onSubmit} className="space-y-4 pb-6">
      <h1 className="text-xl font-bold">Nova venda</h1>
      <p className="text-xs text-muted-foreground -mt-2">
        Cadastre o pedido. A entrega (KM, foto, GPS, assinatura) é feita depois em "Pendentes".
      </p>

      <Card>
        <CardContent className="p-3 space-y-3">
          <div>
            <Label>Cliente *</Label>
            <ClienteCombobox
              clientes={clientes ?? []}
              value={clienteId}
              onValueChange={(v) => {
                setClienteId(v);
                const c = (clientes ?? []).find((x: any) => x.id === v);
                if (c?.endereco && !endereco) setEndereco(c.endereco);
                if (c?.cidade && !cidade) setCidade(c.cidade);
                if (c?.estado && !estado) setEstado(c.estado);
              }}
            />
          </div>
          <div className="space-y-3">
            {itens.map((item, index) => {
              const material = materiaisSelecionados[index];
              const itemFrete = materialEhFrete(material);
              const valorTravado = itemFrete || !perms.pode_alterar_valor_produto;
              const diff =
                !itemFrete &&
                item.precoBase != null &&
                item.valorPraticado &&
                Number(item.valorPraticado) !== item.precoBase;
              return (
                <div key={item.key} className="space-y-3 rounded-xl border bg-muted/20 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label>Material {index + 1} *</Label>
                    {itens.length > 1 ? (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        aria-label={`Remover material ${index + 1}`}
                        onClick={() => removerMaterial(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                  <Select
                    value={item.materialId}
                    onValueChange={(value) => onMaterialChange(index, value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {materiais.map((m: any) => (
                        <SelectItem
                          key={m.id}
                          value={m.id}
                          disabled={
                            itens.some(
                              (outroItem, outroIndex) =>
                                outroIndex !== index && outroItem.materialId === m.id,
                            ) ||
                            (itens.length > 1 && materialEhFrete(m))
                          }
                        >
                          {m.nome} · R$ {Number(m.preco_base).toFixed(2)}/{m.unidade}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {itemFrete ? (
                    <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">
                      FRETE selecionado: informe somente o valor do frete da venda.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Quantidade</Label>
                        <Input
                          type="number"
                          step="0.001"
                          value={item.quantidade}
                          onChange={(event) =>
                            atualizarItem(index, { quantidade: event.target.value })
                          }
                        />
                      </div>
                      <div>
                        <Label className="flex items-center gap-1">
                          Valor praticado *
                          {valorTravado ? <Lock className="h-3 w-3 text-muted-foreground" /> : null}
                        </Label>
                        <MoneyInput
                          value={item.valorPraticado}
                          readOnly={valorTravado}
                          onValueChange={(value) => atualizarItem(index, { valorPraticado: value })}
                        />
                      </div>
                    </div>
                  )}
                  {diff && !valorTravado ? (
                    <p className="text-xs text-amber-500">
                      ⚠ Diferente do preço base (R$ {item.precoBase?.toFixed(2)})
                    </p>
                  ) : null}
                </div>
              );
            })}
            <Button
              type="button"
              variant="outline"
              className="w-full border-dashed"
              onClick={adicionarMaterial}
              disabled={itens.length >= 3 || somenteFrete}
            >
              <Plus className="mr-2 h-4 w-4" />
              {itens.length >= 3 ? "Limite de 3 materiais" : "Adicionar outro material"}
            </Button>
            <p className="text-center text-[11px] text-muted-foreground">
              Uma venda pode ter até 3 materiais. O frete é informado uma única vez.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3 space-y-3">
          <div>
            <Label className="flex items-center gap-1">
              Valor do frete (R$) {somenteFrete ? "*" : ""}
              {freteTravado && <Lock className="h-3 w-3 text-muted-foreground" />}
            </Label>
            <MoneyInput
              value={valorFrete}
              readOnly={freteTravado}
              onValueChange={setValorFrete}
              placeholder="0,00"
            />
          </div>
          <div>
            <Label>Forma de pagamento *</Label>
            <Select value={formaPagamento} onValueChange={setFormaPagamento}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dinheiro">Dinheiro</SelectItem>
                <SelectItem value="pix">Pix</SelectItem>
                <SelectItem value="deposito">Depósito</SelectItem>
                <SelectItem value="cartao_credito">Cartão de crédito</SelectItem>
                <SelectItem value="permuta">Permuta</SelectItem>
                <SelectItem value="boleto">Boleto</SelectItem>
                <SelectItem value="carteira">Carteira</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground mt-1">
              Dinheiro, Pix, Depósito e Cartão de crédito entram para confirmação. Boleto, Permuta
              e Carteira ficam pendentes de recebimento.
            </p>
          </div>
          <div>
            <Label>Endereço de entrega</Label>
            <Input
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              placeholder="Rua, número, bairro"
            />
          </div>
          <div className="grid grid-cols-[1fr_90px] gap-3">
            <div>
              <Label>Cidade</Label>
              <Input value={cidade} onChange={(e) => setCidade(e.target.value)} />
            </div>
            <div>
              <Label>UF</Label>
              <Select value={estado} onValueChange={setEstado}>
                <SelectTrigger>
                  <SelectValue placeholder="UF" />
                </SelectTrigger>
                <SelectContent>
                  {UFS.map((uf) => (
                    <SelectItem key={uf} value={uf}>
                      {uf}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} />
          </div>
        </CardContent>
      </Card>

      <Button type="submit" variant="action" size="lg" className="w-full" disabled={submitting}>
        {submitting ? "Salvando..." : "Cadastrar venda"}
      </Button>
    </form>
  );
}
