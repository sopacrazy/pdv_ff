# PDV Fort Fruit — Histórico de Desenvolvimento

Registro do que foi construído no sistema, em ordem cronológica, pra qualquer
pessoa (ou eu mesmo, numa sessão futura) entender rápido o que existe, por quê,
e o que ainda está pendente.

## Visão geral

Sistema de PDV (ponto de venda) web para a Fort Fruit, com backend Node/Express
+ SQLite local (offline-first) e sincronização de leitura com o ERP Protheus
via SQL Server. Frontend em React 19 + TypeScript + Vite + Tailwind.

```
Protheus (SQL Server)  --leitura (sync a cada 15min)-->  SQLite local  <--  PDV (React)
                                                              ^
                                                              |
                                                       Express (server/)
```

## Stack técnica

- **Frontend**: React 19, TypeScript, Vite 6, Tailwind (`@tailwindcss/vite`),
  Zustand (estado), react-router-dom v7, lucide-react (ícones).
- **Backend**: Node/Express (`server/`), ESM (`"type": "module"` no
  `package.json`).
- **Banco local**: `better-sqlite3` (fixado em `11.10.0` — é a última versão
  com binário pré-compilado pro ABI do Node 20 no Windows, evitando precisar
  instalar Visual Studio Build Tools).
- **Acesso ao Protheus**: `mssql` (SQL Server, somente leitura) + API REST do
  Protheus (escrita, ver seção 12).
- **Autenticação**: `bcryptjs` (hash de senha) + sessão simples por token em
  tabela `sessoes` no SQLite (sem JWT — escolha deliberada pela simplicidade,
  já que é um app interno de rede local).
- **Sincronização agendada**: `node-cron`, a cada 15 minutos.

---

## 1. Base do PDV

- Repositório trazido de `sopacrazy/pdv_ff` (GitHub) pra `C:\Sistema\pdv_ff`.
- Ajustes de UI: logo da Fort Fruit fixada no lugar do card de "último item",
  tabela de itens da venda aumentada pra melhor legibilidade.

## 2. Sincronização com o Protheus (somente leitura)

Serviços em `server/sync-*.js`, todos seguindo o mesmo padrão: consulta SQL,
upsert no SQLite numa transação, remove órfãos (com proteção contra zerar o
cache se a consulta vier vazia), roda na inicialização do servidor e a cada
15 minutos (`server/server.js`).

- **`sync-produtos.js`** — produtos da tabela de preço `015`, filial `01`
  (`DA1140` + `SB1140` pra unidades/fator de conversão). Salva em `produtos`.
- **`sync-cliente.js`** — cliente padrão fixo (`YDOVT3`, filial `01`) usado
  quando a venda não tem cliente específico. Salva em `clientes`.
- Diagnóstico de como o app funciona hoje (tudo local, com sync periódico do
  Protheus; atualização de preço no Protheus reflete só o preço, sem apagar
  o resto do cache).

## 3. Melhorias de UX no PDV

- Indicador online/offline + horário da última sincronização com o Protheus.
- Diálogos de confirmação estilizados (`ConfirmDialog.tsx`), substituindo
  `confirm()` nativo do navegador.
- Estado do caixa (aberto/fechado, fundo de troco) persistido — antes se
  perdia ao atualizar a página.
- Consultas: tabela mais profissional, registro de valor recebido e troco,
  QR Code PIX, exclusão lógica (soft delete, no padrão `D_E_L_E_T_` do
  Protheus: `''`/`'*'`).
- Busca de produto por código de barras **ou** por descrição (autocomplete
  tipo "Uva..." → lista de opções via `LIKE`), com correção de bug de
  z-index (dropdown aparecendo atrás da tabela de itens) e de
  `scrollIntoView` faltando na navegação por teclado.

## 4. Atalhos de teclado

- `F9` → `F1` para Finalizar Venda.
- `F5` → `DEL` para Cancelar Item.
- `F9` (que ficou livre) reaproveitado depois para "Buscar Venda".

## 5. Busca e edição de venda finalizada

- Modal de busca de venda (`ModalBuscaVenda.tsx`), acessível de Consultas e
  também direto do PDV (`F9`), permitindo reabrir uma venda já feita e
  editar qualquer coisa nela.

## 6. Módulo "Bilhete" (venda para atacado)

- Nova seção (`src/features/bilhetes/`) espelhando o módulo "BILHETES" do
  Protheus/TOTVS, mas com um visual mais profissional.
- Decisão de design: a lista de bilhetes é livre (visual próprio, melhor que
  o Protheus), mas a **tela de inclusão** foi feita pra ficar visualmente
  parecida com a tela real do Protheus — pedido explícito do usuário depois
  de ver a primeira versão (que tinha ido longe demais no redesign).
- Por enquanto é só frontend (em memória via `bilheteStore.ts`), sem
  persistência/integração ainda.

## 7. Painel Administrador + autenticação real

Antes disso o login era mockado (`authService.mock.ts`). Trocado por um
sistema de login de verdade pra todo o PDV (não só uma cortina no painel
admin) — decisão explícita do usuário ao escolher entre as opções
apresentadas.

- **Backend** (`server/db.js`, `server/auth.js`, `server/api.js`):
  - Tabelas `usuarios` (nome, login, senha com hash bcrypt, papel
    ADMIN/OPERADOR, ativo) e `sessoes` (token ↔ usuário).
  - Usuário admin inicial criado automaticamente na primeira execução
    (login/senha configuráveis via `ADMIN_LOGIN`/`ADMIN_SENHA` no `.env`,
    com fallback `admin`/`admin123`).
  - Rotas: `POST /api/auth/login`, `POST /api/auth/logout`,
    `GET /api/auth/me`, `GET/POST/PUT /api/usuarios` (admin only).
  - Middlewares `autenticarMiddleware` (401 sem token válido) e
    `exigirAdminMiddleware` (403 se não for ADMIN) — protegendo as rotas
    **no backend**, não só escondendo botão no frontend.
- **Frontend**:
  - `LoginPage.tsx`, `AuthStore` reescrito (usuário real + token, restaura
    sessão do `localStorage` ao abrir o app).
  - Rotas protegidas (`PrivateRoute`, `AdminRoute` em `routes/index.tsx`) —
    inclusive `/home`, que antes não tinha proteção nenhuma.
  - `AdminPage.tsx` + `UsuariosPage.tsx` (CRUD de usuários: criar, editar,
    ativar/desativar). Autodesativação bloqueada (admin não consegue se
    trancar fora do próprio sistema).
- Validado via curl direto na API (sem passar pelo frontend): sem token →
  401; com token de operador → 403 nas rotas de admin; com token de admin →
  200. Confirma que a proteção é real, não só cosmética.

## 8. Vínculo dos usuários do PDV com o Protheus

Pedido: usuário do PDV precisa "amarrar" com o usuário real do Protheus.

- **SYS_USR** (login/usuário do Protheus): campo de busca com autocomplete
  (`UsuariosPage.tsx`) — digita nome ou código, filtra na hora, mostra o
  código de cada opção pra desambiguar nomes repetidos.
- **SA3 (Vendedor)**: seleciona a filial (`01`/`04`/`06`/`22`, vindas do
  Protheus) e depois busca o vendedor daquela filial — mesmo padrão de
  combobox com busca.
- `authStore`: o `vendedor.codigo` usado nas vendas passa a priorizar o
  código real do SA3 (o que aparece nos documentos comerciais do Protheus),
  caindo pro código do SYS_USR e por último um pedaço do UUID interno se
  nada estiver vinculado.

## 9. Cache local dos dados do Protheus usados no vínculo

Pedido: não bater direto no Protheus toda vez que o admin abre o formulário
de vínculo — sincronizar local, igual produtos/clientes.

- **`sync-usuarios-protheus.js`** — sincroniza `SYS_USR` pra tabela local
  `protheus_usuarios`.
- **`sync-vendedores-protheus.js`** — sincroniza `SA3140` (todas as filiais)
  pra tabela local `protheus_vendedores`.
- Entram no ciclo de sync já existente (inicialização + a cada 15 min).
- As rotas `/api/protheus/usuarios`, `/api/protheus/filiais` e
  `/api/protheus/vendedores` passaram a ler do SQLite local (resposta em
  ~0,1s) em vez de abrir conexão nova com o Protheus a cada busca.

## 10. Dashboard da tela Home

Redesenho completo da Home no estilo de um dashboard de verdade (referência:
prints de um dashboard genérico), com dados reais (nada de mock):

- Sidebar com perfil, navegação e card de status do caixa.
- Donuts de faturamento do dia e cupons emitidos, comparados com a média dos
  6 dias anteriores.
- Gráfico de linha de faturamento por hora (com hover/crosshair).
- Barras horizontais de formas de pagamento.
- Lista de últimas vendas do dia.
- Gráfico de barras de vendas nos últimos 7 dias.
- Gráficos em SVG próprio (`src/features/home/charts.tsx`), sem depender de
  biblioteca nova — paleta de cores validada contra a superfície branca dos
  cards (skill de dataviz).
- Backend: novo endpoint `GET /api/vendas/resumo-semana` (totais por dia dos
  últimos 7 dias, preenchendo os dias sem venda pra não ter buraco no
  gráfico).

## 11. Tela de Login redesenhada

- Painel de marca à esquerda (escondido em telas pequenas) com blobs
  coloridos suaves puxando as cores da logo, headline e destaques reais do
  sistema (leitura por código de barras, sincronização com Protheus, acesso
  por usuário).
- Frase ajustada depois de feedback: o sistema é **exclusivo da Fort
  Fruit**, não um produto genérico — texto mudado de "feito pro seu dia a
  dia" pra "O sistema de vendas da Fort Fruit".
- Campo de senha com botão de mostrar/ocultar, spinner de carregamento no
  botão de entrar.

## 12. Integração de escrita PDV → Protheus (envio de pedido)

A parte mais longa e mais cheia de investigação da sessão.

### Tentativa 1 — API REST de terceiros (`4SALFORTFRUITORDERS`)

O Protheus da Fort Fruit expõe um conjunto de endpoints REST customizados
(prefixo `/4SAL*`) usados pelo produto de terceiros "Portal 4Sales"
(`fortfruit.4sales.com.br`). Tentamos integrar direto com
`POST /4SALFORTFRUITORDERS`:

- Autenticação: **Basic Auth** (usuário/senha do Protheus), não OAuth2 —
  descoberto por eliminação (`/api/oauth2/v12/token` não existe nesse
  servidor).
- A API sempre devolvia `{"message": "Operação do pedido deve ser Pré Venda
  ou Bilhete"}`, não importa o corpo enviado — testamos **30+ variações**
  de nome de campo, estrutura aninhada, array vs objeto, form-urlencoded,
  headers customizados, e até corpo vazio/`null`/inválido. A mensagem nunca
  mudou.
- Capturamos (via DevTools, com login real no portal) o payload exato que o
  `fortfruit.4sales.com.br` envia ao criar um pedido — só que esse payload
  vai pro **backend próprio do 4Sales** (que grava num MongoDB), não direto
  pro Protheus. A chamada real ao Protheus acontece depois, assíncrona, do
  lado do servidor deles — impossível de observar pelo navegador.
- Testamos esse payload real (exato) direto contra o Protheus de teste:
  mesmo erro. Conclusão: o endpoint de teste provavelmente está incompleto/
  não funcional, ou depende de uma credencial de integração diferente da
  de usuário comum.

### Tentativa 2 — Engenharia reversa via código-fonte AdvPL

O usuário conseguiu o fonte `RFATA03.PRW` (rotina de "Bilhete" da Fort
Fruit no Protheus — **não versionado neste repositório**, é proprietário e
o repo é público; ver `.gitignore`). Análise revelou:

- A função `U_FATA03I` (chamada internamente pela integração 4Sales quando
  já em modo automático) grava o cabeçalho e itens do Bilhete usando os
  campos nativos do Protheus (`Z4_CLIENTE`, `Z4_LOJA`, `Z4_VEND`,
  `Z4_COND`, etc. pra cabeçalho; `Z5_CODPRO`, `Z5_QTDE`, `Z5_PRECO` pra
  itens).
- A função `FFT03EF` (efetivar o Bilhete como Pedido de Venda de verdade)
  usa **`MSExecAuto("MATA410", aCabPV, aItemPV, 3)`** — a API oficial e
  documentada da TOTVS pra criar Pedido de Venda programaticamente. Isso
  deu o modelo completo de campos `C5_*` (cabeçalho) e `C6_*` (itens),
  incluindo a lógica de resolução de TES/CFOP.
- Testamos os nomes de campo reais (`Z4_CLIENTE`, etc.) direto contra
  `4SALFORTFRUITORDERS`: mesmo erro de sempre. Confirmou que a checagem
  "Pré Venda/Bilhete" acontece **antes** de chegar nessa lógica — em outro
  arquivo (o wrapper REST em si), que não temos.

### Decisão final — rotina própria via ExecAuto

Em vez de continuar dependente de um endpoint de terceiros sem
documentação, decidimos criar **nossa própria rotina** no Protheus, usando
o `MSExecAuto`/MATA410 diretamente (API oficial, documentada, sob nosso
controle total do contrato).

- **`protheus-source/U_PDVFORTFRUIT.prw`** — rascunho AdvPL completo e
  comentado (`User Function PDVFTPed`), modelado em cima do padrão real
  encontrado no `RFATA03.PRW`. Recebe um JSON simples definido por nós
  (cliente, loja, vendedor, condição de pagamento, tabela de preço, itens),
  monta os arrays `aCabPV`/`aItemPV` e chama `MSExecAuto`. Pontos marcados
  com `// CONFIRMAR:` precisam de validação de quem conhece a configuração
  fiscal da Fort Fruit no Protheus (empresa/filial, código da TES, tabela
  de preço, condição de pagamento padrão).
- **`server/protheus-rest.js`** — cliente HTTP (Basic Auth) + montagem do
  payload nesse novo contrato mais simples.
- **Rota `POST /api/vendas/:id/enviar-protheus`** (admin only) — busca a
  venda + itens do SQLite, monta o payload, chama o Protheus, guarda a
  resposta crua.
- **Botão "Enviar ao Protheus"** em Consultas (só visível pra admin) —
  mostra o resultado (sucesso ou erro cru do Protheus) inline, pra facilitar
  o diagnóstico enquanto o contrato ainda está sendo validado.
- Testado de ponta a ponta com uma venda local: o fluxo completo funciona
  (autentica, monta payload, envia, mostra resposta). Como o endpoint
  `PDVFORTFRUIT/pedido` ainda não foi publicado no lado do Protheus, a
  resposta hoje é um 404 limpo — esperado, confirma que a canalização está
  certa.

### Pendências desta integração

1. Alguém com acesso ao Protheus (TDS/Application Studio) precisa revisar
   `U_PDVFORTFRUIT.prw`, confirmar os pontos marcados, embrulhar a função
   num `WSMETHOD POST` (reaproveitando a estrutura de autenticação de um
   endpoint `/4SAL*` já funcionando) e publicar.
2. Depois de publicado, ajustar `PROTHEUS_REST_ENDPOINT_PEDIDO` no `.env`
   se o nome final do endpoint for diferente, e testar pelo botão em
   Consultas.
3. Definir os valores corretos de `PROTHEUS_COND_PAGAMENTO_PADRAO` e
   `PROTHEUS_TABELA_PRECO_PADRAO` no `.env` (hoje `015` é um palpite
   herdado do `sync-produtos.js`, mas precisa confirmação).

---

## Notas de segurança

- `.env` (credenciais reais — MSSQL e API REST do Protheus) está no
  `.gitignore` e nunca foi commitado.
- Arquivos `.prw`/`.PRW` na raiz do projeto (fontes internos do Protheus
  copiados aqui só pra consulta/engenharia reversa) são ignorados pelo git —
  o repositório `sopacrazy/pdv_ff` é **público**, e esse código contém
  lógica de negócio proprietária e referências a outras empresas que usam
  o mesmo Protheus. Só o que escrevemos do zero (`protheus-source/`) é
  versionado.
- Login admin padrão (`admin`/`admin123` se não configurado via `.env`)
  deve ser trocado assim que possível pelo próprio Painel Administrador.
