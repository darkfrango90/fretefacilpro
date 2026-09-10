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
import { ClienteCombobox } from "@/components/cliente-combobox";
import { DateField } from "@/components/date-field";
import { MoneyInput } from "@/components/money-input";
import { Paperclip } from "lucide-react";
import { toast } from "sonner";

interface ContaReceberDialogProps {
  aberto: boolean;
  empresaId: string | undefined;
  criadoPor: string | undefined;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

export function ContaReceberDialog({
  aberto,
  empresaId,
  criadoPor,
  onClose,
  onSaved,
}: ContaReceberDialogProps) {
  const [clienteId, setClienteId] = useState("");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [vencimento, setVencimento] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);

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

  useEffect(() => {
    if (aberto) return;
    setClienteId("");
    setDescricao("");
    setValor("");
    setVencimento("");
    setArquivo(null);
  }, [aberto]);

  async function salvar() {
    if (!empresaId) return;
    const valorNumerico = Number(valor);
    if (!clienteId) return toast.error("Selecione o cliente");
    if (!vencimento) return toast.error("Informe o vencimento original");
    if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) {
      return toast.error("Informe um valor válido");
    }

    setSalvando(true);
    try {
      const id = crypto.randomUUID();
      let documentoUrl: string | null = null;

      if (arquivo) {
        if (!criadoPor) return toast.error("Sessão inválida para enviar o documento");
        const extensao = arquivo.name.includes(".") ? arquivo.name.split(".").pop() : null;
        const caminho = `${empresaId}/${criadoPor}/${id}${extensao ? `.${extensao}` : ""}`;
        const { error: uploadError } = await supabase.storage
          .from("contas-receber")
          .upload(caminho, arquivo, { upsert: true, contentType: arquivo.type || undefined });
        if (uploadError) {
          toast.error(`Falha ao enviar o documento: ${uploadError.message}`);
          return;
        }
        documentoUrl = caminho;
      }

      const { error } = await (supabase as any).from("contas_receber").insert({
        id,
        empresa_id: empresaId,
        cliente_id: clienteId,
        descricao: descricao.trim() || null,
        valor: valorNumerico,
        vencimento,
        documento_url: documentoUrl,
        criado_por: criadoPor ?? null,
      });
      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("Conta a receber cadastrada");
      onClose();
      await onSaved();
    } finally {
      setSalvando(false);
    }
  }

  if (!aberto) return null;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cadastrar conta a receber</DialogTitle>
          <DialogDescription>
            Lançamento avulso, para dívidas vindas de outro sistema. O vencimento pode ser
            retroativo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Cliente *</Label>
            <ClienteCombobox
              clientes={clientes ?? []}
              value={clienteId}
              onValueChange={setClienteId}
            />
          </div>

          <div>
            <Label htmlFor="conta-receber-valor">Valor total *</Label>
            <MoneyInput id="conta-receber-valor" value={valor} onValueChange={setValor} />
          </div>

          <div>
            <Label htmlFor="conta-receber-vencimento">Vencimento original *</Label>
            <DateField
              id="conta-receber-vencimento"
              value={vencimento}
              onValueChange={setVencimento}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Use a data original da dívida, mesmo que já tenha vencido.
            </p>
          </div>

          <div>
            <Label htmlFor="conta-receber-descricao">Descrição / origem da dívida</Label>
            <Textarea
              id="conta-receber-descricao"
              rows={2}
              placeholder="Ex.: Saldo em aberto do sistema anterior, nota 1234"
              value={descricao}
              onChange={(event) => setDescricao(event.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="conta-receber-documento" className="flex items-center gap-1">
              <Paperclip className="h-3.5 w-3.5" /> Documento de origem
            </Label>
            <Input
              id="conta-receber-documento"
              type="file"
              accept="image/*,application/pdf"
              onChange={(event) => setArquivo(event.target.files?.[0] ?? null)}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Imagem ou PDF que comprova a origem da dívida (opcional).
            </p>
          </div>

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="action"
              className="flex-1"
              onClick={salvar}
              disabled={salvando}
            >
              {salvando ? "Salvando..." : "Cadastrar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
