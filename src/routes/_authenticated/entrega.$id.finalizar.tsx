import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-session";
import { usePermissoes } from "@/hooks/use-permissoes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Camera, MapPin, ArrowLeft, ArrowRight, Check } from "lucide-react";
import { capturarFoto, obterCoordenadas } from "@/lib/native";
import { enqueue, fileToPhoto } from "@/lib/offline/queue";
import { syncNow } from "@/lib/offline/sync";
import { SignaturePad } from "@/components/signature-pad";

export const Route = createFileRoute("/_authenticated/entrega/$id/finalizar")({
  component: Finalizar,
});

function Finalizar() {
  const { id } = Route.useParams();
  const { data: prof } = useProfile();
  const { perms } = usePermissoes();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: entrega, isLoading } = useQuery({
    queryKey: ["entrega-finalizar", id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("entregas")
        .select("id, km_inicial, status, cliente:clientes(nome), material:materiais(nome, unidade), quantidade")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [step, setStep] = useState<1 | 2 | 3>(1);

  // step 1
  const [kmFinal, setKmFinal] = useState("");
  const [fotoOdom, setFotoOdom] = useState<File | null>(null);

  // step 2
  const [fotoMat, setFotoMat] = useState<File | null>(null);
  const [gps, setGps] = useState<{ lat: number; lng: number; em: string } | null>(null);
  const [capturandoGps, setCapturandoGps] = useState(false);

  // step 3
  const [assinaturaBlob, setAssinaturaBlob] = useState<Blob | null>(null);
  const [clienteAusente, setClienteAusente] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>;
  if (!entrega) return <p className="text-sm text-destructive">Entrega não encontrada.</p>;

  async function tirarFotoOdom() {
    try {
      const f = await capturarFoto();
      if (f) setFotoOdom(f);
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível acessar a câmera.");
    }
  }

  async function tirarFotoMat() {
    try {
      const f = await capturarFoto();
      if (!f) return;
      setFotoMat(f);
      // captura GPS no mesmo momento
      setCapturandoGps(true);
      const c = await obterCoordenadas();
      setCapturandoGps(false);
      if (c) setGps({ ...c, em: new Date().toISOString() });
    } catch (e: any) {
      setCapturandoGps(false);
      toast.error(e?.message ?? "Não foi possível acessar a câmera.");
    }
  }

  function avancarStep1() {
    if (perms.foto_odometro_obrigatoria && !fotoOdom) return toast.error("Foto do odômetro é obrigatória");
    if (!kmFinal) return toast.error("Informe o KM final");
    if (entrega?.km_inicial != null && Number(kmFinal) < Number(entrega.km_inicial)) {
      toast.warning("KM final menor que o inicial — verifique antes de salvar.");
    }
    setStep(2);
  }

  function avancarStep2() {
    if (!fotoMat) return toast.error("Foto do material é obrigatória");
    if (perms.gps_obrigatorio && !gps) return toast.error("GPS é obrigatório. Habilite a localização.");
    setStep(3);
  }

  async function concluir() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const photos: any[] = [];
      if (fotoOdom) photos.push(await fileToPhoto("foto_odometro_final_url", "odometros", fotoOdom));
      if (fotoMat) photos.push(await fileToPhoto("foto_material_url", "entregas", fotoMat));
      if (assinaturaBlob) {
        const f = new File([assinaturaBlob], "assinatura.png", { type: "image/png" });
        photos.push(await fileToPhoto("assinatura_url", "assinaturas", f));
      }
      const payload: any = {
        entrega_id: id,
        km_final: Number(kmFinal),
        foto_material_gps_lat: gps?.lat ?? null,
        foto_material_gps_lng: gps?.lng ?? null,
        foto_material_gps_em: gps?.em ?? null,
        assinatura_coletada: !!assinaturaBlob && !clienteAusente,
      };
      await enqueue({
        id: crypto.randomUUID(),
        type: "finalizar_entrega",
        empresa_id: prof!.profile.empresa_id,
        motorista_id: prof!.profile.id,
        payload,
        photos,
      });
      if (navigator.onLine) {
        toast.success("Entrega finalizada! Sincronizando...");
        const res = await syncNow({ silent: true });
        if (res.failed > 0) {
          toast.warning("Entrega salva, mas a sincronização ainda está pendente.");
        }
      } else {
        toast.success("Finalizada offline. Sincronizará quando houver conexão.");
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["minhas-entregas"] }),
        queryClient.invalidateQueries({ queryKey: ["entrega-detalhe"] }),
        queryClient.invalidateQueries({ queryKey: ["entrega-finalizar"] }),
        queryClient.invalidateQueries({ queryKey: ["pendentes"] }),
      ]);
      navigate({ to: "/minhas-entregas" });
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao finalizar");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Finalizar entrega</h1>
        <span className="text-xs text-muted-foreground">Etapa {step}/3</span>
      </div>
      <Card><CardContent className="p-3 text-xs">
        <div className="font-medium">{entrega.cliente?.nome}</div>
        <div className="text-muted-foreground">
          {entrega.material?.nome} · {entrega.quantidade} {entrega.material?.unidade}
          {entrega.km_inicial != null && ` · KM ini: ${entrega.km_inicial}`}
        </div>
      </CardContent></Card>

      {step === 1 && (
        <Card><CardContent className="p-3 space-y-3">
          <div className="font-semibold">1. KM final + foto do odômetro</div>
          <div>
            <Label>KM final do veículo *</Label>
            <Input type="number" inputMode="numeric" value={kmFinal}
              onChange={(e) => setKmFinal(e.target.value)} />
            {entrega.km_inicial != null && kmFinal && Number(kmFinal) >= Number(entrega.km_inicial) && (
              <p className="text-xs text-muted-foreground mt-1">
                Percorrido: {Number(kmFinal) - Number(entrega.km_inicial)} km
              </p>
            )}
          </div>
          <div>
            <Label className="flex items-center gap-1">
              <Camera className="h-4 w-4" /> Foto do odômetro
              {perms.foto_odometro_obrigatoria && " *"}
            </Label>
            <div className="flex items-center gap-2 mt-1">
              <Button type="button" variant="outline" size="sm" onClick={tirarFotoOdom}>
                <Camera className="h-4 w-4 mr-1" />
                {fotoOdom ? "Trocar foto" : "Tirar foto"}
              </Button>
              {fotoOdom && <span className="text-xs text-muted-foreground truncate">✓ capturada</span>}
            </div>
          </div>
          <div className="flex justify-between pt-2">
            <Link to="/minhas-entregas" className="text-sm text-muted-foreground self-center">Cancelar</Link>
            <Button variant="action" onClick={avancarStep1}>
              Avançar <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </CardContent></Card>
      )}

      {step === 2 && (
        <Card><CardContent className="p-3 space-y-3">
          <div className="font-semibold">2. Foto do material na obra + GPS</div>
          <div>
            <Label className="flex items-center gap-1">
              <Camera className="h-4 w-4" /> Foto do material *
            </Label>
            <div className="flex items-center gap-2 mt-1">
              <Button type="button" variant="outline" size="sm" onClick={tirarFotoMat}>
                <Camera className="h-4 w-4 mr-1" />
                {fotoMat ? "Trocar foto" : "Tirar foto"}
              </Button>
              {fotoMat && <span className="text-xs text-muted-foreground">✓ capturada</span>}
            </div>
          </div>
          <div className="text-xs flex items-center gap-1 text-muted-foreground">
            <MapPin className="h-3 w-3" />
            {capturandoGps ? "Capturando GPS..." :
              gps ? `GPS: ${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)}` :
              perms.gps_obrigatorio ? "GPS obrigatório — habilite a localização." :
              "GPS será capturado junto com a foto."}
          </div>
          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
            </Button>
            <Button variant="action" onClick={avancarStep2}>
              Avançar <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </CardContent></Card>
      )}

      {step === 3 && (
        <Card><CardContent className="p-3 space-y-3">
          <div className="font-semibold">3. Assinatura do cliente (opcional)</div>
          {!clienteAusente && !assinaturaBlob && (
            <SignaturePad
              onConfirm={(b) => { setAssinaturaBlob(b); toast.success("Assinatura registrada"); }}
              onSkip={() => { setClienteAusente(true); setAssinaturaBlob(null); }}
            />
          )}
          {assinaturaBlob && (
            <div className="text-xs text-muted-foreground">
              ✓ Assinatura coletada.{" "}
              <button type="button" className="underline" onClick={() => setAssinaturaBlob(null)}>refazer</button>
            </div>
          )}
          {clienteAusente && (
            <div className="text-xs text-muted-foreground">
              Cliente ausente — assinatura não coletada.{" "}
              <button type="button" className="underline" onClick={() => setClienteAusente(false)}>desfazer</button>
            </div>
          )}
          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => setStep(2)}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
            </Button>
            <Button variant="action" onClick={concluir} disabled={submitting}>
              <Check className="h-4 w-4 mr-1" />
              {submitting ? "Concluindo..." : "Concluir entrega"}
            </Button>
          </div>
        </CardContent></Card>
      )}
    </div>
  );
}
