# Atualizações do PDV Fort Fruit

## Arredondamento de vendas fracionadas — versão 0.1.21

O total das novas vendas PDV é a soma dos valores já arredondados de cada item. Para vendas locais antigas ainda pendentes, a fila corrige diferenças de centavos somente quando elas correspondem ao cálculo anterior; o total original fica registrado e aparece em Consultas. Após instalar na máquina com vendas pendentes, confira o resultado da integração em Consultas.

## Correção da abertura e envio do PDV — versão 0.1.20

O cadastro REST do cliente padrão pode omitir `paymentForm`. As vendas do PDV passam a enviar a condição de pagamento sem exigir os campos de forma do cliente; o Bilhete continua usando `A1_FORMA`. A fila preserva os identificadores das vendas pendentes e as retenta automaticamente. Se a janela do Electron falhar ao carregar, o aplicativo faz uma nova tentativa e mostra o erro em vez de permanecer na tela inicial.

## Envio do PDV pela REST — versão 0.1.19

Vendas do PDV usam a forma de pagamento retornada pelo cadastro REST do cliente e não precisam abrir conexão SQL Server para preparar ou reenviar o pedido. O Bilhete continua consultando `A1_FORMA` no SQL Server, pois a forma da REST pode divergir desse cadastro. Vendas locais pendentes permanecem na fila e são retomadas automaticamente.

## Consulta de vendas por período — versão 0.1.18

Em **Consultas**, selecione **Período** e informe as datas inicial e final. A lista inclui as vendas dos dois dias escolhidos e mostra a data de operação de cada registro. Os indicadores de quantidade, total vendido e ticket médio acompanham o período. **Dia de operação** continua sendo a opção padrão. O intervalo é validado antes da consulta.

## Conferência das exclusões no Protheus

O servidor confere a SZ4140 na inicialização e a cada cinco minutos, incluindo registros com `D_E_L_E_T_='*'`. A correspondência exige filial, número do bilhete e ID da integração. A conferência percorre até mil registros locais por ciclo, priorizando os menos recentemente conferidos. Em Consultas, **Conferir exclusões** permite antecipar a verificação.

Uma exclusão confirmada marca o registro local como **Excluído no Protheus**, bloqueia reenvio e confirmação manual e retira a venda dos totais e indicadores. Valores, itens e respostas da integração permanecem no histórico; a data registrada indica quando o PDV detectou a exclusão. Registro ausente, correspondência divergente ou falha de conexão não confirma exclusão. Se o mesmo bilhete for restaurado no ERP, o PDV atualiza sua situação sem enviar uma nova venda. Toda a consulta ao Protheus usa somente SELECT.

O desktop consulta as releases públicas de `sopacrazy/pdv_ff` ao abrir, a cada quatro horas e pelo menu **Ajuda → Verificar atualizações agora**. Baixa a versão nova e oferece a instalação ao reiniciar. Finalize ou cancele o cupom aberto antes de fechar o sistema. Bancos, usuários e vendas ficam em `%APPDATA%\react-example\data` e não são substituídos pelo instalador.

A partir de 0.1.15, a configuração do Protheus fica em `%APPDATA%\react-example\config\.env`. O instalador copia o `.env` de uma instalação anterior antes de removê-la, se a configuração externa ainda não existir. Não sobrescreve um arquivo externo existente. Na 0.1.16, a primeira abertura permite importar o `.env` já configurado, transferido localmente da máquina principal. O servidor só inicia depois de validar o arquivo; fechar essa configuração encerra o aplicativo. O pacote publicado não inclui senhas, tokens ou bancos de dados. `PDV_ENV_FILE` permite definir outro arquivo explicitamente.

Versões anteriores podem estar com o atualizador desativado por exigir token de um repositório privado. Nesse caso, instale a 0.1.15 manualmente uma vez; depois, o menu e a consulta automática funcionam sem token.

Os tablets recebem o bundle web do PC configurado no aplicativo, ao entrar em segundo plano. O instalador Windows inclui `dist-bundle/app-bundle.zip` e o servidor anuncia a versão pelo endpoint `/api/app/atualizacao`. Não é necessário reinstalar o APK para mudanças de React/CSS. Mudanças nativas exigem um APK assinado com versão Android maior.

Para preparar uma release, alinhe `package.json`, as duas versões raiz do `package-lock.json` e a versão Android. Rode a verificação TypeScript, os testes locais com SQL/HTTP simulados e o build. Gere o instalador em um diretório novo e confira que não contém `.env`, `gh-token.txt` nem `server/data`. Publique o instalador, seu `.blockmap` e `latest.yml` juntos na mesma release; o nome do instalador publicado precisa coincidir com `latest.yml`. Publique primeiro como rascunho e só disponibilize após conferir os uploads e hashes. Não execute o servidor com fila nem envie vendas para validar uma release.

Comandos: `npm run build`, `npx electron-builder --win nsis --x64 --publish never --config.directories.output=release/v0.1.15` (troque a pasta pela versão preparada) e `node scripts/verificar-release.mjs`. Depois do commit e envio dos fontes ao GitHub, `node scripts/publicar-release.mjs` prepara o rascunho e confere os três uploads. `node scripts/publicar-release.mjs --publicar` disponibiliza a release completa. A autenticação de publicação vem do desenvolvedor, via `GH_TOKEN`/`GITHUB_TOKEN` ou gerenciador de credenciais Git; nunca é embutida no pacote.

## Versão 0.1.15

- Integração REST pela conta principal, mantendo o vendedor de cada operador.
- Consultas e integração seguem o ambiente configurado no servidor.
- Forma de pagamento do bilhete vem de `A1_FORMA`; condição de pagamento continua em `A1_COND`.
- Preço da segunda unidade por tabela do cliente, exibido com quatro casas decimais.
- Busca de produtos do bilhete exibe correspondências por descrição, inclusive sem estoque.
- Código do produto aparece uma vez no PDV desktop.
- Atualizador público sem token, configuração externa preservada e bundle dos tablets incluído no instalador.

Dados antigos de teste foram removidos somente na migração local autorizada. A atualização de versão não zera o SQLite nem modifica bilhetes já integrados.
