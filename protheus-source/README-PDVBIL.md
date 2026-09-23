# Bilhete próprio do PDV — etapa de gravação

Implementação baseada na separação entre FATA03I (SZ4/SZ5) e FFT03EF (pedido/efetivação) do RFATA03.PRW. Escopo escolhido: incluir cabeçalho/itens do bilhete e pedido MATA410; efetivar posteriormente. O RFATA03 original não foi alterado.

## Arquivos e resultado

- `PDVREST.prw`: GET `/PDVFORTFRUIT/status` e POST `/PDVFORTFRUIT/pedido`.
- `U_PDVFORTFRUIT.prw`: função U_PDVFTPed; valida JSON/cadastros, reserva número, grava SZ4/SZ5 e chama MSExecAuto/MATA410 (operação 3) em transação.
- `pedido-exemplo.json`: modelo para Postman; códigos TESTE são placeholders, não cadastros reais. Empresa/filial/condição/tabela também precisam ser conferidas.
- `PDV.postman_collection.json`: coleção importável, com autenticação e variáveis vazias para preencher localmente. Não salvar credenciais no repositório.

O número do pedido é o número do bilhete. `Z4_DATPROC` fica vazio. Não há chamada de liberação, documento série BIL, NF-e, baixa financeira, DelPV ou ZeraB2. Retorno `BILHETE_E_PEDIDO_GRAVADOS` confirma esta etapa, não efetivação da venda. Pontos de entrada da MATA410 devem ser homologados para não antecipar os movimentos; a rotina rejeita liberação SC9/faturamento detectados após a inclusão.

## Implantação no Protheus de teste

1. Criar no dicionário/SIGACFG e aplicar fisicamente em SZ4: `Z4_XPDVID` C(36), identificador único da venda PDV; `Z4_XPDVHS` C(32), hash do corpo original. Não reutilizar `Z4_XPED4SA`. O serviço recusa escrita sem os campos. Planejar índice de consulta `Z4_FILIAL+Z4_XPDVID` para volume; a versão inicial faz varredura, protegida pelo semáforo, sem assumir número de ordem SIX. Não criar índice único simples sobre registros legados com ID vazio.
2. Configurar parâmetro caractere `MV_PDVTS` com a TES de venda normal validada para a empresa/filial. Não há TES 510 presumida nem fallback quando o cadastro falta.
3. Garantir U_SZ4Seq no RPO e revisar seu fonte: é a mesma dependência usada pelo RFATA03, mas não foi fornecida. Confirmar que reserva número exclusivo e é compatível com ConfirmSX8/RollBackSX8. Não trocar por sequência independente de SC5, pois o número é compartilhado com os bilhetes existentes.
4. Compilar ambos os fontes com os includes da release instalada e publicar/recarregar REST conforme a infraestrutura. Não há compilador/RPO disponível neste workspace; a compilação e a execução AdvPL NÃO foram verificadas aqui.
5. Preparar empresa/filial e tabelas pelo ambiente REST; autenticar usuário autorizado à MATA410. A API não chama RpcSetEnv/RpcClearEnv e rejeita JSON de outro contexto. Confirmar mecanismo de seleção de ambiente/tenant usado nesse AppServer. Não presumir que enviar empresa/filial no JSON troca o ambiente.
6. Homologar LockByName/UnlockByName com a mesma SpecialKey e infraestrutura de locks em todos os AppServers. O lock é por empresa/filial e serializa apenas esta API. Usuários do bilhete original dependem do sequenciador compartilhado; o lock do PDV não os serializa.
7. Conferir SX3 e ordens 1 dos cadastros/SZ4/SZ5/SC5/SC6/SC9/SF2/SE1 e ordem 3 de SD2. O serviço espera aliases abertos sem filtros. Os campos Z4/Z5 gravados são conferidos contra DbStruct antes de gravar; os campos de segunda unidade existentes no fonte principal são necessários.

GET status informa publicação e contexto, não comprova que dicionário/TES/ExecAuto estão prontos.

## Postman

Usar Basic Auth, credenciais locais e URL base `http://177.67.71.212:9990/rest`.

1. GET `{{baseUrl}}/PDVFORTFRUIT/status`, Body none. Conferir empresa e filial.
2. POST `{{baseUrl}}/PDVFORTFRUIT/pedido`, Body raw / JSON e Content-Type application/json. Copiar pedido-exemplo.json e substituir data, cadastros e valores por dados válidos de teste. A data é AAAAMMDD; valores em reais, não centavos. A quantidade é na primeira unidade de medida. O servidor calcula a segunda unidade pelo SB1.

Primeira inclusão: HTTP 201 com `sucesso:true`, `bilhete`, `pedido`, `idVendaPdv`, `etapa:"BILHETE_E_PEDIDO_GRAVADOS"`, `reenvio:false`. Reenvio do mesmo corpo e ID: HTTP 200, mesmo número e `reenvio:true`. Mesmo ID com corpo diferente: HTTP 409. Preservar bytes do JSON em retries (inclusive ordem/espaços); o hash é do corpo recebido. Ele compara o conteúdo, não é mecanismo de autenticação.

Se houver timeout, não gerar outro ID. Reenviar o mesmo corpo para reconciliar. Caso o pedido tenha sido removido/alterado por processos posteriores, reconciliar manualmente; não há recriação automática. Exclusão física/lógica do bilhete pode remover a evidência de idempotência: não apagar bilhetes integrados para permitir reenvios.

## Regras e limites desta versão

- Não é uma cópia integral de todas as regras comerciais do RFATA03. Implementa venda normal sem efetivação; operações especiais, exceções por empresa, promoções e aprovações precisam de extensão explícita/homologação.
- Até 99 itens, datas válidas e não futuras, bloqueios de fechamento, cliente/vendedor/produto ativos, armazém, condição, tabela do cliente ativa/vigente, preços mínimos de tabela, totais consistentes, lote quando exigido, tipos/tamanhos/precisão SX3.
- Rejeita condição iniciada em 9, preço <= 0,10, produtos MC e produtos do parâmetro FF_BASQUET. A lista adicional de basquetas/regras particulares do RFATA03 não é reproduzida: homologar o catálogo permitido para o PDV. Transferências, bonificação e operações fiscais especiais não pertencem a este contrato.
- Crédito, saldo disponível, promoções e autorizações específicas devem ser revalidados pelo processo posterior e pontos de entrada homologados. Não chamar as funções de tela/credito do RFATA03 cegamente dentro do REST.
- Não aceita quantidade secundária arbitrária de balança. Se o PDV vender em segunda unidade, o adaptador deverá converter explicitamente antes do envio; homologar produtos fracionados e arredondamentos.
- `RecLock` de SZ4/SZ5 não executa automaticamente validações/gatilhos SX3. Customizações adicionais precisam ser revisadas. O ExecAuto executa as regras padrão e pontos de entrada da MATA410.
- A efetivação posterior pelo RFATA03 precisa ser testada com SZ4 pendente E SC5 existente. FFT03EF contém DelPV e recriação do pedido; não disparar enquanto esta API está gravando. Nenhuma efetivação foi executada neste trabalho.

## Cliente Node do PDV

Preencher `PROTHEUS_PDV_EMPRESA`, `PROTHEUS_PDV_FILIAL`, `PROTHEUS_PDV_ARMAZEM`, condição e tabela; não foram alteradas credenciais/.env reais. A resposta só marca integração quando HTTP e JSON confirmam ID, bilhete, pedido e etapa. HTML/HTTP 200 com falha é rejeitado. Timeout de 60s sem retry automático.

A montagem agora envia ID estável da venda, data_local, total e total de cada item. Descontos são bloqueados até homologar rateio/preço líquido. A condição configurada é fixa: conferir seu vínculo com a forma de pagamento antes da operação real. O cliente padrão continua sendo o último sincronizado (comportamento anterior da aplicação); não confundir CPF/nome impresso no cupom com código/loja Protheus. Confirmar esse modelo de cliente fixo e vínculo do operador/vendedor antes de usar.

## Homologação necessária

1. Inclusão válida: conferir SZ4/SZ5 e SC5/SC6, códigos, itens, preços/unidades e totais; DATPROC vazio e ausência de SC9/documento BIL/financeiro novos.
2. Repetir mesmo corpo; confirmar apenas um bilhete. Testar mesmo ID com total diferente e chamadas simultâneas, inclusive entre AppServers.
3. Forçar erro MATA410 e falha de gravação SZ5; conferir rollback de todas as tabelas e comportamento do sequenciador.
4. Testar cliente/produto inválido, lote obrigatório, tabela vencida, preço abaixo da tabela, segunda unidade e divisão/arredondamento.
5. Efetivar um bilhete pelo fluxo principal e validar que não houve duplicação de pedido, documento ou financeiro. Testar reenvio após esse processamento.

Teste local do cliente HTTP (mock, sem rede): `node --test server/protheus-rest.test.js`.

Referências: [MATA410/ExecAuto](https://tdn.totvs.com/pages/viewpage.action?pageId=6784012), [WSMETHOD](https://tdn.totvs.com/pages/releaseview.action?pageId=75269436), [variáveis/log ExecAuto](https://tdn.totvs.com/pages/viewpage.action?pageId=566489232).
