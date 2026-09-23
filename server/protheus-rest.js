import './env.js';

// Contrato próprio: SZ4/SZ5 + pedido MATA410, pendentes de efetivação.
// Publicar PDVREST.prw e U_PDVFORTFRUIT.prw conforme README-PDVBIL.md.
const ENDPOINT_PADRAO = 'PDVFORTFRUIT/pedido';

function getConfig() {
  return {
    baseUrl: process.env.PROTHEUS_REST_URL,
    usuario: process.env.PROTHEUS_REST_USER,
    senha: process.env.PROTHEUS_REST_PASSWORD,
    endpointPedido: process.env.PROTHEUS_REST_ENDPOINT_PEDIDO || ENDPOINT_PADRAO,
    condicaoPagamentoPadrao: process.env.PROTHEUS_COND_PAGAMENTO_PADRAO || '',
    tabelaPrecoPadrao: process.env.PROTHEUS_TABELA_PRECO_PADRAO || '015', // mesma tabela usada em sync-produtos.js
    empresa: process.env.PROTHEUS_PDV_EMPRESA || '',
    filial: process.env.PROTHEUS_PDV_FILIAL || '',
    armazem: process.env.PROTHEUS_PDV_ARMAZEM || '',
  };
}

function autenticacaoBasica(usuario, senha) {
  return 'Basic ' + Buffer.from(`${usuario}:${senha}`).toString('base64');
}

function paraReais(centavos) {
  return Math.round(centavos || 0) / 100;
}

export function montarPayloadVenda({ venda, itens, cliente, vendedorUsuario }) {
  const { condicaoPagamentoPadrao, tabelaPrecoPadrao, empresa, filial, armazem } = getConfig();
  // Não converter descontos silenciosamente em receita integral no ERP.
  if (venda.desconto > 0 || itens.some((item) => item.desconto > 0)) {
    throw new Error('Venda com desconto: homologar o tratamento de descontos do PDV antes do envio.');
  }
  if (!empresa || !filial || !armazem || !condicaoPagamentoPadrao) {
    throw new Error('Configure empresa, filial, armazém e condição de pagamento do PDV no .env.');
  }
  if (!venda.id || !cliente?.codigo || !cliente?.loja || !vendedorUsuario?.protheus_vend_codigo) {
    throw new Error('Venda, cliente/loja e vendedor Protheus são obrigatórios.');
  }
  if (typeof venda.id !== 'string' || venda.id.length > 36) {
    throw new Error('Identificador da venda deve ter até 36 caracteres.');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(venda.data_local || '')) {
    throw new Error('Venda sem data_local válida no formato AAAA-MM-DD.');
  }
  if (!itens.length || itens.length > 99) throw new Error('Enviar de 1 a 99 itens.');
  let totalItens = 0;
  for (const item of itens) {
    if (!item.codigo_produto || !Number.isFinite(item.quantidade) || item.quantidade <= 0 ||
        !Number.isSafeInteger(item.valor_unitario) || item.valor_unitario <= 10 ||
        !Number.isSafeInteger(item.valor_total) || item.valor_total <= 0 ||
        Math.round(item.quantidade * item.valor_unitario) !== item.valor_total) {
      throw new Error('Item com quantidade, preço ou total inválido para o contrato PDV.');
    }
    totalItens += item.valor_total;
  }
  if (!Number.isSafeInteger(venda.total) || venda.total !== totalItens) {
    throw new Error('Total da venda diferente da soma dos itens.');
  }

  return {
    idVendaPdv: venda.id,
    empresa,
    filial,
    armazem,
    data: venda.data_local.replaceAll('-', ''),
    total: paraReais(venda.total),
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
      valorTotal: paraReais(item.valor_total),
    })),
  };
}

export async function enviarVendaProtheus(payload) {
  const { baseUrl, usuario, senha, endpointPedido } = getConfig();
  if (!baseUrl || !usuario || !senha) {
    return { sucesso: false, erro: 'Credenciais da API REST do Protheus não configuradas (PROTHEUS_REST_* no .env).' };
  }

  try {
    const resposta = await fetch(`${baseUrl.replace(/\/+$/, '')}/${endpointPedido.replace(/^\/+/, '')}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: autenticacaoBasica(usuario, senha),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(60000),
    });

    const texto = await resposta.text();
    let corpo;
    try {
      corpo = JSON.parse(texto);
    } catch {
      corpo = texto;
    }

    const sucesso = resposta.ok && corpo?.sucesso === true &&
      corpo.etapa === 'BILHETE_E_PEDIDO_GRAVADOS' &&
      corpo.idVendaPdv === payload.idVendaPdv &&
      typeof corpo.bilhete === 'string' && corpo.bilhete.trim().length > 0 &&
      typeof corpo.pedido === 'string' && corpo.pedido.trim().length > 0;
    return {
      sucesso, status: resposta.status, resposta: corpo, payloadEnviado: payload,
      ...(!sucesso && { erro: corpo?.erro || corpo?.message || 'Protheus não confirmou a gravação do bilhete e pedido.' }),
    };
  } catch (erro) {
    return { sucesso: false, erro: `${erro.message}. Resultado remoto não confirmado; não há repetição automática.`, payloadEnviado: payload };
  }
}
