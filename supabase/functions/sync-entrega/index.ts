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

async function podeGerenciarEntrega(
  admin: any,
  userId: string,
  empresaId: string,
  opts: { checarPermissaoCancelar?: boolean },
): Promise<boolean> {
  const { data: roles } = await admin
    .from("user_roles")
    .select("role, empresa_id")
    .eq("user_id", userId);
  const isMaster = (roles ?? []).some((r: any) => r.role === "master");
  const isAdmin = (roles ?? []).some((r: any) => r.role === "admin" && r.empresa_id === empresaId);
  if (isMaster || isAdmin) return true;
  if (!opts.checarPermissaoCancelar) return false;

  const { data: perms } = await admin.rpc("get_permissoes_efetivas", { _motorista_id: userId });
  return perms?.pode_cancelar_entrega === true;
}

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

function numeroValido(value: unknown, minimo = 0): value is number {
  const numero = Number(value);
  return Number.isFinite(numero) && numero >= minimo;
}

function caminhoDoUsuario(path: unknown, empresaId: string, userId: string): boolean {
  if (path == null || path === "") return true;
  return String(path).startsWith(`${empresaId}/${userId}/`);
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

    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const profile = await getProfile(admin, userData.user.id);

    const body = await req.json();
    const action = String(body?.action ?? "");

    if (action === "criar_venda") {
      const payload = body?.payload ?? {};
      const localId = String(body?.local_id ?? "");
      if (!localId) return businessError("ID_LOCAL_OBRIGATORIO");

      const itensRecebidos =
        Array.isArray(payload.itens) && payload.itens.length > 0
          ? payload.itens
          : [
              {
                material_id: payload.material_id,
                preco_base: payload.preco_base_no_momento,
                valor_praticado: payload.valor_praticado,
                quantidade: payload.quantidade,
              },
            ];
      if (itensRecebidos.length < 1 || itensRecebidos.length > 3) {
        return businessError("QUANTIDADE_MATERIAIS_INVALIDA");
      }
      const materialIds = itensRecebidos.map((item: any) => String(item?.material_id ?? ""));
      if (
        materialIds.some((id: string) => !id) ||
        new Set(materialIds).size !== materialIds.length
      ) {
        return businessError("MATERIAIS_INVALIDOS");
      }

      const [{ data: cliente }, { data: materiaisEncontrados }] = await Promise.all([
        admin
          .from("clientes")
          .select("id, cpf_cnpj, telefone")
          .eq("id", payload.cliente_id)
          .eq("empresa_id", profile.empresa_id)
          .maybeSingle(),
        admin
          .from("materiais")
          .select("id, nome, preco_base, unidade")
          .in("id", materialIds)
          .eq("empresa_id", profile.empresa_id)
          .eq("ativo", true),
      ]);
      if (!cliente) return businessError("CLIENTE_INVALIDO");
      if ((materiaisEncontrados ?? []).length !== materialIds.length) {
        return businessError("MATERIAL_INVALIDO");
      }

      const isAdminOuMaster = await podeGerenciarEntrega(
        admin,
        userData.user.id,
        profile.empresa_id,
        {},
      );
      const { data: perms } = isAdminOuMaster
        ? { data: null }
        : await admin.rpc("get_permissoes_efetivas", { _motorista_id: userData.user.id });

      const materialPorId = new Map(
        (materiaisEncontrados ?? []).map((material: any) => [material.id, material]),
      );
      const itens = itensRecebidos.map((item: any) => {
        const material: any = materialPorId.get(String(item.material_id));
        const itemFrete =
          String(material?.nome ?? "")
            .trim()
            .toLocaleUpperCase("pt-BR") === "FRETE";
        return {
          material_id: material.id,
          nome: material.nome,
          unidade: material.unidade ?? null,
          preco_base: itemFrete ? 0 : Number(material.preco_base ?? 0),
          valor_praticado: itemFrete ? 0 : Number(item.valor_praticado),
          quantidade: itemFrete ? 1 : Number(item.quantidade ?? 1),
          item_frete: itemFrete,
        };
      });
      const somenteFrete = itens.length === 1 && itens[0].item_frete;
      if (itens.some((item: any) => item.item_frete) && !somenteFrete) {
        return businessError("FRETE_DEVE_SER_UNICO");
      }
      const valorFrete = Number(payload.valor_frete ?? 0);
      const observacoes = String(payload.observacoes ?? "").trim();
      if (
        itens.some(
          (item: any) =>
            !numeroValido(item.valor_praticado) || !numeroValido(item.quantidade, Number.EPSILON),
        ) ||
        !numeroValido(valorFrete)
      ) {
        return businessError("VALORES_INVALIDOS");
      }
      if (somenteFrete && valorFrete <= 0) {
        return businessError("FRETE_OBRIGATORIO");
      }
      if (perms) {
        if (perms.cpf_cnpj_obrigatorio === true && !cliente.cpf_cnpj) {
          return businessError("PERMISSAO_NEGADA: CPF/CNPJ do cliente é obrigatório");
        }
        if (perms.telefone_obrigatorio === true && !cliente.telefone) {
          return businessError("PERMISSAO_NEGADA: telefone do cliente é obrigatório");
        }
        for (const item of itens) {
          if (item.item_frete) continue;
          if (
            perms.pode_alterar_valor_produto === false &&
            item.valor_praticado !== item.preco_base
          ) {
            return businessError("PERMISSAO_NEGADA: motorista não pode alterar o valor do produto");
          }
          if (item.preco_base > 0 && item.valor_praticado < item.preco_base) {
            const desconto = ((item.preco_base - item.valor_praticado) / item.preco_base) * 100;
            if (desconto > Number(perms.desconto_maximo_percent ?? 0)) {
              return businessError("PERMISSAO_NEGADA: desconto acima do permitido");
            }
          }
        }
        if (perms.pode_alterar_frete === false && valorFrete > 0) {
          return businessError("PERMISSAO_NEGADA: motorista não pode alterar o frete");
        }
        if (perms.frete_maximo != null && valorFrete > Number(perms.frete_maximo)) {
          return businessError("PERMISSAO_NEGADA: frete acima do máximo permitido");
        }
        if (
          Array.isArray(perms.materiais_permitidos) &&
          perms.materiais_permitidos.length > 0 &&
          itens.some((item: any) => !perms.materiais_permitidos.includes(item.material_id))
        ) {
          return businessError("PERMISSAO_NEGADA: material não permitido");
        }
        const totalVenda =
          itens.reduce(
            (total: number, item: any) => total + item.valor_praticado * item.quantidade,
            0,
          ) + valorFrete;
        if (perms.valor_venda_minimo != null && totalVenda < Number(perms.valor_venda_minimo)) {
          return businessError("PERMISSAO_NEGADA: venda abaixo do mínimo permitido");
        }
        if (perms.valor_venda_maximo != null && totalVenda > Number(perms.valor_venda_maximo)) {
          return businessError("PERMISSAO_NEGADA: venda acima do máximo permitido");
        }
        if (perms.observacao_obrigatoria === true && !observacoes) {
          return businessError("PERMISSAO_NEGADA: observação obrigatória");
        }
      }

      const formasValidas = [
        "dinheiro",
        "pix",
        "deposito",
        "cartao_credito",
        "permuta",
        "boleto",
        "carteira",
      ];
      const forma = String(payload.forma_pagamento ?? "").toLowerCase();
      if (!formasValidas.includes(forma)) return businessError("FORMA_PAGAMENTO_INVALIDA");
      const statusPag = ["boleto", "permuta", "carteira"].includes(forma)
        ? "pendente"
        : "a_confirmar";

      const itensPersistidos = itens.map((item: any) => ({
        material_id: item.material_id,
        nome: item.nome,
        unidade: item.unidade,
        preco_base: item.preco_base,
        valor_praticado: item.valor_praticado,
        quantidade: item.quantidade,
      }));
      const primeiroItem = itensPersistidos[0];
      const totalMateriais = itensPersistidos.reduce(
        (total: number, item: any) => total + item.valor_praticado * item.quantidade,
        0,
      );
      const row = {
        id: localId,
        empresa_id: profile.empresa_id,
        motorista_id: userData.user.id,
        motorista_venda_id: userData.user.id,
        motorista_entrega_id: null,
        veiculo_id: null,
        cliente_id: payload.cliente_id,
        material_id: primeiroItem.material_id,
        preco_base_no_momento:
          itensPersistidos.length === 1
            ? primeiroItem.preco_base
            : itensPersistidos.reduce(
                (total: number, item: any) => total + item.preco_base * item.quantidade,
                0,
              ),
        valor_praticado:
          itensPersistidos.length === 1 ? primeiroItem.valor_praticado : totalMateriais,
        quantidade: itensPersistidos.length === 1 ? primeiroItem.quantidade : 1,
        itens: itensPersistidos,
        valor_frete: valorFrete,
        endereco: payload.endereco ?? null,
        lat: payload.lat ?? null,
        lng: payload.lng ?? null,
        observacoes: observacoes || null,
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
      if (!numeroValido(kmInicial) || !Number.isInteger(kmInicial)) {
        return businessError("KM_INICIAL_INVALIDO");
      }
      if (!body.foto_odometro_inicial_url) {
        return businessError("FOTO_ODOMETRO_INICIAL_OBRIGATORIA");
      }
      if (!caminhoDoUsuario(body.foto_odometro_inicial_url, profile.empresa_id, userData.user.id)) {
        return businessError("CAMINHO_ARQUIVO_INVALIDO");
      }
      const confiancaInicial = ["alta", "media", "baixa"].includes(
        String(body.km_inicial_ia_confianca),
      )
        ? String(body.km_inicial_ia_confianca)
        : null;

      const { data: veiculo } = await admin
        .from("veiculos")
        .select("id")
        .eq("id", veiculoId)
        .eq("empresa_id", profile.empresa_id)
        .eq("ativo", true)
        .maybeSingle();
      if (!veiculo) return businessError("VEICULO_INVALIDO");

      const isAdminOuMaster = await podeGerenciarEntrega(
        admin,
        userData.user.id,
        profile.empresa_id,
        {},
      );

      let query = admin
        .from("entregas")
        .update({
          status: "em_rota",
          motorista_entrega_id: userData.user.id,
          veiculo_id: veiculoId,
          km_inicial: kmInicial,
          foto_odometro_inicial_url: body.foto_odometro_inicial_url,
          km_inicial_ia_confianca: confiancaInicial,
          iniciada_em: new Date().toISOString(),
        })
        .eq("id", entregaId)
        .eq("empresa_id", profile.empresa_id)
        .eq("status", "pendente")
        .is("motorista_entrega_id", null);
      if (!isAdminOuMaster) {
        query = query.or(
          `motorista_venda_id.eq.${userData.user.id},and(motorista_venda_id.is.null,motorista_id.eq.${userData.user.id})`,
        );
      }
      const { data: updated, error } = await query.select("id").maybeSingle();
      if (error) throw error;
      if (!updated) return businessError("ENTREGA_JA_INICIADA");
      return json({ ok: true });
    }

    if (action === "cancelar_entrega") {
      const entregaId = String(body?.entrega_id ?? "");
      if (!entregaId) return businessError("ENTREGA_OBRIGATORIA");

      // Admin/master pode cancelar pendentes e entregues; motorista com
      // pode_cancelar_entrega, apenas pendentes.
      const isAdminOuMaster = await podeGerenciarEntrega(
        admin,
        userData.user.id,
        profile.empresa_id,
        {},
      );
      let statusPermitidos: string[];
      if (isAdminOuMaster) {
        statusPermitidos = ["pendente", "em_rota", "entregue"];
      } else {
        const podeCancelar = await podeGerenciarEntrega(
          admin,
          userData.user.id,
          profile.empresa_id,
          {
            checarPermissaoCancelar: true,
          },
        );
        if (!podeCancelar) return businessError("SEM_PERMISSAO");
        statusPermitidos = ["pendente"];
      }

      const { data: updated, error } = await admin
        .from("entregas")
        .update({ status: "cancelada" })
        .eq("id", entregaId)
        .eq("empresa_id", profile.empresa_id)
        .in("status", statusPermitidos)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!updated) return businessError("ENTREGA_NAO_ENCONTRADA");
      return json({ ok: true });
    }

    if (action === "finalizar_entrega_admin") {
      const entregaId = String(body?.entrega_id ?? "");
      if (!entregaId) return businessError("ENTREGA_OBRIGATORIA");

      const isAdminOuMaster = await podeGerenciarEntrega(
        admin,
        userData.user.id,
        profile.empresa_id,
        {},
      );
      if (!isAdminOuMaster) return businessError("SEM_PERMISSAO");

      const { data: entregaAtual, error: buscaError } = await admin
        .from("entregas")
        .select("id, status, observacoes, motorista_id, motorista_venda_id, motorista_entrega_id")
        .eq("id", entregaId)
        .eq("empresa_id", profile.empresa_id)
        .in("status", ["pendente", "em_rota"])
        .maybeSingle();
      if (buscaError) throw buscaError;
      if (!entregaAtual) return businessError("ENTREGA_NAO_ENCONTRADA");

      const observacaoAdmin = "Venda concluída pelo administrador";
      const observacoesAnteriores = String(entregaAtual.observacoes ?? "").trim();
      const observacoes = observacoesAnteriores
        ? `${observacoesAnteriores}\n${observacaoAdmin}`
        : observacaoAdmin;
      const motoristaResponsavel =
        entregaAtual.motorista_entrega_id ??
        entregaAtual.motorista_venda_id ??
        entregaAtual.motorista_id;

      // Usa o client autenticado para que RLS e o bypass administrativo do
      // trigger de validação sejam avaliados com o usuário que fez a ação.
      const { data: updated, error } = await userClient
        .from("entregas")
        .update({
          status: "entregue",
          finalizada_em: new Date().toISOString(),
          observacoes,
          motorista_entrega_id: motoristaResponsavel,
        })
        .eq("id", entregaId)
        .eq("empresa_id", profile.empresa_id)
        .in("status", ["pendente", "em_rota"])
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!updated) return businessError("ENTREGA_NAO_ENCONTRADA");
      return json({ ok: true });
    }

    if (action === "editar_entrega") {
      const entregaId = String(body?.entrega_id ?? "");
      if (!entregaId) return businessError("ENTREGA_OBRIGATORIA");

      const isAdminOuMaster = await podeGerenciarEntrega(
        admin,
        userData.user.id,
        profile.empresa_id,
        {},
      );

      const { data: entregaAtual, error: buscaError } = await admin
        .from("entregas")
        .select("id, itens, material_id, quantidade, valor_praticado, preco_base_no_momento")
        .eq("id", entregaId)
        .eq("empresa_id", profile.empresa_id)
        .maybeSingle();
      if (buscaError) throw buscaError;
      if (!entregaAtual) return businessError("ENTREGA_NAO_ENCONTRADA");

      const itensAtuais = Array.isArray(entregaAtual.itens) ? entregaAtual.itens : [];
      const alterandoMaterial = body.quantidade != null || body.valor_praticado != null;
      if (alterandoMaterial && itensAtuais.length > 1) {
        return businessError("EDICAO_MULTIPLOS_MATERIAIS_RESTRITA");
      }

      const patch: Record<string, unknown> = {};
      if (body.quantidade != null) {
        const q = Number(body.quantidade);
        if (!Number.isFinite(q) || q <= 0) return businessError("QUANTIDADE_INVALIDA");
        patch.quantidade = q;
      }
      if (body.valor_praticado != null) {
        const v = Number(body.valor_praticado);
        if (!Number.isFinite(v) || v < 0) return businessError("VALOR_INVALIDO");
        patch.valor_praticado = v;
      }
      if (body.valor_frete != null) {
        const v = Number(body.valor_frete);
        if (!Number.isFinite(v) || v < 0) return businessError("FRETE_INVALIDO");
        patch.valor_frete = v;
      }
      if (body.endereco !== undefined) patch.endereco = String(body.endereco ?? "").trim() || null;
      if (body.observacoes !== undefined)
        patch.observacoes = String(body.observacoes ?? "").trim() || null;
      if (alterandoMaterial && itensAtuais.length === 1) {
        patch.itens = [
          {
            ...itensAtuais[0],
            quantidade:
              patch.quantidade != null ? Number(patch.quantidade) : itensAtuais[0].quantidade,
            valor_praticado:
              patch.valor_praticado != null
                ? Number(patch.valor_praticado)
                : itensAtuais[0].valor_praticado,
          },
        ];
      }
      if (Object.keys(patch).length === 0) return businessError("NADA_PARA_ATUALIZAR");

      // Atualiza com o client do usuário (não service role): admin fica
      // isento dos limites no trigger de validação; motorista só alcança as
      // próprias vendas via RLS e continua sujeito aos limites de permissão.
      // Motorista edita apenas pendentes; admin também pode editar entregues.
      let query = userClient
        .from("entregas")
        .update(patch)
        .eq("id", entregaId)
        .eq("empresa_id", profile.empresa_id);
      query = isAdminOuMaster
        ? query.in("status", ["pendente", "entregue"])
        : query.eq("status", "pendente");
      const { data: updated, error } = await query.select("id").maybeSingle();
      if (error) {
        const msg = error.message ?? String(error);
        if (msg.includes("PERMISSAO_NEGADA")) return businessError(msg);
        throw error;
      }
      if (!updated) return businessError("ENTREGA_NAO_ENCONTRADA");
      return json({ ok: true });
    }

    if (action === "voltar_pendente") {
      const entregaId = String(body?.entrega_id ?? "");
      if (!entregaId) return businessError("ENTREGA_OBRIGATORIA");

      const isAdminOuMaster = await podeGerenciarEntrega(
        admin,
        userData.user.id,
        profile.empresa_id,
        {},
      );

      let query = admin
        .from("entregas")
        .update({
          status: "pendente",
          motorista_entrega_id: null,
          veiculo_id: null,
          km_inicial: null,
          foto_odometro_inicial_url: null,
          km_inicial_ia_confianca: null,
          iniciada_em: null,
        })
        .eq("id", entregaId)
        .eq("empresa_id", profile.empresa_id)
        .eq("status", "em_rota");
      if (!isAdminOuMaster) {
        query = query.eq("motorista_entrega_id", userData.user.id);
      }
      const { data: updated, error } = await query.select("id").maybeSingle();
      if (error) throw error;
      if (!updated) return businessError("ENTREGA_NAO_ENCONTRADA");
      return json({ ok: true });
    }

    if (action === "finalizar_entrega") {
      const entregaId = String(body?.entrega_id ?? "");
      if (!entregaId) return businessError("ENTREGA_OBRIGATORIA");

      const { data: entregaAtual } = await admin
        .from("entregas")
        .select("id, km_inicial, status")
        .eq("id", entregaId)
        .eq("empresa_id", profile.empresa_id)
        .eq("motorista_entrega_id", userData.user.id)
        .maybeSingle();
      if (!entregaAtual) return businessError("ENTREGA_NAO_ENCONTRADA");

      const kmFinal = Number(body.km_final);
      if (
        !numeroValido(kmFinal) ||
        !Number.isInteger(kmFinal) ||
        (entregaAtual.km_inicial != null && kmFinal < Number(entregaAtual.km_inicial))
      ) {
        return businessError("KM_FINAL_INVALIDO");
      }
      if (!body.foto_material_url) return businessError("FOTO_MATERIAL_OBRIGATORIA");
      const confiancaFinal = ["alta", "media", "baixa"].includes(String(body.km_final_ia_confianca))
        ? String(body.km_final_ia_confianca)
        : null;

      const { data: perms } = await admin.rpc("get_permissoes_efetivas", {
        _motorista_id: userData.user.id,
      });
      if (perms?.foto_odometro_obrigatoria === true && !body.foto_odometro_final_url) {
        return businessError("FOTO_ODOMETRO_OBRIGATORIA");
      }
      if (
        perms?.gps_obrigatorio === true &&
        (body.foto_material_gps_lat == null || body.foto_material_gps_lng == null)
      ) {
        return businessError("GPS_OBRIGATORIO");
      }
      for (const path of [
        body.foto_odometro_final_url,
        body.foto_material_url,
        body.assinatura_url,
      ]) {
        if (!caminhoDoUsuario(path, profile.empresa_id, userData.user.id)) {
          return businessError("CAMINHO_ARQUIVO_INVALIDO");
        }
      }

      const { data: updated, error } = await admin
        .from("entregas")
        .update({
          km_final: kmFinal,
          km_final_ia_confianca: confiancaFinal,
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
