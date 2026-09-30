# Atualizações do PDV Fort Fruit

O desktop consulta as releases públicas de `sopacrazy/pdv_ff` ao abrir, a cada quatro horas e pelo menu **Ajuda → Verificar atualizações agora**. Baixa a versão nova e oferece a instalação ao reiniciar. Finalize ou cancele o cupom aberto antes de fechar o sistema. Bancos, usuários e vendas ficam em `%APPDATA%\react-example\data` e não são substituídos pelo instalador.

A partir de 0.1.15, a configuração do Protheus fica em `%APPDATA%\react-example\config\.env`. O instalador copia o `.env` de uma instalação anterior antes de removê-la, se a configuração externa ainda não existir. Não sobrescreve um arquivo externo existente. Instalações novas devem receber esse arquivo localmente, conforme `.env.example`. O pacote publicado não inclui senhas, tokens ou bancos de dados. `PDV_ENV_FILE` permite definir outro arquivo explicitamente.

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
