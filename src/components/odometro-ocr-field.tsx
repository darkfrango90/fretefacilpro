import { useState } from "react";
import { Camera, CheckCircle2, Loader2, Sparkles, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { capturarFoto } from "@/lib/native";
import {
  analisarFotoOdometro,
  type ConfiancaOdometro,
  type LeituraOdometro,
} from "@/lib/ocr-odometro";

type Props = {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  photo: File | null;
  onPhotoChange: (photo: File | null) => void;
  photoRequired?: boolean;
  minKm?: number | null;
  onReadingChange?: (reading: LeituraOdometro | null) => void;
};

const CONFIANCA_LABEL: Record<ConfiancaOdometro, string> = {
  alta: "Leitura nítida",
  media: "Confira os dígitos",
  baixa: "Foto ou leitura incerta",
};

export function OdometroOcrField({
  label,
  value,
  onValueChange,
  photo,
  onPhotoChange,
  photoRequired = true,
  minKm,
  onReadingChange,
}: Props) {
  const [analisando, setAnalisando] = useState(false);
  const [leitura, setLeitura] = useState<LeituraOdometro | null>(null);

  async function capturarEAnalisar() {
    try {
      const file = await capturarFoto({ qualidade: 90 });
      if (!file) return;
      onPhotoChange(file);
      setLeitura(null);
      onReadingChange?.(null);

      if (!navigator.onLine) {
        toast.info("Foto capturada. Sem internet, confira e informe o KM manualmente.");
        return;
      }

      setAnalisando(true);
      const resultado = await analisarFotoOdometro(file);
      setLeitura(resultado);
      onReadingChange?.(resultado);
      if (resultado.km == null) {
        toast.warning(resultado.motivo || "A IA não conseguiu ler o odômetro. Tire outra foto.");
        return;
      }

      onValueChange(String(resultado.km));
      if (minKm != null && resultado.km < minKm) {
        toast.warning("A leitura ficou menor que o KM inicial. Confira ou tire outra foto.");
      } else if (resultado.confianca === "alta") {
        toast.success(`KM ${resultado.km.toLocaleString("pt-BR")} identificado. Confirme o valor.`);
      } else {
        toast.warning(`KM preenchido pela IA com confiança ${resultado.confianca}. Confira.`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível analisar a foto";
      toast.error(message);
    } finally {
      setAnalisando(false);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <Label className="flex items-center gap-1">
          <Camera className="h-4 w-4" /> Foto do painel{photoRequired ? " *" : ""}
        </Label>
        <Button
          type="button"
          variant="outline"
          className="mt-1 w-full"
          disabled={analisando}
          onClick={capturarEAnalisar}
        >
          {analisando ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analisando painel...
            </>
          ) : (
            <>
              {photo ? <Sparkles className="mr-2 h-4 w-4" /> : <Camera className="mr-2 h-4 w-4" />}
              {photo ? "Tirar outra foto e analisar" : "Tirar foto e preencher com IA"}
            </>
          )}
        </Button>
      </div>

      {photo && !leitura && !analisando && (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          Foto capturada. Confira o valor abaixo antes de continuar.
        </p>
      )}

      {leitura && (
        <div
          className={`flex items-start gap-2 rounded-lg border p-2 text-xs ${
            leitura.confianca === "alta"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
              : "border-amber-500/30 bg-amber-500/10 text-amber-700"
          }`}
          aria-live="polite"
        >
          {leitura.confianca === "alta" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <div>
            <div className="font-medium">{CONFIANCA_LABEL[leitura.confianca]}</div>
            {leitura.textoObservado && <div>Lido no painel: {leitura.textoObservado}</div>}
            {leitura.motivo && <div>{leitura.motivo}</div>}
          </div>
        </div>
      )}

      <div>
        <Label>{label} *</Label>
        <Input
          type="number"
          inputMode="numeric"
          min={minKm ?? 0}
          step="1"
          value={value}
          onChange={(event) => {
            onValueChange(event.target.value);
            setLeitura(null);
            onReadingChange?.(null);
          }}
          placeholder="Preenchido pela IA ou informe manualmente"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Confirme os dígitos. A decisão final é sempre do motorista.
        </p>
      </div>
    </div>
  );
}
