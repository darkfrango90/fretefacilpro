// Edge Function: criar-motorista
// Cria conta auth + profile + role 'motorista' na empresa do admin chamador.
// Requer SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY como secrets.
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ erro: "Método não permitido" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey =
    Deno.env.get("SUPABASE_ANON_KEY") ||
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) {
    return json({ erro: "Não autenticado" }, 401);
  }

  // Cliente como o usuário chamador (para descobrir quem é)
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: auth } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) {
    return json({ erro: "Sessão inválida" }, 401);
  }
  const adminUserId = userData.user.id;

  // Cliente admin (service role) — bypassa RLS
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Carrega empresa do admin a partir do profile + valida role admin
  const { data: adminProfile, error: profErr } = await admin
    .from("profiles")
    .select("empresa_id")
    .eq("id", adminUserId)
    .maybeSingle();
  if (profErr || !adminProfile) {
    return json({ erro: "Perfil do admin não encontrado" }, 403);
  }
  const empresaId: string = adminProfile.empresa_id;

  const { data: roles } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", adminUserId)
    .eq("empresa_id", empresaId);
  const ehAdmin = (roles ?? []).some((r: any) => r.role === "admin");
  if (!ehAdmin) {
    return json({ erro: "Apenas administradores podem criar motoristas" }, 403);
  }

  // Lê e valida payload
  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ erro: "JSON inválido" }, 400);
  }
  const nome = String(body?.nome ?? "").trim();
  const email = String(body?.email ?? "").trim().toLowerCase();
  const senha = String(body?.senha ?? "");
  const telefone = body?.telefone ? String(body.telefone).trim() : null;
  const precisaTrocar = body?.precisa_trocar_senha !== false; // default true

  if (!nome || nome.length < 2) return json({ erro: "Nome inválido" }, 400);
  if (!email || !email.includes("@")) return json({ erro: "E-mail inválido" }, 400);
  if (!senha || senha.length < 6)
    return json({ erro: "Senha deve ter ao menos 6 caracteres" }, 400);

  // Verifica assinatura da empresa
  const { data: empresaRow } = await admin
    .from("empresas")
    .select("ativa, data_vencimento, limite_usuarios")
    .eq("id", empresaId).single();
  if (!empresaRow?.ativa || (empresaRow.data_vencimento && empresaRow.data_vencimento < new Date().toISOString().slice(0, 10))) {
    return json({ erro: "Assinatura da empresa vencida ou inativa" }, 403);
  }
  // Verifica limite de usuários
  const { count } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("empresa_id", empresaId)
    .eq("ativo", true);
  if ((count ?? 0) >= (empresaRow.limite_usuarios ?? 5)) {
    return json({ erro: "Limite de usuários da empresa atingido" }, 403);
  }


  // Cria usuário no Auth (já confirmado para login imediato)
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { nome, empresa_id: empresaId },
  });
  if (cErr || !created.user) {
    return json({ erro: cErr?.message ?? "Falha ao criar usuário" }, 400);
  }
  const novoUserId = created.user.id;

  // O trigger handle_new_user pode ter criado profile + empresa órfã + role.
  // Detecta empresa órfã criada pelo trigger para limpar depois.
  const { data: profileTrigger } = await admin
    .from("profiles")
    .select("empresa_id")
    .eq("id", novoUserId)
    .maybeSingle();
  const empresaOrfa =
    profileTrigger?.empresa_id && profileTrigger.empresa_id !== empresaId
      ? profileTrigger.empresa_id
      : null;

  // Upsert do profile vinculando-o à empresa correta do admin
  const { error: pErr } = await admin.from("profiles").upsert({
    id: novoUserId,
    empresa_id: empresaId,
    nome,
    telefone,
    email,
    ativo: true,
    precisa_trocar_senha: precisaTrocar,
  });
  if (pErr) {
    await admin.auth.admin.deleteUser(novoUserId);
    return json({ erro: "Falha ao criar perfil: " + pErr.message }, 500);
  }

  // Remove quaisquer roles criados automaticamente pelo trigger
  await admin.from("user_roles").delete().eq("user_id", novoUserId);

  // Atribui papel motorista na empresa correta
  const { error: rErr } = await admin.from("user_roles").insert({
    user_id: novoUserId,
    empresa_id: empresaId,
    role: "motorista",
  });
  if (rErr) {
    await admin.from("profiles").delete().eq("id", novoUserId);
    await admin.auth.admin.deleteUser(novoUserId);
    return json({ erro: "Falha ao atribuir papel: " + rErr.message }, 500);
  }

  // Limpa empresa órfã criada pelo trigger, se existir e estiver vazia
  if (empresaOrfa) {
    await admin.from("empresas").delete().eq("id", empresaOrfa);
  }

  return json({ ok: true, user_id: novoUserId, email });
});
