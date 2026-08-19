import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, MapPin, User } from "lucide-react";
import { obterItensEntrega } from "@/lib/entrega-itens";

const SELECT_DETAIL =
  "id, numero, endereco, km_inicial, km_final, km_inicial_ia_confianca, km_final_ia_confianca, iniciada_em, finalizada_em, criada_em, material_id, itens, quantidade, valor_praticado, valor_frete, preco_base_no_momento, status, observacoes, forma_pagamento, foto_odometro_inicial_url, foto_odometro_final_url, foto_material_url, assinatura_url, foto_material_gps_lat, foto_material_gps_lng, motorista_venda_id, motorista_entrega_id, cliente:clientes(nome), material:materiais(nome, unidade), veiculo:veiculos(placa)";

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pendente: { label: "Pendente", cls: "" },
  em_rota: { label: "Em entrega", cls: "" },
  entregue: { label: "Entregue", cls: "" },
  cancelada: { label: "Cancelada", cls: "" },
};

const FORMA_PAGAMENTO_LABEL: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "Pix",
  deposito: "Depósito",
  cartao_credito: "Cartão de crédito",
  permuta: "Permuta",
  boleto: "Boleto",
  carteira: "Carteira",
};

function fmtBRL(v: any) {
  if (v == null) return "—";
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function Row({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex justify-between gap-3 text-sm py-1 border-b last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right break-words">{value ?? "—"}</span>
    </div>
  );
}

export function EntregaDetalheDialog({
  id,
  onClose,
  mostrarFinalizar = false,
}: {
  id: string | null;
  onClose: () => void;
  mostrarFinalizar?: boolean;
}) {
  const {
    data: item,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["entrega-admin-detalhe", id],
    enabled: !!id,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("entregas")
        .select(SELECT_DETAIL)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const motoristaIds = useMemo(() => {
    const ids = new Set<string>();
    if (item?.motorista_venda_id) ids.add(item.motorista_venda_id);
    if (item?.motorista_entrega_id) ids.add(item.motorista_entrega_id);
    return Array.from(ids);
  }, [item]);

  const { data: motoristas } = useQuery({
    queryKey: ["entrega-motoristas", motoristaIds],
    enabled: motoristaIds.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("profiles")
        .select("id, nome")
        .in("id", motoristaIds);
      if (error) throw error;
      const map: Record<string, string> = {};
      (data ?? []).forEach((p: any) => {
        map[p.id] = p.nome;
      });
      return map;
    },
  });

  const nomeVenda = item?.motorista_venda_id ? motoristas?.[item.motorista_venda_id] : null;
  const nomeEntrega = item?.motorista_entrega_id ? motoristas?.[item.motorista_entrega_id] : null;
  const st = item ? (STATUS_LABEL[item.status] ?? { label: item.status, cls: "" }) : null;

  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {item?.numero != null && (
              <span className="text-muted-foreground mr-1">#{item.numero}</span>
            )}
            {item?.cliente?.nome ?? "Entrega"}
          </DialogTitle>
          <DialogDescription>
            {isLoading ? "Carregando detalhes..." : (st?.label ?? "")}
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center justify-center py-6 text-sm text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
          </div>
        )}

        {error && !isLoading && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            Não foi possível carregar os detalhes.
          </div>
        )}

        {item && !isLoading && (
          <>
            <div className="space-y-1">
              {obterItensEntrega(item).map((material, index) => (
                <div key={`${material.material_id}-${index}`} className="rounded-lg border p-2">
                  <Row
                    label={`Material ${index + 1}`}
                    value={`${material.nome} (${material.unidade})`}
                  />
                  <Row label="Quantidade" value={material.quantidade} />
                  <Row label="Valor unitário" value={fmtBRL(material.valor_praticado)} />
                  <Row
                    label="Subtotal"
                    value={fmtBRL(Number(material.valor_praticado) * Number(material.quantidade))}
                  />
                </div>
              ))}
              <Row label="Veículo" value={item.veiculo?.placa} />
              <Row
                label="Endereço"
                value={
                  item.endereco ? (
                    <span className="inline-flex items-start gap-1 justify-end">
                      <MapPin className="h-3 w-3 mt-0.5 shrink-0" /> {item.endereco}
                    </span>
                  ) : (
                    "—"
                  )
                }
              />
              {obterItensEntrega(item).length === 1 &&
                Number(item.preco_base_no_momento) !== Number(item.valor_praticado) && (
                  <Row label="Preço base" value={fmtBRL(item.preco_base_no_momento)} />
                )}
              <Row label="Valor frete" value={fmtBRL(item.valor_frete)} />
              <Row
                label="Forma de pagamento"
                value={
                  item.forma_pagamento
                    ? (FORMA_PAGAMENTO_LABEL[item.forma_pagamento] ?? item.forma_pagamento)
                    : "—"
                }
              />
              <Row
                label="Motorista (venda)"
                value={
                  nomeVenda ? (
                    <span className="inline-flex items-center gap-1 justify-end">
                      <User className="h-3 w-3" /> {nomeVenda}
                    </span>
                  ) : item.motorista_venda_id ? (
                    "..."
                  ) : (
                    "—"
                  )
                }
              />
              <Row
                label="Motorista (entrega)"
                value={
                  nomeEntrega ? (
                    <span className="inline-flex items-center gap-1 justify-end">
                      <User className="h-3 w-3" /> {nomeEntrega}
                    </span>
                  ) : item.motorista_entrega_id ? (
                    "..."
                  ) : (
                    "—"
                  )
                }
              />
              <Row label="KM inicial" value={item.km_inicial} />
              {item.km_inicial_ia_confianca && (
                <Row label="Confiança IA (início)" value={item.km_inicial_ia_confianca} />
              )}
              <Row label="KM final" value={item.km_final} />
              {item.km_final_ia_confianca && (
                <Row label="Confiança IA (fim)" value={item.km_final_ia_confianca} />
              )}
              {item.km_inicial != null && item.km_final != null && (
                <Row
                  label="KM percorridos"
                  value={Number(item.km_final) - Number(item.km_inicial)}
                />
              )}
              <Row
                label="Criada em"
                value={item.criada_em ? new Date(item.criada_em).toLocaleString("pt-BR") : "—"}
              />
              <Row
                label="Iniciada em"
                value={item.iniciada_em ? new Date(item.iniciada_em).toLocaleString("pt-BR") : "—"}
              />
              <Row
                label="Finalizada em"
                value={
                  item.finalizada_em ? new Date(item.finalizada_em).toLocaleString("pt-BR") : "—"
                }
              />
              {item.foto_material_gps_lat != null && (
                <Row
                  label="GPS material"
                  value={`${item.foto_material_gps_lat?.toFixed?.(5)}, ${item.foto_material_gps_lng?.toFixed?.(5)}`}
                />
              )}
              {item.observacoes && <Row label="Observações" value={item.observacoes} />}
            </div>

            {(item.foto_odometro_inicial_url || item.status === "entregue") && (
              <div className="grid grid-cols-2 gap-2 pt-2">
                <FotoBox
                  label="Odômetro inicial"
                  bucket="odometros"
                  path={item.foto_odometro_inicial_url}
                />
                <FotoBox
                  label="Odômetro final"
                  bucket="odometros"
                  path={item.foto_odometro_final_url}
                />
                <FotoBox label="Material" bucket="entregas" path={item.foto_material_url} />
                <FotoBox label="Assinatura" bucket="assinaturas" path={item.assinatura_url} />
              </div>
            )}

            {mostrarFinalizar && item.status === "em_rota" && (
              <Link to="/entrega/$id/finalizar" params={{ id: item.id }} onClick={onClose}>
                <Button variant="action" className="mt-2 w-full">
                  Finalizar entrega
                </Button>
              </Link>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function FotoBox({
  label,
  bucket,
  path,
}: {
  label: string;
  bucket: "odometros" | "entregas" | "assinaturas";
  path?: string | null;
}) {
  const cleanPath = path?.trim() || null;
  const isHttp = !!cleanPath && /^https?:\/\//i.test(cleanPath);
  const { data: signedUrl } = useQuery({
    queryKey: ["storage-signed-url", bucket, cleanPath],
    enabled: !!cleanPath && !isHttp,
    staleTime: 50 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(cleanPath!, 60 * 60);
      if (error) throw error;
      return data.signedUrl;
    },
  });
  const url = isHttp ? cleanPath : signedUrl;

  return (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground">{label}</div>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer">
          <img src={url} alt={label} className="w-full h-24 object-cover rounded border" />
        </a>
      ) : (
        <div className="w-full h-24 rounded border bg-muted flex items-center justify-center text-xs text-muted-foreground">
          sem foto
        </div>
      )}
    </div>
  );
}
