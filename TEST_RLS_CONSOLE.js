/**
 * 🔒 TESTE DE RLS - EXECUTAR NO CONSOLE DO NAVEGADOR
 *
 * Instruções:
 * 1. Abra seu app no navegador
 * 2. Pressione F12 (Developer Tools)
 * 3. Vá para aba "Console"
 * 4. Cole TODO o código abaixo
 * 5. Pressione Enter
 *
 * Resultado esperado:
 * ✅ Todas as 3 tabelas devem retornar dados
 * ✅ Todos os empresa_id devem ser IGUAIS (sua empresa)
 * ❌ NÃO deve ter UUIDs diferentes de empresas
 */

async function testarRLS() {
  console.log('🔍 INICIANDO TESTES DE RLS...\n');

  // Verificar se supabase existe
  if (typeof supabase === 'undefined') {
    console.error('❌ ERRO: Supabase não está disponível');
    console.error('Certifique-se de que seu app está carregado');
    return;
  }

  console.log('✅ Supabase cliente conectado\n');

  // ====================================
  // TEST 1: PNEUS
  // ====================================
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 1: PNEUS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    const { data: pneus, error: erroP } = await supabase
      .from('pneus')
      .select('id, empresa_id, posicao, status')
      .limit(5);

    if (erroP) {
      console.error('❌ ERRO em pneus:', erroP.message);
    } else {
      console.log(`✅ Pneus: ${pneus?.length ?? 0} registros retornados`);

      if (pneus && pneus.length > 0) {
        const empresaIds = [...new Set(pneus.map(p => p.empresa_id))];
        console.log(`   Empresa IDs únicos: ${empresaIds.length}`);
        console.log(`   Valores:`, empresaIds);

        // Validação
        if (empresaIds.length === 1) {
          console.log('   ✅ PASSOU: Todos os registros são da mesma empresa (RLS OK)');
        } else {
          console.log('   ⚠️ AVISO: Registros de múltiplas empresas (RLS pode estar fraco)');
        }
      } else {
        console.log('   ℹ️ Nenhum registro encontrado (normal se tabela vazia)');
      }
    }
  } catch (err) {
    console.error('❌ ERRO ao testar pneus:', err.message);
  }

  console.log('');

  // ====================================
  // TEST 2: AFERIÇÕES TANQUE
  // ====================================
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 2: AFERIÇÕES TANQUE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    const { data: afer, error: erroA } = await supabase
      .from('afericoes_tanque')
      .select('id, empresa_id, veiculo_id, litros_aferidos, data_hora')
      .limit(5);

    if (erroA) {
      console.error('❌ ERRO em afericoes_tanque:', erroA.message);
    } else {
      console.log(`✅ Aferições: ${afer?.length ?? 0} registros retornados`);

      if (afer && afer.length > 0) {
        const empresaIds = [...new Set(afer.map(a => a.empresa_id))];
        console.log(`   Empresa IDs únicos: ${empresaIds.length}`);
        console.log(`   Valores:`, empresaIds);

        // Validação
        if (empresaIds.length === 1) {
          console.log('   ✅ PASSOU: Todos os registros são da mesma empresa (RLS OK)');
        } else {
          console.log('   ⚠️ AVISO: Registros de múltiplas empresas (RLS pode estar fraco)');
        }
      } else {
        console.log('   ℹ️ Nenhum registro encontrado (normal se tabela vazia)');
      }
    }
  } catch (err) {
    console.error('❌ ERRO ao testar afericoes_tanque:', err.message);
  }

  console.log('');

  // ====================================
  // TEST 3: DESPESAS
  // ====================================
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 3: DESPESAS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    const { data: desp, error: erroD } = await supabase
      .from('despesas')
      .select('id, empresa_id, valor, categoria, data')
      .limit(5);

    if (erroD) {
      console.error('❌ ERRO em despesas:', erroD.message);
    } else {
      console.log(`✅ Despesas: ${desp?.length ?? 0} registros retornados`);

      if (desp && desp.length > 0) {
        const empresaIds = [...new Set(desp.map(d => d.empresa_id))];
        console.log(`   Empresa IDs únicos: ${empresaIds.length}`);
        console.log(`   Valores:`, empresaIds);

        // Validação
        if (empresaIds.length === 1) {
          console.log('   ✅ PASSOU: Todos os registros são da mesma empresa (RLS OK)');
        } else {
          console.log('   ⚠️ AVISO: Registros de múltiplas empresas (RLS pode estar fraco)');
        }
      } else {
        console.log('   ℹ️ Nenhum registro encontrado (normal se tabela vazia)');
      }
    }
  } catch (err) {
    console.error('❌ ERRO ao testar despesas:', err.message);
  }

  console.log('');

  // ====================================
  // RESUMO FINAL
  // ====================================
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ TESTES CONCLUÍDOS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('📋 RESULTADO ESPERADO:');
  console.log('✅ Nenhum erro nas 3 tabelas');
  console.log('✅ Cada tabela retorna dados (se houver na DB)');
  console.log('✅ Todos os empresa_id são IGUAIS (sua empresa)');
  console.log('✅ Sem dados de outras empresas');
  console.log('');
  console.log('Se tudo passou → RLS está funcionando corretamente! 🔒');
}

// EXECUTAR AGORA
console.log('%c🔒 TESTE DE RLS - FreteFacilPRO', 'font-size: 16px; font-weight: bold; color: green;');
console.log('%cExecutando testes de segurança...', 'font-size: 12px; color: blue;');
console.log('');

testarRLS().catch(err => {
  console.error('❌ Erro fatal:', err);
});
