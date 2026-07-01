import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

const businessError = (erro: string) => json({ ok: false, erro });

async function getProfile(admin: any, userId: string) {
  const { data, error } = await admin
    .from("profiles")
    .select("id, empresa_id, ativo")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.empresa_id) throw new Error("PERFIL_NAO_ENCONTRADO");
  if (data.ativo === false) throw new Error("PERFIL_INATIVO");
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ erro: "Método não permitido" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return json({ erro: "Não autenticado" }, 401);

    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: auth } } });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) return json({ erro: "Sessão inválida" }, 401);

    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const profile = await getProfile(admin, userData.user.id);

    const body = await req.json();
    const action = String(body?.action ?? "");

    if (action === "criar_venda") {
      const payload = body?.payload ?? {};
      const localId = String(body?.local_id ?? "");
      if (!localId) return businessError("ID_LOCAL_OBRIGATORIO");

      const [{ data: cliente }, { data: material }] = await Promise.all([
        admin.from("clientes").select("id").eq("id", payload.cliente_id).eq("empresa_id", profile.empresa_id).maybeSingle(),
        admin.from("materiais").select("id").eq("id", payload.material_id).eq("empresa_id", profile.empresa_id).maybeSingle(),
      ]);
      if (!cliente) return businessError("CLIENTE_INVALIDO");
      if (!material) return businessError("MATERIAL_INVALIDO");

      const formasValidas = ["dinheiro","pix","deposito","permuta","boleto","carteira"];
      const forma = String(payload.forma_pagamento ?? "").toLowerCase();
      if (!formasValidas.includes(forma)) return businessError("FORMA_PAGAMENTO_INVALIDA");
      const statusPag = ["boleto","permuta","carteira"].includes(forma) ? "pendente" : "a_confirmar";

      const row = {
        id: localId,
        empresa_id: profile.empresa_id,
        motorista_id: userData.user.id,
        motorista_venda_id: userData.user.id,
        motorista_entrega_id: null,
        veiculo_id: null,
        cliente_id: payload.cliente_id,
        material_id: payload.material_id,
        preco_base_no_momento: Number(payload.preco_base_no_momento ?? 0),
        valor_praticado: Number(payload.valor_praticado ?? 0),
        quantidade: Number(payload.quantidade ?? 1),
        valor_frete: Number(payload.valor_frete ?? 0),
        endereco: payload.endereco ?? null,
        lat: payload.lat ?? null,
        lng: payload.lng ?? null,
        observacoes: payload.observacoes ?? null,
        forma_pagamento: forma,
        status_pagamento: statusPag,
        status: "pendente",
      };
      const { error } = await admin.from("entregas").upsert(row, { onConflict: "id" });
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "iniciar_entrega") {
      const entregaId = String(body?.entrega_id ?? "");
      const veiculoId = String(body?.veiculo_id ?? "");
      const kmInicial = Number(body?.km_inicial ?? 0);
      if (!entregaId || !veiculoId) return businessError("DADOS_OBRIGATORIOS");

      const { data: veiculo } = await admin
        .from("veiculos")
        .select("id")
        .eq("id", veiculoId)
        .eq("empresa_id", profile.empresa_id)
        .eq("ativo", true)
        .maybeSingle();
      if (!veiculo) return businessError("VEICULO_INVALIDO");

      const { data: updated, error } = await admin
        .from("entregas")
        .update({
          status: "em_rota",
          motorista_entrega_id: userData.user.id,
          veiculo_id: veiculoId,
          km_inicial: kmInicial,
          iniciada_em: new Date().toISOString(),
        })
        .eq("id", entregaId)
        .eq("empresa_id", profile.empresa_id)
        .eq("status", "pendente")
        .is("motorista_entrega_id", null)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!updated) return businessError("ENTREGA_JA_INICIADA");
      return json({ ok: true });
    }

    if (action === "finalizar_entrega") {
      const entregaId = String(body?.entrega_id ?? "");
      if (!entregaId) return businessError("ENTREGA_OBRIGATORIA");

      const { data: updated, error } = await admin
        .from("entregas")
        .update({
          km_final: Number(body.km_final ?? 0),
          foto_odometro_final_url: body.foto_odometro_final_url ?? null,
          foto_material_url: body.foto_material_url ?? null,
          assinatura_url: body.assinatura_url ?? null,
          foto_material_gps_lat: body.foto_material_gps_lat ?? null,
          foto_material_gps_lng: body.foto_material_gps_lng ?? null,
          foto_material_gps_em: body.foto_material_gps_em ?? null,
          assinatura_coletada: Boolean(body.assinatura_coletada),
          status: "entregue",
          finalizada_em: new Date().toISOString(),
        })
        .eq("id", entregaId)
        .eq("empresa_id", profile.empresa_id)
        .eq("motorista_entrega_id", userData.user.id)
        .in("status", ["em_rota", "entregue"])
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!updated) return businessError("ENTREGA_NAO_ENCONTRADA");
      return json({ ok: true });
    }

    return businessError("Ação inválida");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ erro: msg }, 500);
  }
});