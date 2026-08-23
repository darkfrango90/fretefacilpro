# 🔒 GUIA RÁPIDO: TESTAR RLS NO CONSOLE

## ⚡ 3 Passos para Testar

### Passo 1: Abrir Console do Navegador
```
Windows/Linux: Pressione F12
Mac: Command + Option + I

Vá para aba: Console
```

### Passo 2: Copie o Código
Copie TODO o código abaixo (ou do arquivo `TEST_RLS_CONSOLE.js`):

```javascript
async function testarRLS() {
  console.log('🔍 INICIANDO TESTES DE RLS...\n');

  if (typeof supabase === 'undefined') {
    console.error('❌ ERRO: Supabase não está disponível');
    return;
  }

  console.log('✅ Supabase cliente conectado\n');

  // TEST 1: PNEUS
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
      console.log(`✅ Pneus: ${pneus?.length ?? 0} registros`);
      if (pneus?.length > 0) {
        const empresaIds = [...new Set(pneus.map(p => p.empresa_id))];
        console.log(`   Empresa IDs: ${empresaIds.join(', ')}`);
        console.log(empresaIds.length === 1 ? '   ✅ RLS OK (1 empresa)' : '   ⚠️ Múltiplas empresas!');
      }
    }
  } catch (err) {
    console.error('❌ ERRO:', err.message);
  }

  console.log('');

  // TEST 2: AFERIÇÕES
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 2: AFERIÇÕES TANQUE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    const { data: afer, error: erroA } = await supabase
      .from('afericoes_tanque')
      .select('id, empresa_id, veiculo_id, litros_aferidos')
      .limit(5);

    if (erroA) {
      console.error('❌ ERRO em afericoes_tanque:', erroA.message);
    } else {
      console.log(`✅ Aferições: ${afer?.length ?? 0} registros`);
      if (afer?.length > 0) {
        const empresaIds = [...new Set(afer.map(a => a.empresa_id))];
        console.log(`   Empresa IDs: ${empresaIds.join(', ')}`);
        console.log(empresaIds.length === 1 ? '   ✅ RLS OK (1 empresa)' : '   ⚠️ Múltiplas empresas!');
      }
    }
  } catch (err) {
    console.error('❌ ERRO:', err.message);
  }

  console.log('');

  // TEST 3: DESPESAS
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
      console.log(`✅ Despesas: ${desp?.length ?? 0} registros`);
      if (desp?.length > 0) {
        const empresaIds = [...new Set(desp.map(d => d.empresa_id))];
        console.log(`   Empresa IDs: ${empresaIds.join(', ')}`);
        console.log(empresaIds.length === 1 ? '   ✅ RLS OK (1 empresa)' : '   ⚠️ Múltiplas empresas!');
      }
    }
  } catch (err) {
    console.error('❌ ERRO:', err.message);
  }

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ TESTES CONCLUÍDOS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

testarRLS();
```

### Passo 3: Cole e Execute
1. Cole o código na aba Console do navegador
2. Pressione **Enter**
3. Aguarde os resultados

---

## 🎯 Resultado Esperado

### ✅ RLS FUNCIONANDO CORRETAMENTE

```
🔍 INICIANDO TESTES DE RLS...

✅ Supabase cliente conectado

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TEST 1: PNEUS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Pneus: 3 registros
   Empresa IDs: abc-123-def-456
   ✅ RLS OK (1 empresa)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TEST 2: AFERIÇÕES TANQUE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Aferições: 5 registros
   Empresa IDs: abc-123-def-456
   ✅ RLS OK (1 empresa)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TEST 3: DESPESAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Despesas: 2 registros
   Empresa IDs: abc-123-def-456
   ✅ RLS OK (1 empresa)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ TESTES CONCLUÍDOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Significado:**
- ✅ Todas as 3 tabelas retornam dados
- ✅ Todos os `empresa_id` são **IGUAIS** (sua empresa)
- ✅ **RLS está funcionando!** 🔒

---

## ❌ Problemas Possíveis

### Se vir: `❌ ERRO: Supabase não está disponível`
**Solução:**
1. Certifique-se que está na página do seu app
2. Aguarde a página carregar completamente
3. Tente novamente

### Se vir: `❌ ERRO em pneus: ...`
**Significa:** Erro ao buscar dados
**Solução:**
1. Verifique se a tabela tem dados
2. Verifique se RLS foi aplicado corretamente
3. Veja: VALIDATION_SCRIPT.md → Verificação 1

### Se vir: `⚠️ Múltiplas empresas!`
**CRÍTICO:** RLS não está filtrando corretamente
**Solução:**
1. Volte para Supabase Dashboard
2. Verifique SQL: `SELECT rowsecurity FROM pg_tables WHERE tablename = 'pneus';`
3. Deve retornar: `rowsecurity = t`
4. Se retornar `f`, re-execute a migration

### Se vir: `ℹ️ Nenhum registro encontrado`
**Normal se:**
- Tabela está vazia
- Não há dados para sua empresa

---

## 📋 Checklist Final

Após executar o teste:

```
[ ] Nenhum erro "Supabase não está disponível"
[ ] Sem erros de conexão
[ ] Pneus: ✅ RLS OK (1 empresa)
[ ] Aferições: ✅ RLS OK (1 empresa)
[ ] Despesas: ✅ RLS OK (1 empresa)
[ ] Pronto para PRODUÇÃO ✅
```

---

## 🚀 Próximo Passo

Se TODOS os testes passaram ✅:

1. Vá para: [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md)
2. Marque: `[x] Frontend retorna apenas dados da sua empresa`
3. Continue com os demais itens

---

**Arquivo de código completo:** [TEST_RLS_CONSOLE.js](TEST_RLS_CONSOLE.js)
