// Edge function destrutiva: apaga TUDO exceto o(s) usuário(s) master.
// Mantém: usuários com role 'master', seus profiles, sua empresa (se houver) e role.
// Apaga: entregas, jornadas, abastecimentos, aferições, clientes, materiais,
//        veículos, permissões, profiles não-master, user_roles não-master,
//        empresas não-master, usuários auth não-master, sequência de vendas.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // Confirma chamada autorizada por um master logado
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) {
    return new Response(JSON.stringify({ ok: false, erro: "sem token" }), {
      status: 401, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ ok: false, erro: "token inválido" }), {
      status: 401, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  const { data: isMasterRow } = await admin
    .from("user_roles").select("id")
    .eq("user_id", userData.user.id).eq("role", "master").maybeSingle();
  if (!isMasterRow) {
    return new Response(JSON.stringify({ ok: false, erro: "apenas master" }), {
      status: 403, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // Coleta IDs do(s) master(s) e suas empresas
  const { data: masters } = await admin
    .from("user_roles").select("user_id, empresa_id").eq("role", "master");
  const masterIds = (masters ?? []).map((m) => m.user_id);
  const { data: masterProfiles } = await admin
    .from("profiles").select("id, empresa_id").in("id", masterIds.length ? masterIds : ["00000000-0000-0000-0000-000000000000"]);
  const empresasManter = new Set<string>();
  for (const m of masters ?? []) if (m.empresa_id) empresasManter.add(m.empresa_id);
  for (const p of masterProfiles ?? []) if (p.empresa_id) empresasManter.add(p.empresa_id);
  const empresasArr = Array.from(empresasManter);

  const log: Record<string, unknown> = {};

  // Apaga dados operacionais (de TODAS as empresas, inclusive do master)
  for (const tabela of ["entregas", "jornadas", "abastecimentos", "afericoes_tanque", "auditoria", "clientes", "materiais", "veiculos", "permissoes_motorista", "permissoes_padrao", "empresa_venda_seq"]) {
    const { error, count } = await admin.from(tabela).delete({ count: "exact" }).not("id", "is", null);
    log[tabela] = error ? `erro: ${error.message}` : `${count ?? 0} removidos`;
  }

  // Apaga profiles e user_roles não-master
  {
    const q = admin.from("profiles").delete({ count: "exact" });
    const { error, count } = masterIds.length
      ? await q.not("id", "in", `(${masterIds.join(",")})`)
      : await q.not("id", "is", null);
    log["profiles"] = error ? `erro: ${error.message}` : `${count ?? 0} removidos`;
  }
  {
    const q = admin.from("user_roles").delete({ count: "exact" }).neq("role", "master");
    const { error, count } = await q;
    log["user_roles"] = error ? `erro: ${error.message}` : `${count ?? 0} removidos`;
  }

  // Apaga empresas (mantém as do master, se houver)
  {
    const q = admin.from("empresas").delete({ count: "exact" });
    const { error, count } = empresasArr.length
      ? await q.not("id", "in", `(${empresasArr.join(",")})`)
      : await q.not("id", "is", null);
    log["empresas"] = error ? `erro: ${error.message}` : `${count ?? 0} removidas`;
  }

  // Apaga usuários auth não-master
  const { data: allUsers } = await admin.auth.admin.listUsers({ perPage: 1000 });
  let authRemovidos = 0;
  for (const u of allUsers?.users ?? []) {
    if (masterIds.includes(u.id)) continue;
    const { error } = await admin.auth.admin.deleteUser(u.id);
    if (!error) authRemovidos++;
  }
  log["auth_users"] = `${authRemovidos} removidos`;

  // Limpa storage
  for (const bucket of ["odometros", "abastecimentos", "entregas", "assinaturas"]) {
    try {
      const { data: files } = await admin.storage.from(bucket).list("", { limit: 1000 });
      const paths = (files ?? []).map((f) => f.name);
      if (paths.length) await admin.storage.from(bucket).remove(paths);
      log[`storage_${bucket}`] = `${paths.length} removidos`;
    } catch (e) {
      log[`storage_${bucket}`] = `erro: ${(e as Error).message}`;
    }
  }

  return new Response(JSON.stringify({ ok: true, log }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
