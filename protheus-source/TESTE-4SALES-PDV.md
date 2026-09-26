# Teste do JSON do fornecedor dentro do PDV

Na tela Consultas, um administrador encontra **Teste de bilhete · 4Sales**. Clique em Preparar teste para conferir pedido, cliente, empresa/filial, data, total, JSON e cabeçalhos. O botão Enviar bilhete à base de teste faz a requisição real.

O servidor lê `server/data/4sales-teste.json`, cópia local do arquivo recebido. Esse diretório é ignorado pelo Git; o cadastro do cliente e demais dados do exemplo não foram adicionados aos fontes versionados. Para outra instalação, copiar o arquivo para esse caminho e reiniciar a API após atualizar os fontes.

O envio usa somente o objeto `body`, Basic Auth do `.env`, TenantId do arquivo, x-erp-module FAT e Accept-Charset UTF8. A URL é fixa na base teste informada: `http://177.67.71.212:9990/rest/4SALFORTFRUITORDERS`. Não aceita outro destino nem encaminha credenciais contidas no arquivo.

O serviço do fornecedor pode efetivar o bilhete e movimentar estoque/financeiro. É diferente do endpoint próprio PDVFORTFRUIT/pedido, que permanece disponível no código com seu contrato anterior. Este painel não marca nenhuma venda local como integrada e não interpreta HTTP 200 como confirmação de inclusão.

As tentativas ficam na tabela local `testes_4sales`, identificadas por tenant e ID do pedido. A reserva ocorre antes do envio; chamadas concorrentes ou repetidas são bloqueadas, inclusive após reinício. Consultar resultado recupera a resposta salva. Timeout, interrupção ou HTTP 500 exigem conferir o Protheus antes de repetir; não há retry nem botão de desbloqueio automático. O controle local não consegue detectar envios anteriores feitos pelo Postman ou pelo fornecedor.

Teste sem rede: `node --test server/protheus-4sales-test.test.js server/protheus-rest.test.js`.


## Envio das vendas do PDV

Consultas → botão de envio: cliente YDOVT3/01, tabela 015, empresa 14/filial 01 e armazém 01. O endpoint 4Sales efetiva o bilhete (EFE), inclusive seus efeitos no ERP.

### Como o vendedor é realmente definido

O campo `seller` do JSON não é suficiente. Na inclusão, `RFATA03.PRW` abre a SA3 no índice 7 e procura `A3_FILIAL + A3_CODUSR` usando `__cUserID`, o usuário autenticado na requisição REST. Quando encontra, sobrescreve `Z4_VEND`, `Z4_NOMVEN` e, quando preenchido, o armazém com os dados da SA3.

Há dois identificadores diferentes no cadastro do Protheus:

- `SYS_USR.USR_CODIGO`: login usado no Basic Auth da REST;
- `SYS_USR.USR_ID`: identificador interno gravado em `SA3.A3_CODUSR`.

Por isso, em Administração → Usuários, deve-se selecionar o login Protheus, informar a senha REST e escolher somente um vendedor cuja `SA3.A3_CODUSR` corresponda ao `SYS_USR.USR_ID` desse login. A sincronização local traz os dois campos e a tela filtra/valida esse vínculo. O POST da venda usa as credenciais individuais cifradas do operador; as credenciais fixas `PROTHEUS_REST_*` continuam apenas para consultas técnicas e para o painel isolado de teste.

Antes de montar cada venda, o servidor chama `GET /api/tgv/sellers/codeuser` com o Basic Auth individual. Esse endpoint, exposto pelo próprio ambiente, devolve `branchid`, `code`, `name` e `userid` do vendedor ligado ao usuário. O `seller` do JSON passa a ser montado com esse retorno, evitando divergência entre o cadastro local e o vendedor que o RFATA03 aplicará.

Cada venda nova também guarda `usuario_id`, obtido da sessão autenticada. A fila usa essa chave estável para recuperar as credenciais corretas; `operador` permanece apenas como nome de exibição e como compatibilidade para vendas antigas.

Antes do POST, o servidor consulta cliente e preços na base teste e bloqueia diferenças em relação ao cupom local. Não altera preços nem substitui a sincronização SQL de produção. A adaptação do JSON a vendas locais ainda precisa de um primeiro teste real; o sucesso anterior foi do exemplo 645, bilhete CAQZIM, que não deve ser reenviado.

Estados persistidos: LOCAL, PREPARANDO, CONFERIR e INTEGRADO. Toda tentativa remota mantém payload e resposta no SQLite; só o retorno EFE com empresa/filial e idWeb correspondentes confirma integração. A fila retenta o mesmo `idWeb` após o intervalo de segurança; o endpoint observado trata esse identificador de forma idempotente. Não há cancelamento remoto nem rotina de reconciliação independente.
