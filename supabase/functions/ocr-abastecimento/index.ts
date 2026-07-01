// Edge Function: ocr-abastecimento
// Recebe imagem (base64) de cupom de combustível e extrai litros / valor_total / valor_litro
// via Gemini (gemini-3.5-flash) com structured output e thinking desabilitado.
// Requer GEMINI_API_KEY configurada como secret no Supabase.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    litros: { type: "NUMBER", nullable: true },
    valor_total: { type: "NUMBER", nullable: true },
    valor_litro: { type: "NUMBER", nullable: true },
  },
  required: ["litros", "valor_total", "valor_litro"],
};

const PROMPT =
  "Você recebe a foto de um cupom fiscal de posto de combustível. " +
  "Extraia APENAS três informações numéricas: " +
  "1) quantidade de litros abastecidos (campo 'litros'), " +
  "2) valor total pago em reais (campo 'valor_total'), " +
  "3) preço por litro em reais, se visível (campo 'valor_litro'). " +
  "Use ponto como separador decimal. Se algum campo não for legível, retorne null naquele campo. " +
  "Responda apenas com o JSON no formato definido.";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ erro: "Método não permitido" }, 405);

  const supaUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey =
    Deno.env.get("SUPABASE_ANON_KEY") ||
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
  const geminiKey = Deno.env.get("GEMINI_API_KEY");

  if (!geminiKey) {
    return json({ erro: "Servidor sem GEMINI_API_KEY configurada" }, 500);
  }

  // Auth: exige chamador autenticado
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) {
    return json({ erro: "Não autenticado" }, 401);
  }
  const userClient = createClient(supaUrl, anonKey, {
    global: { headers: { Authorization: auth } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) {
    return json({ erro: "Sessão inválida" }, 401);
  }

  // Payload
  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ erro: "JSON inválido" }, 400);
  }
  const imagemBase64: string | undefined = body?.imagem_base64;
  const mimeType: string = body?.mime_type || "image/jpeg";
  if (!imagemBase64 || typeof imagemBase64 !== "string") {
    return json({ erro: "Campo imagem_base64 obrigatório" }, 400);
  }
  // remove prefixo data: se vier
  const cleanB64 = imagemBase64.includes(",")
    ? imagemBase64.split(",").pop()!
    : imagemBase64;

  // Chamada ao Gemini
  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;

  const geminiBody = {
    contents: [
      {
        role: "user",
        parts: [
          { text: PROMPT },
          { inline_data: { mime_type: mimeType, data: cleanB64 } },
        ],
      },
    ],
    generationConfig: {
      response_mime_type: "application/json",
      response_schema: RESPONSE_SCHEMA,
      thinkingConfig: { thinkingBudget: 0 },
      temperature: 0,
    },
  };

  let gRes: Response;
  try {
    gRes = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiBody),
    });
  } catch (e) {
    return json({ erro: "Falha ao contatar Gemini", detalhe: String(e) }, 502);
  }

  if (!gRes.ok) {
    const txt = await gRes.text();
    return json(
      { erro: "Gemini retornou erro", status: gRes.status, detalhe: txt },
      502,
    );
  }

  const gJson: any = await gRes.json().catch(() => null);
  const texto: string | undefined =
    gJson?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!texto) {
    return json({ erro: "Resposta vazia da IA" }, 502);
  }

  // Parse seguro: tenta JSON puro, depois extrai bloco {...}
  let parsed: any = null;
  try {
    parsed = JSON.parse(texto);
  } catch {
    const m = texto.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        parsed = JSON.parse(m[0]);
      } catch { /* ignore */ }
    }
  }
  if (!parsed || typeof parsed !== "object") {
    return json({ erro: "JSON inválido na resposta da IA", raw: texto }, 502);
  }

  const toNum = (v: any) =>
    v === null || v === undefined || v === "" ? null : Number(v);
  const litros = toNum(parsed.litros);
  const valor_total = toNum(parsed.valor_total);
  const valor_litro = toNum(parsed.valor_litro);

  return json({
    ok: true,
    litros: Number.isFinite(litros) ? litros : null,
    valor_total: Number.isFinite(valor_total) ? valor_total : null,
    valor_litro: Number.isFinite(valor_litro) ? valor_litro : null,
  });
});
