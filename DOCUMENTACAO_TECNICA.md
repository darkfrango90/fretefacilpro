# Frete Fácil PRO — documentação técnica

## 1. Visão geral

O Frete Fácil PRO é uma aplicação multiempresa para registrar vendas, distribuir e concluir entregas, controlar motoristas e frota e acompanhar custos operacionais. O produto atende três perfis:

- **master**: administra empresas, planos, vencimentos e limites de usuários;
- **admin**: gerencia a operação de uma empresa, cadastros, financeiro, permissões e relatórios;
- **motorista**: vende, inicia/finaliza entregas e lança operações de campo, inclusive sem conexão.

O código possui 116 arquivos TypeScript/TSX, 34 arquivos de rota e aproximadamente 18,9 mil linhas em `src/`.

## 2. Stack e arquitetura

| Camada        | Tecnologia                                                      | Responsabilidade                                 |
| ------------- | --------------------------------------------------------------- | ------------------------------------------------ |
| Interface     | React 19, TypeScript, Tailwind CSS 4 e componentes Radix/shadcn | Telas responsivas e acessíveis                   |
| Aplicação web | TanStack Start e TanStack Router                                | Shell, rotas tipadas e proteção de navegação     |
| Estado remoto | TanStack Query                                                  | Consultas, cache em memória e invalidação        |
| Backend       | Supabase Auth, Postgres, RLS, Storage e Edge Functions          | Identidade, persistência, autorização e arquivos |
| Offline       | Dexie/IndexedDB, Local Storage e Workbox                        | Outbox, cache de leitura e shell PWA             |
| Mobile        | Capacitor 8, Android, Camera e Geolocation                      | APK/AAB e recursos nativos                       |
| OCR           | Gemini em Edge Functions                                        | Leitura de cupons e hodômetros por fotografia    |
| Deploy web    | Vercel                                                          | Build Bun e publicação de `dist/client`          |

Fluxo simplificado:

```text
React/TanStack Query
  ├─ online ──> Supabase (Auth + Postgres/RLS + Storage + Edge Functions)
  └─ offline ─> IndexedDB/Dexie (outbox e fotos)
                  └─ reconexão/foco/intervalo ─> sincronização idempotente
```

## 3. Organização do repositório

- `src/routes`: rotas públicas e autenticadas;
- `src/components`: componentes de domínio e biblioteca de UI;
- `src/hooks`: sessão, permissões, conectividade e estado offline;
- `src/lib/offline`: banco Dexie, fila, cache persistente e motor de sincronização;
- `src/integrations/supabase`: clientes browser/server, middleware e tipos gerados;
- `supabase/functions`: seis Edge Functions;
- `MIGRATION*.sql`: esquema, funções, RLS e evolução do banco;
- `public`: manifesto, ícones, página offline e metadados web;
- `android`: projeto nativo Gradle já inicializado;
- `scripts`: pós-processamento do build, shell CSR offline e utilitários;
- `CAPACITOR.md`: guia atualizado para compilar e publicar Android.

## 4. Funcionalidades e rotas

### Públicas e de sessão

- `/`: landing page e redirecionamento de usuário autenticado;
- `/auth`: login;
- `/acesso-expirado`: bloqueio de assinatura vencida;
- `/trocar-senha`: troca obrigatória de senha inicial.

### Operação comercial e entregas

- `/dashboard`: indicadores de vendas, receita válida, combustível, despesas conferidas e saldo operacional;
- `/entrega`: criação de venda/entrega com regras por motorista;
- `/entregas`: administração, filtro, edição, cancelamento, exclusão e detalhes;
- `/pendentes`: seleção de venda pendente, veículo, foto e leitura assistida da quilometragem inicial;
- `/minhas-entregas`: entregas em rota e histórico do motorista;
- `/entrega/$id/finalizar`: foto e leitura assistida do KM final, foto do material, assinatura e GPS;
- `/financeiro`: confirmação de recebimentos, sem contabilizar vendas canceladas.

Estados da entrega:

```text
pendente ── iniciar ──> em_rota ── finalizar ──> entregue
   └──────────────────────── cancelar ─────────> cancelada
```

### Cadastros e administração

- `/clientes`: pessoas físicas/jurídicas, documento, telefone e endereço;
- `/materiais`: produto, unidade e preço-base;
- `/veiculos`: placa, tipo, quilometragem e ativação;
- `/motoristas`: criação, ativação e desativação de usuários;
- `/permissoes`: padrão da empresa e exceções por motorista;
- `/master`: empresas, planos, expiração, limites e visão de uso;
- `/configuracoes`: central de recursos conforme o papel.

### Frota e custos

- `/operacao`: acesso rápido a abastecimentos, despesas e pneus;
- `/abastecimento`: litros, valor, KM, cupom e OCR;
- `/despesas` e `/despesas/nova`: lançamento e conferência de custos;
- `/pneus`, `/pneus/instalar`, `/pneus/remover/$id` e `/pneus/relatorio`: ciclo e custo dos pneus;
- `/afericoes`: aferição física do tanque;
- `/consumo-preciso`: consumo entre aferições.

### Relatórios e sincronização

- `/relatorios`: vendas, materiais, clientes, pagamentos, despesas e saldo operacional;
- `/relatorios-motorista`: produção individual por período e filtros;
- `/sincronizacao`: itens locais, erros e reenvio;
- `/sincronizacao/historico`: histórico das tentativas.

## 5. Modelo de dados

Principais tabelas:

- identidade e empresa: `empresas`, `profiles`, `user_roles`;
- operação: `clientes`, `materiais`, `veiculos`, `entregas`, `jornadas`;
- frota/custos: `abastecimentos`, `afericoes_tanque`, `despesas`, `pneus`;
- configuração: `permissoes_padrao`, `permissoes_motorista`;
- suporte: `empresa_venda_seq` e `auditoria`.

O isolamento entre empresas é feito no Postgres com RLS e funções auxiliares como `current_empresa_id`, `is_master` e `is_admin_da_empresa`. O frontend oculta ações por papel, mas a autorização decisiva permanece no banco e nas Edge Functions.

As permissões efetivas controlam documento/telefone obrigatórios, cadastro de cliente, alteração e desconto do produto, frete, materiais permitidos, limites da venda, fotos, GPS, observação e cancelamento.

## 6. Edge Functions

- `criar-empresa`: provisionamento de empresa e administrador pelo master;
- `criar-motorista`: criação segura de conta vinculada à empresa;
- `ocr-abastecimento`: valida o usuário e envia a imagem ao Gemini para extrair dados do cupom;
- `ocr-odometro`: identifica hodômetros digitais centrais/inferiores e mecânicos, devolvendo o KM total, nível de confiança, texto observado e justificativa para confirmação do motorista;
- `sync-entrega`: endpoint idempotente para criar, iniciar e finalizar entregas da fila offline; revalida identidade, posse, regras comerciais, KM, fotos, GPS e caminhos de Storage;
- `admin-reset`: rotina destrutiva exclusiva de master, protegida pela confirmação literal `APAGAR_TODOS_OS_DADOS_NAO_MASTER`; limpa registros e arquivos não preservados.

Secrets utilizados pelas funções: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` ou `SUPABASE_PUBLISHABLE_KEY` e, no OCR, `GEMINI_API_KEY`.

## 7. Funcionamento offline

O shell PWA usa Workbox: navegação `NetworkFirst`, assets versionados `CacheFirst`, imagens `StaleWhileRevalidate` e chamadas Supabase `NetworkOnly`. Dados de negócio não são guardados pelo service worker.

O Dexie mantém:

- `outbox`: comandos e blobs de fotos;
- `sync_history`: resumo das tentativas;
- `permissoes_cache`: permissão efetiva do usuário.

A fila suporta venda, início/finalização, abastecimento, despesa e instalação/remoção de pneu. Cada item contém `empresa_id` e `motorista_id`; leitura e envio agora são filtrados pela identidade ativa para impedir vazamento entre sessões no mesmo aparelho.

No início da entrega, a foto do painel e o KM confirmado ficam na mesma operação da fila. Ao reconectar, a foto é enviada primeiro ao bucket privado `odometros` e somente depois a entrega é iniciada. A leitura por IA exige conexão, mas a captura e o preenchimento manual continuam disponíveis offline.

As listas críticas de entregas pendentes/em rota, veículos e abastecimento possuem último resultado persistido por usuário/empresa. A sincronização roda ao recuperar conexão, receber foco, alterar a fila, iniciar a aplicação e a cada 60 segundos. Uploads usam caminhos `empresa/usuario/arquivo` e `upsert` para retry idempotente.

Limite conhecido: o modo offline depende de ao menos um carregamento online anterior para popular listas de referência. Conflitos e violações de permissão são decididos pelo servidor; recusas definitivas permanecem visíveis na tela de sincronização.

## 8. Segurança

- autenticação pelo Supabase e guarda de rotas no servidor/cliente;
- isolamento multiempresa por RLS;
- validação das regras de venda no banco e em `sync-entrega`;
- buckets privados e políticas de caminho por empresa/usuário;
- URLs assinadas para visualizar comprovantes;
- service role somente em código server/Edge Function;
- `allowMixedContent=false` e backup Android desabilitado;
- reset administrativo exige papel master e confirmação explícita.
- OCR do hodômetro exige JWT válido, limita formato/tamanho da imagem e nunca expõe a chave Gemini ao aplicativo;
- o valor sugerido pela IA sempre permanece editável e sujeito à confirmação humana;

`MIGRATION_HARDENING.sql` e `supabase/migrations/20260808210000_ocr_odometro.sql` já foram aplicadas no projeto vinculado. Em outra instalação, são necessárias para ativar integralmente as regras de banco, Storage e o registro fotográfico do hodômetro.

## 9. Migrações

Para uma instalação nova, aplique no SQL Editor nesta ordem:

1. `MIGRATION.sql`;
2. `MIGRATION_MASTER.sql`;
3. `MIGRATION_PAPEIS.sql`;
4. `MIGRATION_MOTORISTAS.sql`;
5. `MIGRATION_VENDA_ENTREGA.sql`;
6. `MIGRATION_FIX_VENDA_PENDENTE.sql`;
7. `MIGRATION_NUMERO_VENDA.sql`;
8. `MIGRATION_CLIENTE_ENDERECO.sql`;
9. `MIGRATION_ADD_VEICULO_TIPO.sql`;
10. `MIGRATION_PERMISSOES.sql`;
11. `MIGRATION_FINANCEIRO.sql`;
12. `MIGRATION_AFERICAO.sql`;
13. `MIGRATION_DESPESAS.sql`;
14. `MIGRATION_PNEUS.sql`;
15. `MIGRATION_HARDENING.sql`;
16. `supabase/migrations/20260808210000_ocr_odometro.sql` por último.

Em uma base existente, faça backup e aplique somente as migrações ainda ausentes, respeitando a ordem acima. Os scripts usam predominantemente operações idempotentes, mas devem ser validados primeiro em staging.

## 10. Ambiente local e deploy

Variáveis web/server:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Nunca coloque `SUPABASE_SERVICE_ROLE_KEY` em variável `VITE_*`.

Comandos principais:

```bash
bun install
bun run dev
bun run typecheck
bun run lint
bun run check
bun run build
```

Na Vercel, o build usa `bun run build`, publica `dist/client` e reescreve rotas para `index.html`. Para Android, siga `CAPACITOR.md` e sincronize o build com `npx cap sync android`.

## 11. Alterações desta rodada

### Correções funcionais

- adicionado reconhecimento fotográfico do hodômetro no início e no encerramento da entrega;
- o mesmo componente atende os quatro painéis de referência: digital central, digital inferior e hodômetro mecânico, além de classificar imagens indeterminadas;
- a IA ignora velocímetro, conta-giros, relógio, data, temperatura, combustível e hodômetro parcial, preenchendo apenas a quilometragem total;
- a leitura informa confiança alta/média/baixa, nunca finaliza a ação automaticamente e permite correção manual pelo motorista;
- o encerramento agora bloqueia KM final inferior ao inicial e valores negativos ou não inteiros;
- corrigidos atributos React inválidos na landing page e tipagem dos ícones clonados;
- acrescentada a validação de observação obrigatória no formulário de venda;
- corrigido o tipo gerado de `veiculos.tipo`;
- receita, ticket, financeiro e agrupamentos deixaram de somar vendas canceladas;
- dashboard e relatório passaram a separar despesas conferidas e saldo operacional, removendo a antiga “margem bruta” sem base de custo do produto;
- contagem de usuários do master considera somente perfis ativos;
- renovação de 30 dias soma ao vencimento futuro em vez de encurtá-lo.

### Regras e segurança

- `sync-entrega` passou a revalidar preço, desconto, frete, material, limites, cliente, observação, fotos, GPS, KM, vínculo e caminhos dos arquivos;
- criada `MIGRATION_HARDENING.sql` com validações por trigger, permissão de criação de cliente e políticas privadas de Storage;
- `admin-reset` ganhou confirmação explícita, paginação de usuários e limpeza recursiva, incluindo despesas e pneus;
- adicionadas permissões de localização ao Android, tráfego misto foi bloqueado e backup do app foi desativado.

### Offline e desempenho

- Dexie atualizado para a versão 4 com índices de usuário/empresa;
- fila, contadores e telas passaram a enxergar somente dados da sessão ativa;
- cache de permissões foi individualizado e o cache legado é migrado com conferência de identidade;
- adicionado cache persistente versionado para dados críticos de leitura;
- consultas de relatórios e dashboard foram paralelizadas e mantêm filtros no servidor quando aplicável;
- modal de detalhes de entrega foi consolidado em um componente compartilhado.

### Qualidade e limpeza

- adicionados scripts `typecheck` e `check` e lint restrito ao código relevante;
- Prettier deixou de ser executado como regra ESLint, separando formatação de defeitos de código;
- removidos `vite-tsconfig-paths` e `eslint-plugin-prettier`; o Vite 8 passou a usar a resolução nativa de aliases e o build caiu de timeout superior a 180 segundos para 32 segundos nesta máquina;
- documentação Android foi corrigida para refletir o projeto atual;
- removidos `src/routes/_authenticated/import-temp.tsx` e `src/data/temp-import-clientes.json`, usados apenas em uma importação pontual;
- preservados `public/og-image.jpg` e `android/app/release/`, pois já eram alterações/artefatos do usuário antes desta rodada.

## 12. Validação

- `bun run typecheck`: aprovado, zero erros;
- `bun run lint`: aprovado, zero erros e seis avisos preexistentes do padrão de exportação dos componentes-base de UI;
- `bun run check`: aprovado;
- `bun x vite build`: aprovado; cliente e servidor compilados em 32 segundos no total;
- `node scripts/build-csr-shell.mjs`: aprovado; entry CSR e `offline.html` gerados;
- revisão React: componentes duplicados removidos, consultas independentes paralelas, listeners com cleanup, cache versionado/isolado e dependências de hooks revisadas;
- `git diff --check`: aprovado, sem erros de whitespace.

O build ainda informa que o chunk principal ultrapassa 500 kB antes de gzip (aproximadamente 180,8 kB gzip). As rotas já são divididas; uma divisão manual adicional de vendors pode ser avaliada com medição real de carregamento, sem criar fragmentação prematura.

## 13. Próximos passos recomendados

- validar os novos fluxos de permissão e sincronização com usuários de teste;
- criar testes automatizados de domínio, RLS e sincronização offline;
- adicionar CI para `bun run check` e build;
- configurar monitoramento de erros e métricas de sincronização;
- confirmar URLs e textos jurídicos de privacidade/termos antes da publicação nas lojas.

## 14. Estado da publicação em 10/08/2026

- `MIGRATION_HARDENING.sql`: aplicação no Supabase confirmada pelo responsável do projeto;
- `supabase/migrations/20260808210000_ocr_odometro.sql`: aplicada no banco vinculado;
- `sync-entrega`: publicada e `ACTIVE`, versão 14, com verificação JWT;
- `criar-motorista`: publicada com suporte à edição segura, versão 13, com verificação JWT;
- `ocr-odometro`: publicada e `ACTIVE`, versão 1, com verificação JWT;
- `admin-reset`: publicada e `ACTIVE`, versão 3, com verificação JWT;
- projeto Supabase: `qejzxnjfcioauneyjxtl`.

`admin-reset` não foi invocada durante a validação, pois é uma operação destrutiva.

## 15. Histórico Android 1.2

- `versionCode`: 3;
- `versionName`: 1.2;
- permissões explícitas: internet, câmera e localização aproximada/precisa;
- conteúdo web: `dist/client`, sincronizado pelo Capacitor.
- bundle gerado: `android/app/build/outputs/bundle/release/app-release.aab`;
- tamanho: 5.799.216 bytes;
- SHA-256: `D52F894AA047C9190D22358144CB2756004BDE61F884655953F444C43FA9656A`;
- assinatura: pendente; a keystore não é armazenada no repositório.

O APK 1.1 anterior usa o certificado de assinatura SHA-256 `1d9ee7221a60328d7247b4c0cf31eeae16e3e5d1b1e26d29ba8c25decc5728a4`. A versão 1.2 deve ser assinada com a mesma chave de upload antes do envio à Play Console.

### APK 1.2 assinado

- arquivo: `android/app/release/app-release.apk`;
- tamanho: 5.112.164 bytes;
- SHA-256 do arquivo: `AFFDB1CB927C5CB8FBAEB8F1E50B2C4CB127AB1DA2DDE2391A3B705CD49D1644`;
- assinatura APK Signature Scheme v2: válida;
- certificado SHA-256: `1d9ee7221a60328d7247b4c0cf31eeae16e3e5d1b1e26d29ba8c25decc5728a4`, igual ao da versão 1.1;
- permissões confirmadas no pacote: internet, câmera, localização aproximada/precisa e estado da rede.

Este é o artefato selecionado pelo responsável para distribuição direta. O AAB permanece sem assinatura e não é o artefato final desta rodada.

## 16. OCR do hodômetro e Android 1.3

Arquivos principais desta funcionalidade:

- `supabase/functions/ocr-odometro/index.ts`: autenticação, validação da imagem e resposta estruturada do Gemini;
- `src/lib/ocr-odometro.ts`: envio e validação do resultado no aplicativo;
- `src/components/odometro-ocr-field.tsx`: captura, estado da análise, confiança e edição manual compartilhados pelos dois fluxos;
- `src/routes/_authenticated/pendentes.tsx`: foto e KM inicial obrigatórios;
- `src/routes/_authenticated/entrega.$id.finalizar.tsx`: foto, KM final e consistência com o KM inicial;
- `src/lib/offline/sync.ts` e `supabase/functions/sync-entrega/index.ts`: upload idempotente e validação no servidor;
- `supabase/migrations/20260808210000_ocr_odometro.sql`: colunas, restrições e trigger da foto inicial.

As quatro imagens fornecidas foram usadas como referência visual dos formatos de painel e não foram copiadas para o repositório. A resposta da IA é deliberadamente conservadora: se os dígitos estiverem ambíguos, retorna confiança baixa ou nenhuma leitura e solicita digitação/confirmação humana.

Versão distribuída para teste:

- `versionCode`: 4;
- `versionName`: 1.3;
- build web, sincronização Capacitor e `assembleRelease`: aprovados;
- APK assinado: `android/app/release/app-release.apk`;
- tamanho: 5.116.684 bytes;
- SHA-256 do arquivo: `5D85BEC21DE110E0C5DF0142FAFAC76729F75F77EED49EB25BA48BC80C569F74`;
- assinatura v2 válida e certificado SHA-256 `1d9ee7221a60328d7247b4c0cf31eeae16e3e5d1b1e26d29ba8c25decc5728a4`.

Limite de validação: a função remota exige uma sessão real autenticada. Portanto, a leitura das quatro fotos precisa de um teste de campo pelo aplicativo logado antes da distribuição geral; a compilação, os contratos tipados e as validações de servidor já foram aprovados.

## 17. Correção do crash da câmera — Android 1.4

O teste do APK 1.3 em aparelho físico revelou fechamento contínuo ao tocar na câmera. O relatório do Android mostrou `NullPointerException` em `CameraPlugin.getPermissionStates()`, antes da abertura da captura. A comparação entre o código-fonte do Capacitor, o Manifest mesclado e `android/app/build/outputs/mapping/release/mapping.txt` confirmou:

- `android.permission.CAMERA` estava corretamente presente no APK;
- a falha não envolvia Gemini, Supabase ou o formulário React;
- a otimização agressiva do R8 havia reduzido `com.getcapacitor.PluginHandle`, usado por reflexão para recuperar `@CapacitorPlugin` e suas permissões;
- a anotação recebida por `Bridge.getPermissionStates()` tornou-se nula no release assinado.

Correção aplicada em `android/app/proguard-rules.pro`:

- preservação de `RuntimeVisibleAnnotations`, `RuntimeInvisibleAnnotations` e `AnnotationDefault`;
- preservação das anotações `com.getcapacitor.annotation.*`;
- preservação integral de `PluginHandle` e das classes marcadas com `@CapacitorPlugin`;
- minificação e redução de recursos continuam habilitadas para o restante do aplicativo.

Novo release preparado:

- `versionCode`: 5;
- `versionName`: 1.4;
- `clean assembleRelease`: aprovado;
- mapeamento R8 verificado: `PluginHandle`, `getPluginAnnotation()` e metadados reflexivos preservados;
- APK não assinado: `android/app/build/outputs/apk/release/app-release-unsigned.apk`, 5.108.492 bytes;
- APK 1.4 assinado em `android/app/release/app-release.apk`, 5.116.684 bytes, SHA-256 `D82191D7C1269FE57B58A7CBEF19C452A767048977D0B3DD778EC1BEF2EB8F0C`;
- teste da câmera em aparelho físico ainda necessário para confirmar o comportamento específico do dispositivo.

## 18. Conclusão administrativa e venda FRETE — Android 1.5

- o componente de gesto passou a aceitar ações diferentes em cada direção sem alterar os usos legados;
- na tela administrativa de entregas, arrastar uma venda pendente ou em rota para a direita conclui diretamente, sem exigir KM ou fotos;
- a ação é autorizada novamente na Edge Function e somente admin/master pode executá-la;
- a observação anterior é preservada e recebe a linha `Venda concluída pelo administrador`;
- arrastar para a esquerda inicia a exclusão; administradores também podem excluir vendas em rota;
- ao selecionar o material chamado `FRETE`, o motorista não informa quantidade nem valor praticado: o aplicativo envia quantidade `1`, valor praticado `0` e exige somente um valor de frete positivo;
- a Edge Function consulta o nome real do material, normaliza esses valores e ignora as regras de alteração/desconto do produto apenas nesse caso;
- limites e permissão de valor de frete continuam sendo aplicados normalmente;
- `sync-entrega` versão 13 publicada e ativa com verificação JWT;
- versão Android preparada: `versionCode` 6 e `versionName` 1.5;
- APK não assinado gerado em `android/app/build/outputs/apk/release/app-release-unsigned.apk`, 5.109.452 bytes;
- build web, shell offline, sincronização Capacitor, lint vital e `assembleRelease` aprovados;
- mapeamento R8 conferido novamente com `PluginHandle` e `getPluginAnnotation()` preservados.

## 19. Isolamento por motorista, abastecimentos e cadastros — Android 1.6

### Vendas e entregas por motorista

- adicionada e aplicada a migração `supabase/migrations/20260810140000_isolamento_motorista.sql`;
- removida a política antiga de pool compartilhado que permitia a qualquer motorista consultar todas as vendas pendentes da empresa;
- motorista agora consulta somente vendas que ele cadastrou ou entregas atribuídas a ele; admin/master continuam consultando toda a empresa;
- a tela de pendentes aplica o mesmo filtro explicitamente e usa cache separado por empresa e usuário, sem reaproveitar o cache amplo anterior;
- a Edge Function também valida o proprietário antes de iniciar a entrega, inclusive quando a operação veio da fila offline;
- criado índice por motorista/status/data para sustentar a nova consulta;
- `sync-entrega` versão 14 publicada e ativa com verificação JWT.

### Histórico de abastecimentos

- a tela de abastecimento passou a listar os 30 registros mais recentes feitos pelo motorista conectado;
- cada item mostra veículo, data/hora, litros, valor, KM e observação;
- registros salvos offline aparecem imediatamente com o estado `aguardando sincronização`;
- consulta, cache e fila são isolados por empresa e motorista;
- após salvar, o formulário é limpo sem sair da tela, permitindo conferir o lançamento na própria lista.

### Pesquisa de clientes

- o seletor simples foi substituído por um combobox usando os componentes `Command` e `Popover` já existentes no projeto;
- o motorista pode digitar parte do nome para filtrar ou continuar rolando toda a lista;
- seleção por teclado, mensagem de lista vazia e atributos de acessibilidade foram mantidos.

### Edição de motoristas e permissões

- cada motorista cadastrado agora possui os comandos `Editar`, `Permissões` e `Desativar/Reativar`;
- a edição permite alterar nome, telefone e e-mail; a Edge Function atualiza conjuntamente o perfil e o e-mail real usado no login;
- a função confirma novamente que o alvo possui papel de motorista e pertence à empresa do administrador;
- em caso de falha ao atualizar o perfil, o e-mail de autenticação é restaurado para evitar divergência;
- o comando `Permissões` abre a tela correspondente na aba individual e já seleciona o motorista escolhido;
- `criar-motorista` versão 13 publicada com autenticação obrigatória;
- botões reorganizados para telas pequenas e formulários com rótulos e estados de carregamento.

### Validação desta atualização

- `bun run check`: aprovado, zero erros e somente os seis avisos preexistentes dos componentes-base;
- `bun x vite build`: aprovado;
- migração remota: aplicada com sucesso no projeto `qejzxnjfcioauneyjxtl`;
- `sync-entrega` versão 14: `ACTIVE`;
- revisão React/shadcn: componente de busca compartilhado, atributos acessíveis, consultas/cache por identidade e listeners com limpeza;
- como já existe APK 1.5 assinado em `android/app/release`, a atualização foi elevada para `versionCode` 7 e `versionName` 1.6;
- o APK 1.6 final precisa ser assinado com a mesma chave antes da instalação sobre a versão anterior.

## 20. Atualização interna OTA — versão-base Android 1.6

Foi adicionado um canal de atualização auto-hospedado para que as próximas mudanças da camada web sejam instaladas dentro do Frete Fácil PRO, sem redistribuir APK manualmente.

### Arquitetura

- plugin nativo `@capgo/capacitor-updater` 8.51.3, compatível com Capacitor 8;
- modo manual: nenhuma dependência do serviço pago Capgo e nenhuma consulta automática à nuvem do fornecedor;
- manifesto fixo em `https://fretefacilpro.vercel.app/updates/latest.json`;
- pacote ZIP hospedado no mesmo domínio e verificado por SHA-256 antes da extração;
- compatibilidade exata com a versão nativa declarada no manifesto;
- confirmação `notifyAppReady()` em cada inicialização e rollback nativo se o pacote atualizado não carregar;
- pacote anterior preservado para recuperação e comando de restauração do conteúdo original do APK.

### Interface

- nova rota `/_authenticated/atualizacao`, disponível para administrador e motorista em **Configurações > Atualização**;
- exibe versão web instalada, versão-base Android, notas e tamanho do download;
- possui verificação manual, progresso de 0 a 100%, instalação com reinício e restauração da versão original;
- ao entrar no sistema, o aplicativo verifica silenciosamente e mostra um aviso quando houver versão nova;
- navegador informa que a versão web é atualizada pelo site e oferece recarregamento.

### Empacotamento e publicação

- `package.json` passa a controlar a versão web semântica; início em `1.6.0`;
- `ota-release.json` controla compatibilidade nativa, obrigatoriedade e notas;
- `scripts/build-ota.mjs` copia a saída limpa para `dist/capacitor`, gera o ZIP em `dist/client/updates`, calcula SHA-256 e cria `latest.json`;
- `capacitor.config.ts` usa `dist/capacitor`, portanto o ZIP publicado não aumenta o APK por duplicação;
- `vercel.json` define CORS e cache sem revalidação para o manifesto, e cache imutável para os ZIPs versionados;
- o script de build deixou de modificar `public/og-image.jpg`; a imagem do usuário permanece preservada.

Primeiro pacote gerado:

- versão web: `1.6.0`;
- base nativa: `1.6` (`versionCode` 7);
- arquivo: `dist/client/updates/fretefacil-1.6.0.zip`;
- tamanho: 1.527.744 bytes;
- SHA-256: `067ADAC91EACCAFB06E0CD41EF2C932F30B3284A62EBC394A0EE8083165D781C`;
- `index.html` confirmado na raiz do ZIP;
- `dist/capacitor` confirmado sem diretório `updates`.

APK-base não assinado:

- arquivo: `android/app/build/outputs/apk/release/app-release-unsigned.apk`;
- tamanho: 5.622.407 bytes;
- SHA-256: `10E1779C5A44EBC7DC59F266DB7EB9038B2B702803D0A1A10346E57CBD98705E`;
- `versionCode` 7 e `versionName` 1.6 confirmados;
- plugin OTA e plugin de câmera presentes no release minificado;
- `PluginHandle` e `getPluginAnnotation()` continuam preservados pelo R8;
- `assembleRelease --no-daemon`: aprovado.

## 21. Correções OTA 1.6.1 — quilometragem e histórico do motorista

### Abastecimentos

- `km_atual` passou de inteiro para `numeric(12,1)`, preservando a casa decimal exibida pelo odômetro;
- o aplicativo aceita `547141,7`, `547.141,7`, `547141.7` e `547.141`;
- a fila offline normaliza novamente o valor antes do envio, corrigindo também registros que já estavam pendentes;
- a interface formata a quilometragem no padrão brasileiro.

### Entregas concluídas pelo administrador

- ao concluir diretamente, o backend preserva o motorista já atribuído ou usa o motorista que cadastrou a venda;
- um backfill atribui o responsável às entregas antigas concluídas pelo administrador;
- a aba **Já entregues** consulta tanto o responsável pela entrega quanto o autor da venda, mantendo o isolamento entre motoristas.

### Publicação

- versão web/OTA: `1.6.1`;
- compatibilidade nativa mantida em `1.6`, sem necessidade de gerar outro APK.

Limite: OTA atualiza somente HTML, CSS e JavaScript. Mudanças em câmera, localização, permissões, plugins, Gradle ou Manifest continuam exigindo um APK nativo com versão superior. A publicação do primeiro manifesto depende do deploy Git/Vercel; o CLI Vercel local não possuía credenciais e nenhuma conta externa foi criada automaticamente.
