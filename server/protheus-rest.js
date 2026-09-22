import 'dotenv/config';

// Integração de escrita PDV -> Protheus via API REST (não é a sincronização SQL somente-leitura
// dos outros arquivos server/sync-*.js).
//
// Histórico: a primeira tentativa foi contra o endpoint de terceiros "4SALFORTFRUITORDERS" (do
// produto "Portal 4Sales"), mas o contrato JSON não é documentado e não foi possível descobri-lo
// por engenharia reversa (testamos dezenas de variações, incluindo um payload real capturado do
// portal em produção — nada passou da validação inicial do Protheus).
//
// Por isso pivotamos pra uma rotina PRÓPRIA no Protheus, usando o MSExecAuto do MATA410 (API
// oficial/documentada da TOTVS para criar Pedido de Venda programaticamente) em vez de depender
// de um endpoint de terceiros sem documentação. O rascunho AdvPL dessa rotina está em
// protheus-source/U_PDVFORTFRUIT.prw — o contrato do JSON abaixo é o mesmo definido lá.
//
// PROTHEUS_REST_ENDPOINT_PEDIDO (.env) define o path do endpoint, porque o nome final depende de
// como o time Protheus registrar o WSMETHOD (ex.: "PDVFORTFRUIT/pedido"). Sem isso configurado,
// cai num valor placeholder que decerto ainda não existe no servidor.
const ENDPOINT_PADRAO = 'PDVFORTFRUIT/pedido';

function getConfig() {
  return {
    baseUrl: process.env.PROTHEUS_REST_URL,
    usuario: process.env.PROTHEUS_REST_USER,
    senha: process.env.PROTHEUS_REST_PASSWORD,
    endpointPedido: process.env.PROTHEUS_REST_ENDPOINT_PEDIDO || ENDPOINT_PADRAO,
    condicaoPagamentoPadrao: process.env.PROTHEUS_COND_PAGAMENTO_PADRAO || '',
    tabelaPrecoPadrao: process.env.PROTHEUS_TABELA_PRECO_PADRAO || '015', // mesma tabela usada em sync-produtos.js
  };
}

function autenticacaoBasica(usuario, senha) {
  return 'Basic ' + Buffer.from(`${usuario}:${senha}`).toString('base64');
}

function paraReais(centavos) {
  return Math.round(centavos || 0) / 100;
}

export function montarPayloadVenda({ venda, itens, cliente, vendedorUsuario }) {
  const { condicaoPagamentoPadrao, tabelaPrecoPadrao } = getConfig();

  return {
    cliente: cliente?.codigo || null,
    loja: cliente?.loja || null,
    vendedor: vendedorUsuario?.protheus_vend_codigo || null,
    condicaoPagamento: condicaoPagamentoPadrao || null, // PROTHEUS_COND_PAGAMENTO_PADRAO ainda não confirmado
    tabelaPreco: tabelaPrecoPadrao,
    numeroCupomPdv: venda.numero_cupom,
    observacao: `Venda PDV Loja ${venda.loja} - Cupom ${venda.numero_cupom}`,
    itens: itens.map((item) => ({
      produto: item.codigo_produto,
      quantidade: item.quantidade,
      valorUnitario: paraReais(item.valor_unitario),
    })),
  };
}

export async function enviarVendaProtheus(payload) {
  const { baseUrl, usuario, senha, endpointPedido } = getConfig();
  if (!baseUrl || !usuario || !senha) {
    return { sucesso: false, erro: 'Credenciais da API REST do Protheus não configuradas (PROTHEUS_REST_* no .env).' };
  }

  try {
    const resposta = await fetch(`${baseUrl}/${endpointPedido}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: autenticacaoBasica(usuario, senha),
      },
      body: JSON.stringify(payload),
    });

    const texto = await resposta.text();
    let corpo;
    try {
      corpo = JSON.parse(texto);
    } catch {
      corpo = texto;
    }

    return { sucesso: resposta.ok, status: resposta.status, resposta: corpo, payloadEnviado: payload };
  } catch (erro) {
    return { sucesso: false, erro: erro.message, payloadEnviado: payload };
  }
}
