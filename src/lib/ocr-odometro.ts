import { supabase } from "@/integrations/supabase/client";

const MAX_IMAGE_BYTES = 9_000_000;

export type ConfiancaOdometro = "alta" | "media" | "baixa";

export type LeituraOdometro = {
  km: number | null;
  confianca: ConfiancaOdometro;
  tipoPainel: "digital_central" | "digital_inferior" | "mecanico" | "indeterminado";
  textoObservado: string | null;
  motivo: string | null;
};

function arquivoParaDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Não foi possível ler a foto"));
    reader.readAsDataURL(file);
  });
}

export async function analisarFotoOdometro(file: File): Promise<LeituraOdometro> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    throw new Error("A leitura por IA precisa de internet. Informe o KM manualmente.");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("Foto muito grande. Aproxime o painel e tire outra foto.");
  }

  const imagemBase64 = await arquivoParaDataUrl(file);
  const { data, error } = await supabase.functions.invoke("ocr-odometro", {
    body: {
      imagem_base64: imagemBase64,
      mime_type: file.type || "image/jpeg",
    },
  });
  if (error) throw new Error(error.message || "Falha ao analisar o painel");
  if (data?.erro) throw new Error(String(data.erro));

  const km = data?.km_total == null ? null : Number(data.km_total);
  return {
    km: typeof km === "number" && Number.isInteger(km) && km >= 0 ? km : null,
    confianca: ["alta", "media", "baixa"].includes(data?.confianca) ? data.confianca : "baixa",
    tipoPainel: ["digital_central", "digital_inferior", "mecanico"].includes(data?.tipo_painel)
      ? data.tipo_painel
      : "indeterminado",
    textoObservado: data?.texto_observado ? String(data.texto_observado) : null,
    motivo: data?.motivo ? String(data.motivo) : null,
  };
}
