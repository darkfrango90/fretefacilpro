# ✅ VALIDAÇÃO PÓS-MIGRATION RLS

**Status**: Migration SQL Executada  
**Data**: 2026-08-22  
**Próximo**: Validar implementação  

---

## 🔍 Verificação 1: RLS Ativado nas 3 Tabelas

Execute no Supabase SQL Editor:

```sql
SELECT 
  schemaname, 
  tablename, 
  rowsecurity 
FROM pg_tables 
WHERE tablename IN ('pneus', 'afericoes_tanque', 'despesas')
ORDER BY tablename;
```

**Resultado Esperado:**
```
schemaname | tablename          | rowsecurity
-----------+--------------------+------------
public     | afericoes_tanque   | t
public     | despesas           | t
public     | pneus              | t
```

✅ Se todos têm `rowsecurity = t` → **RLS ATIVADO COM SUCESSO**

---

## 🔒 Verificação 2: Policies Criadas

Execute no Supabase SQL Editor:

```sql
SELECT 
  tablename, 
  policyname, 
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies 
WHERE tablename IN ('pneus', 'afericoes_tanque', 'despesas')
ORDER BY tablename, policyname;
```

**Resultado Esperado:**
```
tablename      | policyname                    | permissive | roles
---------------+-------------------------------+------------+----------
afericoes_tanque | afericoes_tanque: admin gerencia | t         | {authenticated}
despesas        | despesas: admin gerencia      | t         | {authenticated}
pneus           | pneus: admin gerencia         | t         | {authenticated}
```

✅ Se tem 3 policies (uma por tabela) → **POLICIES CRIADAS COM SUCESSO**

---

## 📊 Verificação 3: Índices Criados

Execute no Supabase SQL Editor:

```sql
SELECT 
  tablename, 
  indexname, 
  indexdef
FROM pg_indexes 
WHERE tablename IN ('pneus', 'afericoes_tanque', 'despesas') 
  AND indexname LIKE '%empresa%'
ORDER BY tablename;
```

**Resultado Esperado:**
```
tablename      | indexname                  | indexdef
---------------+----------------------------+------------------
afericoes_tanque | afericoes_tanque_empresa_idx | CREATE INDEX afericoes_tanque_empresa_idx ON public.afericoes_tanque USING btree (empresa_id)
despesas        | despesas_empresa_idx       | CREATE INDEX despesas_empresa_idx ON public.despesas USING btree (empresa_id)
pneus           | pneus_empresa_idx          | CREATE INDEX pneus_empresa_idx ON public.pneus USING btree (empresa_id)
```

✅ Se tem 3 índices de empresa_id → **ÍNDICES CRIADOS COM SUCESSO**

---

## 🧪 Verificação 4: Testar Isolamento Real

### Teste via Supabase UI

1. **Conecte como Admin da Empresa A**
   - Vá para: Supabase Dashboard → Table Editor
   - Selecione `pneus` table
   - Você deve ver: ✅ Apenas pneus da Empresa A

2. **Tente forçar acesso a outra empresa via SQL**
   ```sql
   -- Como Admin da Empresa A
   -- Tente buscar pneus de OUTRA empresa
   SELECT * FROM pneus WHERE empresa_id = 'uuid-da-empresa-b';
   ```
   
   **Resultado Esperado**: 
   - ✅ Retorna vazio (0 rows) - RLS bloqueou
   - ❌ NÃO deve retornar dados de outra empresa

---

## 🎯 Teste 5: Validar no Frontend (JavaScript)

Coloque este código no console do seu app (F12):

```javascript
// Teste de RLS no Frontend
async function testarRLS() {
  console.log('🔍 Testando RLS...');
  
  // Test 1: Pneus (deve filtrar por empresa_id)
  const { data: pneus, error: erroP } = await supabase
    .from('pneus')
    .select('id, empresa_id, posicao')
    .limit(5);
  
  if (erroP) {
    console.error('❌ ERRO em pneus:', erroP);
  } else {
    console.log('✅ Pneus:', pneus?.length, 'registros');
    if (pneus && pneus.length > 0) {
      console.log('   Empresa IDs:', [...new Set(pneus.map(p => p.empresa_id))]);
    }
  }
  
  // Test 2: Aferições (deve filtrar por empresa_id)
  const { data: afer, error: erroA } = await supabase
    .from('afericoes_tanque')
    .select('id, empresa_id, veiculo_id, litros_aferidos')
    .limit(5);
  
  if (erroA) {
    console.error('❌ ERRO em afericoes:', erroA);
  } else {
    console.log('✅ Aferições:', afer?.length, 'registros');
    if (afer && afer.length > 0) {
      console.log('   Empresa IDs:', [...new Set(afer.map(a => a.empresa_id))]);
    }
  }
  
  // Test 3: Despesas (deve filtrar por empresa_id)
  const { data: desp, error: erroD } = await supabase
    .from('despesas')
    .select('id, empresa_id, valor, categoria')
    .limit(5);
  
  if (erroD) {
    console.error('❌ ERRO em despesas:', erroD);
  } else {
    console.log('✅ Despesas:', desp?.length, 'registros');
    if (desp && desp.length > 0) {
      console.log('   Empresa IDs:', [...new Set(desp.map(d => d.empresa_id))]);
    }
  }
}

// Executar teste
testarRLS();
```

**Resultado Esperado:**
```
✅ Pneus: 5 registros
   Empresa IDs: ["sua-empresa-uuid"]

✅ Aferições: 3 registros
   Empresa IDs: ["sua-empresa-uuid"]

✅ Despesas: 2 registros
   Empresa IDs: ["sua-empresa-uuid"]
```

❌ **NÃO deve aparecer**: UUIDs de outras empresas

---

## 📋 Checklist de Validação

Marque cada item após verificar:

```
[ ] RLS ativado em pneus (rowsecurity = t)
[ ] RLS ativado em afericoes_tanque (rowsecurity = t)
[ ] RLS ativado em despesas (rowsecurity = t)

[ ] Policy "pneus: admin gerencia" existe
[ ] Policy "afericoes_tanque: admin gerencia" existe
[ ] Policy "despesas: admin gerencia" existe

[ ] Índice pneus_empresa_idx criado
[ ] Índice afericoes_tanque_empresa_idx criado
[ ] Índice despesas_empresa_idx criado

[ ] Frontend retorna apenas dados da sua empresa (Teste 5)
[ ] Testes de isolamento passaram (Verificação 4)

[ ] PRONTO PARA PRODUÇÃO
```

---

## ⚠️ Se Algo Falhou

### Se RLS não ativou:
```sql
-- Verificar erros
SELECT * FROM pg_namespace WHERE nspname = 'public';

-- Tentar novamente
ALTER TABLE public.pneus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.afericoes_tanque ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.despesas ENABLE ROW LEVEL SECURITY;
```

### Se Policies não foram criadas:
```sql
-- Re-criar policies
CREATE POLICY "pneus: admin gerencia" ON public.pneus 
  FOR ALL TO authenticated 
  USING (public.is_admin_da_empresa(empresa_id)) 
  WITH CHECK (public.is_admin_da_empresa(empresa_id));

CREATE POLICY "afericoes_tanque: admin gerencia" ON public.afericoes_tanque 
  FOR ALL TO authenticated 
  USING (public.is_admin_da_empresa(empresa_id)) 
  WITH CHECK (public.is_admin_da_empresa(empresa_id));

CREATE POLICY "despesas: admin gerencia" ON public.despesas 
  FOR ALL TO authenticated 
  USING (public.is_admin_da_empresa(empresa_id)) 
  WITH CHECK (public.is_admin_da_empresa(empresa_id));
```

### Se Frontend não retorna dados:
1. Verificar se usuário está autenticado
2. Verificar se função `is_admin_da_empresa()` existe
3. Limpar cache do navegador (Ctrl+Shift+Delete)
4. Recarregar página

---

## 🎯 Próximos Passos

Se TODAS as verificações passaram ✅:

1. ✅ Aplicar migration RLS → **FEITO**
2. ✅ Validar RLS → **PRÓXIMA ETAPA** (você está aqui)
3. → Rodar testes de segurança (DEPLOYMENT_CHECKLIST.md)
4. → Deploy em produção

---

**Gerado em**: 2026-08-22  
**Versão**: 1.6.5  
**Status**: Aguardando validação RLS
