# Teste do JSON do fornecedor dentro do PDV

Na tela Consultas, um administrador encontra **Teste de bilhete · 4Sales**. Clique em Preparar teste para conferir pedido, cliente, empresa/filial, data, total, JSON e cabeçalhos. O botão Enviar bilhete à base de teste faz a requisição real.

O servidor lê `server/data/4sales-teste.json`, cópia local do arquivo recebido. Esse diretório é ignorado pelo Git; o cadastro do cliente e demais dados do exemplo não foram adicionados aos fontes versionados. Para outra instalação, copiar o arquivo para esse caminho e reiniciar a API após atualizar os fontes.

O envio usa somente o objeto `body`, Basic Auth do `.env`, TenantId do arquivo, x-erp-module FAT e Accept-Charset UTF8. A URL é fixa na base teste informada: `http://177.67.71.212:9990/rest/4SALFORTFRUITORDERS`. Não aceita outro destino nem encaminha credenciais contidas no arquivo.

O serviço do fornecedor pode efetivar o bilhete e movimentar estoque/financeiro. É diferente do endpoint próprio PDVFORTFRUIT/pedido, que permanece disponível no código com seu contrato anterior. Este painel não marca nenhuma venda local como integrada e não interpreta HTTP 200 como confirmação de inclusão.

As tentativas ficam na tabela local `testes_4sales`, identificadas por tenant e ID do pedido. A reserva ocorre antes do envio; chamadas concorrentes ou repetidas são bloqueadas, inclusive após reinício. Consultar resultado recupera a resposta salva. Timeout, interrupção ou HTTP 500 exigem conferir o Protheus antes de repetir; não há retry nem botão de desbloqueio automático. O controle local não consegue detectar envios anteriores feitos pelo Postman ou pelo fornecedor.

Teste sem rede: `node --test server/protheus-4sales-test.test.js server/protheus-rest.test.js`.


## Envio das vendas do PDV

Consultas → botão de envio: cliente YDOVT3/01, tabela 015, empresa 14/filial 01, armazém 01 e PIX 033. O operador precisa de vendedor vinculado em Usuários. Demais pagamentos e descontos aguardam homologação. O endpoint 4Sales efetiva o bilhete (EFE), inclusive seus efeitos no ERP.

Antes do POST, o servidor consulta cliente e preços na base teste e bloqueia diferenças em relação ao cupom local. Não altera preços nem substitui a sincronização SQL de produção. A adaptação do JSON a vendas locais ainda precisa de um primeiro teste real; o sucesso anterior foi do exemplo 645, bilhete CAQZIM, que não deve ser reenviado.

Estados persistidos: LOCAL, PREPARANDO, CONFERIR e INTEGRADO. Toda tentativa remota mantém payload e resposta no SQLite; só o retorno EFE com empresa/filial e idWeb correspondentes confirma integração. Falhas e timeouts não permitem reenvio automático. Conferir manualmente no Protheus antes de qualquer liberação. Não há cancelamento remoto nem rotina de reconciliação automática.
