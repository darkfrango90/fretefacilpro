import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClienteCombobox } from "@/components/cliente-combobox";
import { MoneyInput } from "@/components/money-input";
import { toast } from "sonner";
import { obterItensEntrega, valorUnitarioDeTotal } from "@/lib/entrega-itens";

const FORMAS_PAGAMENTO_EDICAO = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "pix", label: "Pix" },
  { value: "deposito", label: "Depósito" },
  { value: "cartao_credito", label: "Cartão de crédito" },
  { value: "permuta", label: "Permuta" },
  { value: "boleto", label: "Boleto" },
  { value: "carteira", label: "Carteira" },
];

function materialEhFrete(nome?: string | null) {
  return (
    String(nome ?? "")
      .trim()
      .toLocaleUpperCase("pt-BR") === "FRETE"
  );
}

export type EntregaParaEditar = {
  id: string;
  cliente_id?: string | null;
  material_id?: string | null;
  itens?: unknown;
  quantidade?: number | string | null;
  valor_praticado?: number | string | null;
  valor_frete?: number | string | null;
  forma_pagamento?: string | null;
  endereco?: string | null;
  observacoes?: string | null;
};

type FormState = {
  id: string;
  cliente_id: string;
  material_id: string;
  quantidade: string;
  valor_total: string;
  valor_praticado: string;
  valor_frete: string;
  forma_pagamento: string;
  endereco: string;
  observacoes: string;
  multiplosMateriais: boolean;
};

interface EntregaEditarDialogProps {
  entrega: EntregaParaEditar | null;
  empresaId: string | undefined;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

export function EntregaEditarDialog({
  entrega,
  empresaId,
  onClose,
  onSaved,
}: EntregaEditarDialogProps) {
  const { data: clientes } = useQuery({
    queryKey: ["entregas-clientes-edicao", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("clientes")
        .select("id, nome")
        .eq("empresa_id", empresaId)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: materiais } = useQuery({
    queryKey: ["entregas-materiais-edicao", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("materiais")
        .select("id, nome, preco_base, unidade")
        .eq("empresa_id", empresaId)
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const [form, setForm] = useState<FormState | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!entrega) return;
    const quantidade = String(entrega.quantidade ?? "");
    setForm({
      id: entrega.id,
      cliente_id: entrega.cliente_id ?? "",
      material_id: entrega.material_id ?? "",
      quantidade,
      valor_total: String(Number(entrega.valor_praticado ?? 0) * Number(entrega.quantidade ?? 1)),
      valor_praticado: String(entrega.valor_praticado ?? ""),
      valor_frete: String(entrega.valor_frete ?? ""),
      forma_pagamento: entrega.forma_pagamento ?? "",
      endereco: entrega.endereco ?? "",
      observacoes: entrega.observacoes ?? "",
      multiplosMateriais: obterItensEntrega(entrega as any).length > 1,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entrega?.id]);

  function onSelecionarMaterial(materialId: string) {
    if (!form) return;
    const material = (materiais ?? []).find((m: any) => m.id === materialId);
    const frete = materialEhFrete(material?.nome);
    const quantidade = frete ? "1" : form.quantidade;
    const valorTotal = frete
      ? "0"
      : String(Number(material?.preco_base ?? 0) * (Number(quantidade || 1) || 1));
    setForm({
      ...form,
      material_id: materialId,
      quantidade,
      valor_total: valorTotal,
      valor_praticado: frete ? "0" : valorUnitarioDeTotal(valorTotal, quantidade),
    });
  }

  async function salvar() {
    if (!form) return;
    const materialSelecionado = (materiais ?? []).find((m: any) => m.id === form.material_id);
    const isFrete = !form.multiplosMateriais && materialEhFrete(materialSelecionado?.nome);
    const quantidade = isFrete ? 1 : Number(form.quantidade);
    const valorPraticado = isFrete ? 0 : Number(form.valor_praticado);
    const valorFrete = Number(form.valor_frete || 0);
    if (!form.cliente_id) return toast.error("Selecione o cliente");
    if (!form.multiplosMateriais && !form.material_id) return toast.error("Selecione o material");
    if (!form.forma_pagamento) return toast.error("Selecione a forma de pagamento");
    if (!form.multiplosMateriais && !isFrete && (!Number.isFinite(quantidade) || quantidade <= 0))
      return toast.error("Quantidade inválida");
    if (!form.multiplosMateriais && !isFrete && !form.valor_total)
      return toast.error("Informe o valor total do material");
    if (
      !form.multiplosMateriais &&
      !isFrete &&
      (!Number.isFinite(valorPraticado) || valorPraticado < 0)
    )
      return toast.error("Valor inválido");
    if (!Number.isFinite(valorFrete) || valorFrete < 0) return toast.error("Frete inválido");
    if (isFrete && valorFrete <= 0) return toast.error("Informe o valor do frete");

    setSalvando(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-entrega", {
        body: {
          action: "editar_entrega",
          entrega_id: form.id,
          ...(form.multiplosMateriais
            ? {}
            : { material_id: form.material_id, quantidade, valor_praticado: valorPraticado }),
          valor_frete: valorFrete,
          endereco: form.endereco,
          observacoes: form.observacoes,
          cliente_id: form.cliente_id,
          forma_pagamento: form.forma_pagamento,
        },
      });
      if (error) return toast.error(error.message);
      if (data?.erro) {
        const mensagens: Record<string, string> = {
          SEM_PERMISSAO: "Sem permissão para editar esta venda",
          CLIENTE_INVALIDO: "Cliente inválido",
          MATERIAL_INVALIDO: "Material inválido",
          FORMA_PAGAMENTO_INVALIDA: "Forma de pagamento inválida",
        };
        return toast.error(mensagens[data.erro] ?? data.erro);
      }
      toast.success("Venda atualizada");
      onClose();
      await onSaved();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={!!entrega} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar venda</DialogTitle>
          <DialogDescription>Corrija os dados preenchidos incorretamente.</DialogDescription>
        </DialogHeader>
        {form && (
          <div className="space-y-3">
            <div>
              <Label>Cliente</Label>
              <ClienteCombobox
                clientes={clientes ?? []}
                value={form.cliente_id}
                onValueChange={(clienteId) => setForm({ ...form, cliente_id: clienteId })}
              />
            </div>

            {form.multiplosMateriais && (
              <p className="rounded-lg bg-muted p-2 text-xs text-muted-foreground">
                Esta venda possui vários materiais. Para preservar os itens, o material, a
                quantidade e o valor não podem ser alterados aqui — apenas cliente, frete, forma de
                pagamento, endereço e observações.
              </p>
            )}

            {!form.multiplosMateriais && (
              <div>
                <Label>Material</Label>
                <Select value={form.material_id} onValueChange={onSelecionarMaterial}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o material" />
                  </SelectTrigger>
                  <SelectContent>
                    {(materiais ?? []).map((m: any) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {(() => {
              const materialSelecionado = (materiais ?? []).find(
                (m: any) => m.id === form.material_id,
              );
              const isFrete = !form.multiplosMateriais && materialEhFrete(materialSelecionado?.nome);
              if (form.multiplosMateriais) return null;
              if (isFrete) {
                return (
                  <p className="text-xs text-muted-foreground">
                    Material FRETE: quantidade e valor do produto não se aplicam. Informe apenas o
                    valor do frete abaixo.
                  </p>
                );
              }
              return (
                <>
                  <div>
                    <Label>Quantidade</Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={form.quantidade}
                      onChange={(e) => {
                        const quantidade = e.target.value;
                        setForm({
                          ...form,
                          quantidade,
                          valor_praticado: valorUnitarioDeTotal(form.valor_total, quantidade),
                        });
                      }}
                    />
                  </div>
                  <div>
                    <Label>Valor total do material (R$)</Label>
                    <MoneyInput
                      value={form.valor_total}
                      onValueChange={(value) =>
                        setForm({
                          ...form,
                          valor_total: value,
                          valor_praticado: valorUnitarioDeTotal(value, form.quantidade),
                        })
                      }
                    />
                  </div>
                  <p className="text-xs text-muted-foreground -mt-1">
                    Equivale a R$ {Number(form.valor_praticado || 0).toFixed(2)} /{" "}
                    {materialSelecionado?.unidade ?? "un"} (informativo)
                  </p>
                </>
              );
            })()}

            <div>
              <Label>Valor do frete (R$)</Label>
              <MoneyInput
                value={form.valor_frete}
                onValueChange={(value) => setForm({ ...form, valor_frete: value })}
              />
            </div>
            <div>
              <Label>Forma de pagamento</Label>
              <Select
                value={form.forma_pagamento}
                onValueChange={(v) => setForm({ ...form, forma_pagamento: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {FORMAS_PAGAMENTO_EDICAO.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Endereço</Label>
              <Input
                value={form.endereco}
                onChange={(e) => setForm({ ...form, endereco: e.target.value })}
              />
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea
                rows={2}
                value={form.observacoes}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={onClose}>
                Cancelar
              </Button>
              <Button variant="action" className="flex-1" onClick={salvar} disabled={salvando}>
                {salvando ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
