// Edge Function: ocr-odometro
// Recebe a foto de um painel e extrai apenas a quilometragem total do veículo.
// Requer GEMINI_API_KEY configurada como secret no Supabase.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_BASE64_LENGTH = 12_000_000;
const MIME_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    km_total: { type: "INTEGER", nullable: true },
    confianca: { type: "STRING", enum: ["alta", "media", "baixa"] },
    tipo_painel: {
      type: "STRING",
      enum: ["digital_central", "digital_inferior", "mecanico", "indeterminado"],
    },
    texto_observado: { type: "STRING", nullable: true },
    motivo: { type: "STRING", nullable: true },
  },
  required: ["km_total", "confianca", "tipo_painel", "texto_observado", "motivo"],
};

const PROMPT = `Analise a foto do painel de um caminhão e leia SOMENTE o odômetro total acumulado em quilômetros.

Os painéis esperados podem ter quatro formatos:
1. display LCD central com ODO/odômetro, zeros à esquerda e possível casa decimal;
2. display digital escuro na parte inferior/central, próximo de mensagens do veículo;
3. mostrador digital vermelho inferior identificado por "km";
4. odômetro mecânico de roletes, com vários algarismos alinhados.

Regras obrigatórias:
- ignore velocímetro, conta-giros/RPM, relógio, data, temperatura, combustível e pressão;
- ignore hodômetro parcial/trip, geralmente menor e podendo aparecer como 0.0;
- preserve todos os algarismos significativos, inclusive quando houver zeros à esquerda;
- se houver uma casa decimal, descarte apenas a parte decimal e retorne quilômetros inteiros;
- não invente algarismos cobertos, cortados, refletidos ou ilegíveis;
- se não for possível identificar com segurança o odômetro TOTAL, retorne km_total null;
- confiança "alta" exige todos os dígitos claramente legíveis; "media" admite leve reflexo; "baixa" indica ambiguidade e exige nova foto.

Em texto_observado, reproduza apenas a sequência vista no odômetro. Responda somente no JSON definido.`;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function normalizarMimeType(value: unknown) {
  const mime = String(value || "image/jpeg").toLowerCase();
  return mime === "image/jpg" ? "image/jpeg" : mime;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ erro: "Método não permitido" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  const geminiModel = Deno.env.get("GEMINI_MODEL") || "gemini-2.5-flash";

  if (!geminiKey) return json({ erro: "Servidor sem GEMINI_API_KEY configurada" }, 500);

  const authorization = req.headers.get("Authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return json({ erro: "Não autenticado" }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ erro: "Sessão inválida" }, 401);

  const body = await req.json().catch(() => null);
  const imagemBase64 = body?.imagem_base64;
  const mimeType = normalizarMimeType(body?.mime_type);
  if (typeof imagemBase64 !== "string" || !imagemBase64) {
    return json({ erro: "Campo imagem_base64 obrigatório" }, 400);
  }
  if (imagemBase64.length > MAX_BASE64_LENGTH) {
    return json({ erro: "Imagem muito grande. Tire outra foto mais próxima do painel." }, 413);
  }
  if (!MIME_TYPES.has(mimeType)) {
    return json({ erro: "Formato de imagem não suportado. Use JPG, PNG ou WEBP." }, 415);
  }

  const cleanBase64 = imagemBase64.includes(",")
    ? imagemBase64.slice(imagemBase64.indexOf(",") + 1)
    : imagemBase64;
  if (!/^[A-Za-z0-9+/=\r\n]+$/.test(cleanBase64)) {
    return json({ erro: "Imagem base64 inválida" }, 400);
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent?key=${geminiKey}`;
  const geminiBody = {
    contents: [
      {
        role: "user",
        parts: [{ text: PROMPT }, { inline_data: { mime_type: mimeType, data: cleanBase64 } }],
      },
    ],
    generationConfig: {
      response_mime_type: "application/json",
      response_schema: RESPONSE_SCHEMA,
      thinkingConfig: { thinkingBudget: 0 },
      temperature: 0,
    },
  };

  let geminiResponse: Response;
  try {
    geminiResponse = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiBody),
    });
  } catch (error) {
    console.error("ocr-odometro: falha de rede", error);
    return json({ erro: "Não foi possível analisar a foto agora" }, 502);
  }

  if (!geminiResponse.ok) {
    console.error("ocr-odometro: Gemini", geminiResponse.status, await geminiResponse.text());
    return json({ erro: "A IA não conseguiu processar a foto" }, 502);
  }

  const geminiJson = await geminiResponse.json().catch(() => null);
  const texto = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof texto !== "string") return json({ erro: "Resposta vazia da IA" }, 502);

  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(texto);
  } catch {
    const match = texto.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        parsed = JSON.parse(match[0]);
      } catch {
        parsed = null;
      }
    }
  }
  if (!parsed) return json({ erro: "Resposta inválida da IA" }, 502);

  const numero = parsed.km_total == null ? null : Number(parsed.km_total);
  const kmTotal =
    typeof numero === "number" && Number.isInteger(numero) && numero >= 0 && numero <= 99_999_999
      ? numero
      : null;
  const confianca = ["alta", "media", "baixa"].includes(String(parsed.confianca))
    ? String(parsed.confianca)
    : "baixa";
  const tipos = ["digital_central", "digital_inferior", "mecanico", "indeterminado"];
  const tipoPainel = tipos.includes(String(parsed.tipo_painel))
    ? String(parsed.tipo_painel)
    : "indeterminado";

  return json({
    ok: true,
    km_total: kmTotal,
    confianca,
    tipo_painel: tipoPainel,
    texto_observado: parsed.texto_observado == null ? null : String(parsed.texto_observado),
    motivo: parsed.motivo == null ? null : String(parsed.motivo),
    requer_confirmacao: true,
  });
});
