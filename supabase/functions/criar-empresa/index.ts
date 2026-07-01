// Edge Function: criar-empresa
// Master cria empresa + admin inicial.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ erro: "Método não permitido" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return json({ erro: "Não autenticado" }, 401);

  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: auth } } });
  const { data: userData } = await userClient.auth.getUser();
  if (!userData?.user) return json({ erro: "Sessão inválida" }, 401);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  // Verifica role master
  const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userData.user.id);
  if (!(roles ?? []).some((r: any) => r.role === "master"))
    return json({ erro: "Apenas o master pode criar empresas" }, 403);

  let body: any;
  try { body = await req.json(); } catch { return json({ erro: "JSON inválido" }, 400); }

  const nome = String(body?.nome ?? "").trim();
  const data_vencimento = String(body?.data_vencimento ?? "").trim();
  const limite_usuarios = Number(body?.limite_usuarios ?? 5);
  const plano = body?.plano ? String(body.plano) : null;
  const admin_nome = String(body?.admin_nome ?? "").trim();
  const admin_email = String(body?.admin_email ?? "").trim().toLowerCase();
  const admin_senha = String(body?.admin_senha ?? "");

  if (!nome || !data_vencimento || !admin_nome || !admin_email || admin_senha.length < 6)
    return json({ erro: "Campos obrigatórios faltando" }, 400);

  // Cria empresa
  const { data: emp, error: eErr } = await admin
    .from("empresas")
    .insert({ nome, data_vencimento, limite_usuarios, plano, ativa: true })
    .select("id").single();
  if (eErr || !emp) return json({ erro: "Falha ao criar empresa: " + (eErr?.message ?? "") }, 500);

  // Cria usuário admin
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email: admin_email,
    password: admin_senha,
    email_confirm: true,
    user_metadata: { nome: admin_nome, empresa_id: emp.id },
  });
  if (cErr || !created.user) {
    await admin.from("empresas").delete().eq("id", emp.id);
    return json({ erro: cErr?.message ?? "Falha ao criar admin" }, 400);
  }
  const uid = created.user.id;

  // O trigger handle_new_user pode ter criado uma empresa/profile/role automaticamente.
  // Identifica essa empresa auto-criada para apagar depois.
  const { data: autoProfile } = await admin
    .from("profiles").select("empresa_id").eq("id", uid).maybeSingle();
  const autoEmpresaId: string | null = autoProfile?.empresa_id && autoProfile.empresa_id !== emp.id
    ? autoProfile.empresa_id : null;

  const { error: pErr } = await admin.from("profiles").upsert({
    id: uid, empresa_id: emp.id, nome: admin_nome, email: admin_email, ativo: true, precisa_trocar_senha: true,
  }, { onConflict: "id" });
  if (pErr) {
    await admin.auth.admin.deleteUser(uid);
    await admin.from("empresas").delete().eq("id", emp.id);
    return json({ erro: "Falha ao criar perfil: " + pErr.message }, 500);
  }

  // Remove qualquer role pré-existente do trigger e atribui admin na empresa correta
  await admin.from("user_roles").delete().eq("user_id", uid);
  const { error: rErr } = await admin.from("user_roles").insert({ user_id: uid, empresa_id: emp.id, role: "admin" });
  if (rErr) {
    await admin.from("profiles").delete().eq("id", uid);
    await admin.auth.admin.deleteUser(uid);
    await admin.from("empresas").delete().eq("id", emp.id);
    return json({ erro: "Falha ao atribuir papel: " + rErr.message }, 500);
  }

  // Limpa empresa órfã criada pelo trigger
  if (autoEmpresaId) {
    await admin.from("empresas").delete().eq("id", autoEmpresaId);
  }

  return json({ ok: true, empresa_id: emp.id, admin_user_id: uid });
});
