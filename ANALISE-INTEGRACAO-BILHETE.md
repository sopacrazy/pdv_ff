# Análise da integração PDV → Protheus por bilhete

Data: 22/09/2026. Análise estática do RFATA03.PRW, do cliente REST do PDV e do rascunho AdvPL; consulta autenticada ao catálogo REST informado pelo usuário. Nenhuma inclusão, exclusão, efetivação ou alteração de dados de negócio foi executada. A compilação do fonte local no RPO desse ambiente não foi comprovada.

## Conclusão

A integração é tecnicamente viável. O fonte já implementa uma entrada automática para bilhetes: `U_FATA03I("INCLUIR", aCabAuto, aIteAuto, @cMsg4Sales)`. A efetivação chama internamente `MSExecAuto({|x,y,z| Mata410(x,y,z)}, aCabPV, aItemPV, 3)`.

Criar somente SC5/SC6 pela MATA410 não equivale a criar o bilhete desta aplicação. Recomenda-se um endpoint próprio que adapte o JSON do PDV ao fluxo de bilhete existente, após corrigir suas dependências de interface, inicialização e tratamento de erros. A chamada acima identifica o ponto de integração; não é uma implementação pronta para executar isoladamente.

## REST consultado

Base: http://177.67.71.212:9990/rest/

A consulta inicial, inclusive com Basic Auth, retornou a tela de login com HTTP 200. A autenticação pelo formulário do catálogo, usando as credenciais já existentes no projeto, permitiu ler a listagem. Isso também mostra por que HTTP 200 isoladamente não comprova sucesso de negócio.

| Serviço | Evidência publicada | Interpretação |
|---|---|---|
| `/4SALFORTFRUITORDERS` | POST, sem esquema JSON no bloco do catálogo | Candidato da integração Fort Fruit; o contrato continua desconhecido. |
| `/4SALERPORDERS` | Documentação descreve impressão de pedidos ERP | Não identificado como inclusão de bilhete. |
| `/FBILHETE` | GET de bilhetes bloqueados/aprovados; parâmetros cempget/cfilget | Consulta de bilhetes. |
| `/GTPTICKETS` | Detalhes descrevem geração e exclusão em massa | O nome bilhete não comprova relação com SZ4/SZ5 ou RFATA03; depende do fonte/contrato. |
| `PDVFORTFRUIT` | Não encontrado no catálogo consultado | O endpoint próprio esperado pelo cliente não foi identificado como publicado. |

Foi inspecionado o catálogo e a documentação dos candidatos relevantes, não executadas todas as APIs. O RFATA03.PRW não contém declaração WSRESTFUL/WSMETHOD. Seu modo 4Sales não permite deduzir os nomes de propriedades do JSON recebido pelo endpoint externo. O histórico local registra tentativas anteriores rejeitadas, mas isso não prova que o serviço esteja defeituoso nem que precise de outra credencial.

## Fluxo confirmado no fonte

1. `FATA03I`, linha 252: recebe operação, cabeçalho, itens e mensagem por referência. O modo automático é ativado quando ambos os arrays estão preenchidos (linha 302).
2. Linhas 632–670: atribui os campos do cabeçalho às variáveis de memória e monta os itens conforme o SX3. Os elementos são pares campo/valor; não é o JSON público do 4Sales.
3. `RModelo3`, linha 2442: no modo automático chama `FT03VLD` diretamente, sem abrir o diálogo principal.
4. Linhas 842–1099: grava SZ5 e SZ4. O bilhete tem regras e registros próprios.
5. Linha 1122: chama `U_FFT03EF` no fluxo automático.
6. Linha 1687: a MATA410 inclui SC5/SC6. O número de C5_NUM é derivado de Z4_BILHETE.
7. Linha 1721: `MaLibDoFat` libera os itens. Linha 1868: `MaPvlNfs` gera documento série BIL, tratado pelo fonte como gerencial. Há validações de integridade e tratamentos financeiros; a linha 2188 usa FINA070 em ramo de baixa de título.
8. Linha 1132: marca Z4_DATPROC após retorno positivo da efetivação.

Portanto, a efetivação pode movimentar estoque e financeiro conforme regras, parâmetros e TES. Não é apenas o cadastro de um pedido nem comprova emissão de NF-e fiscal.

## Ajustes necessários para o endpoint

- **Inicialização:** várias variáveis Private/Public vêm de `RFATA03()`, que também abre o browse. O adaptador precisa inicializar o contexto necessário sem chamar a interface: áreas, empresa/filial, usuário, data, acumuladores, arrays e parâmetros. Dependências externas como RFATA19 e SZ4Seq não foram fornecidas.
- **Numeração:** revisar SX3 e U_SZ4Seq. A inclusão automática não deve usar o número do cupom como número do bilhete sem reserva e verificação. A reserva usada para cópia aparece no fonte; a inicialização completa da inclusão depende também do dicionário/chamador.
- **Campo obrigatório implícito:** linha 1086 acessa `Z4_XPED4SA` via AScan sem conferir se o campo foi enviado. A ausência pode causar acesso ao índice zero. Para PDV, definir identificação própria e compatibilidade com esse campo, sem inventar IDs do 4Sales.
- **Execução sem tela:** `MsAdvSize` ocorre antes do desvio do modo automático; há MessageBox na validação do armazém, RITMFALT com Aviso, MostraErro sem tratamento automático no ramo FINA070 e outras chamadas que precisam de revisão. Auditar também funções externas e pontos de entrada.
- **Vendedor e armazém:** linhas 733–752 podem sobrescrever valores recebidos usando o usuário Protheus autenticado. O usuário técnico da integração não deve alterar inadvertidamente o vendedor da venda.
- **Unidades e valores:** SZ5 calcula preço dividindo total por Z5_QTDE e, quando aplicável, por Z5_UNSVEN (linhas 872–882). Validar denominadores, conversão da segunda unidade, precisão, descontos e lote. O payload atual só leva quantidade e preço unitário.
- **Regras de negócio:** validar cliente/loja, crédito, tabela do cliente, vigência, preço mínimo, condição, armazém e segregação de determinados produtos. A TES varia no fonte; não reproduzir todos os casos com TES 510 fixa.
- **Transação e falhas:** há gravação de SZ4/SZ5 antes da MATA410 e o Begin Transaction próximo da efetivação está comentado. Verificar se o chamador original fornece transação; implementar atomicidade e recuperação compatíveis com as rotinas internas. A confirmação SX8 ocorre antes da efetivação. No caminho de falha, `_lRet` pode receber o retorno da exclusão/compensação, o que exige cuidado para não reportar inclusão bem-sucedida.
- **Reenvio e concorrência:** persistir chave única por empresa/filial/identificador da venda PDV, com proteção contra chamadas simultâneas. `DelPV`, chamada antes da MATA410, exclui registros de um pedido existente com mesmo número; `ZeraB2` ajusta valores negativos de custo/saldo. Esses efeitos tornam a numeração e a recuperação críticas.
- **Retorno:** emitir JSON com sucesso de negócio, identificação externa, número do bilhete e estado efetivado. Retornar erro estruturado e registrar logs por requisição, sem depender de arquivo compartilhado como MATA010.LOG.

## Problemas no caminho atual do PDV

`protheus-source/U_PDVFORTFRUIT.prw` é um rascunho para SC5/SC6: não grava SZ4/SZ5, não expõe WSMETHOD e não reproduz a efetivação completa. Não foi compilado/validado nesta análise.

`server/protheus-rest.js` considera `resposta.ok` como sucesso. Um HTTP 200 com `sucesso:false` ou HTML pode marcar indevidamente a venda como integrada em `server/api.js:513`. Deve validar conteúdo e resultado de negócio, além do HTTP.

Em `server/api.js:506`, o cliente é escolhido como o último registro atualizado da tabela clientes, não por vínculo explícito à venda. Confirmar a regra de cliente fixo ou corrigir a associação. O vendedor é localizado pelo nome do operador; uma chave estável evita ambiguidade. Não há proteção nessa rota contra reenvio de uma venda já integrada.

## Próxima implementação e homologação

Criar POST próprio para bilhetes, reaproveitando o modo automático com as correções acima. Alternativamente, obter o fonte/contrato do `/4SALFORTFRUITORDERS` e de seu adaptador, que pode conter a inicialização faltante. Confirmar empresa/filial do ambiente teste, dicionários SZ4/SZ5, parâmetros e dependências compiladas antes do teste de escrita.

Homologar uma venda simples; conferir SZ4/SZ5, pedido, documento BIL, estoque/financeiro e totais. Depois testar segunda unidade, falha de validação, falha durante efetivação, repetição da mesma venda e duas requisições simultâneas. Só marcar INTEGRADO após confirmação do estado final esperado.

Referência oficial: [TOTVS — MATA410 via ExecAuto](https://tdn.totvs.com/pages/viewpage.action?pageId=6784012). A documentação confirma a inclusão de pedidos SC5/SC6 com operação 3; as regras de bilhete descritas aqui foram verificadas no fonte local.
