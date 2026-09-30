# Teste do JSON do fornecedor dentro do PDV

Na tela Consultas, um administrador encontra **Teste de bilhete · 4Sales**. Clique em Preparar teste para conferir pedido, cliente, empresa/filial, data, total, JSON e cabeçalhos. O botão Enviar bilhete à base de teste faz a requisição real.

O servidor lê `server/data/4sales-teste.json`, cópia local do arquivo recebido. Esse diretório é ignorado pelo Git; o cadastro do cliente e demais dados do exemplo não foram adicionados aos fontes versionados. Para outra instalação, copiar o arquivo para esse caminho e reiniciar a API após atualizar os fontes.

O envio usa somente o objeto `body`, Basic Auth do `.env`, TenantId do arquivo, x-erp-module FAT e Accept-Charset UTF8. A URL é fixa na base teste informada: `http://177.67.71.212:9990/rest/4SALFORTFRUITORDERS`. Não aceita outro destino nem encaminha credenciais contidas no arquivo.

O serviço do fornecedor pode efetivar o bilhete e movimentar estoque/financeiro. É diferente do endpoint próprio PDVFORTFRUIT/pedido, que permanece disponível no código com seu contrato anterior. Este painel não marca nenhuma venda local como integrada e não interpreta HTTP 200 como confirmação de inclusão.

As tentativas ficam na tabela local `testes_4sales`, identificadas por tenant e ID do pedido. A reserva ocorre antes do envio; chamadas concorrentes ou repetidas são bloqueadas, inclusive após reinício. Consultar resultado recupera a resposta salva. Timeout, interrupção ou HTTP 500 exigem conferir o Protheus antes de repetir; não há retry nem botão de desbloqueio automático. O controle local não consegue detectar envios anteriores feitos pelo Postman ou pelo fornecedor.

Teste sem rede: `node --test server/protheus-4sales-test.test.js server/protheus-rest.test.js`.


## Envio das vendas do PDV

Consultas → botão de envio: cliente YDOVT3/01, tabela 015, empresa 14/filial 01 e armazém 01. O endpoint 4Sales efetiva o bilhete (EFE), inclusive seus efeitos no ERP.

### Integração pela conta REST principal

A integração atual usa somente `PROTHEUS_REST_USER` e `PROTHEUS_REST_PASSWORD` do servidor. Administração → Usuários mantém o vínculo comercial `SYS_USR.USR_ID → SA3.A3_CODUSR`; o operador informa apenas sua senha do PDV. Localizar vendedor usa o cadastro sincronizado, sem autenticar cada funcionário no REST. Minha conta não solicita senha do Protheus; a rota antiga de cadastramento de senha responde HTTP 410.

A conta técnica precisa estar sem vínculo SA3 na filial 01. Na inclusão, RFATA03.PRW procura `A3_FILIAL + A3_CODUSR` por `__cUserID`; se encontrar, substitui Z4_VEND pelo vendedor da conta REST. Sem esse vínculo, o fluxo automático mantém o vendedor recebido em `seller`. Antes do envio, `conta-rest-principal.js` confirma essa condição por GET `/api/tgv/sellers/codeuser`; respostas inesperadas ou conta vinculada bloqueiam o POST. A validação é compartilhada por até cinco minutos e invalidada quando as credenciais mudam. O botão Verificar conta principal em Administração → Usuários mostra o resultado ao administrador.

Cada venda guarda usuário_id, vendedor_filial, vendedor_codigo, vendedor_nome e protheus_usr_id obtidos da sessão/cadastro no servidor. A migração 6 recupera os dados de vendas antigas, priorizando o vendedor do payload quando já houve envio. A fila usa esses dados mesmo depois de alteração ou exclusão do operador. O número da integração pertence à venda, não à conta REST; IDs de tentativas anteriores são preservados.

O servidor serializa os envios diretos, manuais e automáticos: um envio de venda por vez. A fila evita agendar a mesma venda duas vezes e mantém a reserva persistida no SQLite. Várias instalações com servidores separados têm filas independentes; clientes de uma operação central devem acessar a mesma instância do servidor PDV.

### Homologação em DESENV — 30/09/2026

Conta REST ADRIANO autenticada, sem vendedor retornado na filial 01. Dois bilhetes de R$ 18,00, uma unidade de 100.074 cada, cliente à vista e condição 033, identificados como HOMOLOGACAO CONTA REST PDV:

| Bilhete | Vendedor enviado | Z4_VEND conferido | C5_VEND1 conferido |
| --- | --- | --- | --- |
| CAQZOY | 000004 | 000004 | 000004 |
| CAQZP0 | 000007 | 000007 | 000007 |

O REST confirmou EFE e a consulta SQL DESENV confirmou os vendedores de ambos os documentos. O bilhete anterior de controle conferiu por número e idWeb antes das inclusões. Nenhum vínculo SA3 foi alterado.

Z4_XPED4SA tem limite de 30 caracteres neste ambiente: o UUID de 36 caracteres do primeiro teste foi truncado, e foi conferido pelo número retornado e prefixo do ID. O segundo teste usou 27 caracteres. Os IDs normais do PDV também têm 27 caracteres; não substituir por UUIDs longos. O registro de tentativas em server/data/homologacao-rest-principal-20260930.json contém payloads e resultados, sem senhas. O script server/scripts/homologar-conta-rest-principal.js preserva as tentativas e não repete documentos já enviados; `--verificar` faz somente conferência. É uma homologação específica dessa base e desses registros.

Antes do POST, cliente e preços continuam sendo consultados na base teste. A homologação acima comprova a separação entre conta REST e vendedor no endpoint atual.

### Mudança para produção — 30/09/2026

Todas as URLs de consulta e de envio 4Sales agora derivam de `PROTHEUS_REST_URL`; não há destino de teste fixo no código. O banco SQL atual é `PROTHEUS11`, configurado no `.env`. A preparação da base local usa apenas SELECT e GET e não importa a rotina de envio nem o servidor com fila automática. As vendas, itens e sessões antigos são removidos; os logins PDV e a configuração do caixa são preservados, e vínculos de vendedor só são reconstruídos se forem únicos no cadastro de produção. Backups consistentes dos dois SQLite ficam em `server/data/backup-teste-*`.

Neste ambiente, GET `/api/tgv/products` responde 403 para a conta técnica sem vendedor, embora as demais consultas funcionem. A sincronização lê o catálogo SB1140 pelo SQL já configurado quando esse endpoint responde 403, preservando unidades e exclusões. Falhas 401, de rede ou de servidor continuam sendo erros, sem mascarar a configuração. A origem SQL é registrada em `produtos_fonte`; ao voltar para REST, a primeira consulta é completa para evitar combinar marcadores de origens distintas. Preços, estoque e clientes continuam sendo carregados por GET na REST de produção. Nenhum bilhete de homologação foi enviado para produção durante esta migração.

Estados persistidos: LOCAL, PREPARANDO, CONFERIR e INTEGRADO. Toda tentativa remota mantém payload e resposta no SQLite; só o retorno EFE com empresa/filial e idWeb correspondentes confirma integração. A fila retenta o mesmo `idWeb` após o intervalo de segurança; o endpoint observado trata esse identificador de forma idempotente. Não há cancelamento remoto nem rotina de reconciliação independente.

### Forma de pagamento do cliente — A1_FORMA

`A1_COND` continua definindo `paymentType` (condição/prazo); `A1_FORMA` define `paymentMethods` e `paymentForm`, tanto no pedido quanto no cliente, para o campo `Z4_FORMA`. O valor DEP fixo foi removido. A REST de clientes de produção não retorna `A1_FORMA`; antes de preparar cada novo envio, `forma-pagamento-cliente.js` consulta SA1140 por filial 01, código e loja, com parâmetros SQL, e obtém a descrição na SX5140, tabela 24. Cadastro ausente, duplicado, forma vazia ou SQL indisponível impedem a preparação, sem assumir DEP.

Cliente 374093/01 conferido por SELECT: A1_FORMA BOL e A1_COND 008. A preparação com GETs reais preservou BOL nos campos da forma e 008 na condição, sem chamar o envio ou gravar uma venda. Testes locais usam SQL e HTTP simulados. Documentos já integrados e payloads de tentativas anteriores não são alterados por esta correção.
