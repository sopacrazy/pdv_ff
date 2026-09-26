import { prepararTeste4Sales, enviarTeste4Sales, URL_TESTE_4SALES } from './protheus-4sales-test.js';
import { montarIdIntegracao } from './id-integracao.js';

const tenant = '14,01';

function codigoClienteComTamanhoProtheus(cliente, codigo, loja) {
  const codigoLimpo = String(codigo || '').trim();
  const id = String(cliente?.id || '');
  const filial = tenant.split(',')[1];
  // O GET do 4Sales devolve códigos curtos sem os espaços finais, mas o identificador contém
  // a chave de largura fixa da SA1: filial(2) + A1_COD(6) + loja(2). O RFATA03 usa DbSeek
  // com a chave completa; para o cliente "0001" é obrigatório enviar "0001  ".
  if (id.startsWith(filial) && id.endsWith(loja)) {
    const codigoNoId = id.slice(filial.length, id.length - loja.length);
    if (codigoNoId.trim() === codigoLimpo) return codigoNoId;
  }
  return codigoLimpo.padEnd(6, ' ');
}

async function consultar(path, timeoutMs = 30000) {
  const { PROTHEUS_REST_USER: user, PROTHEUS_REST_PASSWORD: password } = process.env;
  if (!user || !password) throw new Error('Configure as credenciais REST no servidor.');
  const response = await fetch(new URL(path, URL_TESTE_4SALES.replace('4SALFORTFRUITORDERS', '')), {
    headers: { Authorization: 'Basic ' + Buffer.from(`${user}:${password}`).toString('base64'), TenantId: tenant, 'x-erp-module': 'FAT' },
    signal: AbortSignal.timeout(timeoutMs), redirect: 'error',
  });
  if (!response.ok) throw new Error(`Consulta à base teste falhou: HTTP ${response.status}.`);
  return response.json();
}

export function montarVenda4Sales(venda, itens, vendedor, cliente, precos) {
  if (!venda.forma_pagamento) throw new Error('Venda sem condição de pagamento do cadastro do cliente.');
  if (!vendedor?.protheus_vend_codigo) throw new Error('Vincule o operador da venda a um vendedor Protheus em Usuários.');
  const codigoCliente = String(venda.cliente_codigo || cliente.code || '').trim();
  const lojaCliente = String(venda.cliente_loja || cliente.store || '').trim();
  const tabelaCliente = String(venda.tabela_preco || cliente.pricelist?.id || cliente.pricelist || '').trim();
  const codigoClientePayload = codigoClienteComTamanhoProtheus(cliente, codigoCliente, lojaCliente);
  const nomeClienteBilhete = String(venda.cliente_nome || cliente.name || cliente.fantasy || '').trim();
  if (!codigoCliente || !lojaCliente) throw new Error('Venda sem código/loja do cliente Protheus.');
  if (!tabelaCliente) throw new Error(`Cliente ${codigoCliente}/${lojaCliente} sem tabela de preço.`);
  if (String(cliente.code || '').trim() !== codigoCliente || String(cliente.store || '').trim() !== lojaCliente) {
    throw new Error('Cliente da venda diverge do cadastro devolvido pelo Protheus.');
  }
  if (venda.desconto || itens.some(i => i.desconto)) throw new Error('Descontos ainda precisam de homologação no 4Sales.');
  if (!itens.length || itens.length > 99) throw new Error('O bilhete deve conter de 1 a 99 itens.');
  const items = itens.map((i, index) => {
    if (!Number.isFinite(i.quantidade) || i.quantidade <= 0 || !Number.isSafeInteger(i.valor_unitario) || i.valor_unitario <= 0 || Math.round(i.quantidade * i.valor_unitario) !== i.valor_total) throw new Error(`Valores inválidos: ${i.codigo_produto}.`);
    const encontrados = precos.filter(p => p.itemCode?.trim() === i.codigo_produto.trim() && p.activeItemPrice === '1');
    if (encontrados.length !== 1) throw new Error(`Produto ${i.codigo_produto}: confira o cadastro ativo na tabela ${tabelaCliente}.`);
    const preco = Number(encontrados[0].minimumSalesPrice);
    if (!Number.isFinite(preco) || Math.round(preco * 100) !== i.valor_unitario) throw new Error(`Produto ${i.codigo_produto}: PDV R$ ${(i.valor_unitario / 100).toFixed(2)}, tabela ${tabelaCliente} R$ ${preco.toFixed(2)}. Ajuste o cadastro antes de enviar.`);
    return { product: i.codigo_produto.trim(), name: i.descricao, description: i.descricao, index: index + 1,
      quantity: i.quantidade, price: i.valor_unitario / 100, original: preco, priceFromTable: preco,
      total: i.valor_total / 100, discount: 0, discountPercent: 0, originalDiscount: 0,
      firstUnitQuantity: 0, secondUnitQuantity: 0, secondUnitValue: 0,
      stock: [{ id: tenant, name: 'LOJA', wharehouse: '01', batch: '', validity: '00/00/00', value: 0 }],
      rangePrices: [{ id: tabelaCliente, maxQuantity: 999999.99, original: preco, value: preco }] };
  });
  if (!Number.isSafeInteger(venda.total) || venda.total !== itens.reduce((s, i) => s + i.valor_total, 0)) throw new Error('Total da venda diverge dos itens.');
  const seller = { id: vendedor.protheus_vend_codigo, name: vendedor.protheus_vend_nome || '', sellerType: { id: '2', name: 'Bilhete' } };
  const priceTable = { id: tabelaCliente, name: cliente.pricelist?.name || `Tabela ${tabelaCliente}` };
  // Código da condição de pagamento do cadastro do cliente (A1_COND), gravado como forma_pagamento na venda local.
  // Sem descrição/portions/averageDays reais sincronizados do Protheus ainda — usando o próprio código como nome.
  const condicaoPagamento = venda.forma_pagamento.trim();
  const paymentType = { id: condicaoPagamento, name: condicaoPagamento, paymentType: '1', portions: 1, averageDays: 1, financialAddition: 0, financialDiscount: 0, maximumValue: 0, minimumValue: 0, paymentMoreBusiness: false };
  const paymentMethods = { id: 'DEP ', name: 'DEPOSITO' };
  const clientePayload = {
    _id: cliente.id || `${codigoClientePayload}${lojaCliente}`,
    externalCode: codigoClientePayload,
    storeCode: lojaCliente,
    name: String(cliente.name || cliente.fantasy || '').trim(),
    ...(cliente.shortName || cliente.fantasy ? { shortName: String(cliente.shortName || cliente.fantasy).trim() } : {}),
    priceTable,
    paymentType,
    paymentMethods,
    paymentForm: 'DEP',
    seller,
  };
  // CONFIRMADO (cupom 000028, bilhete CAQZL1): o Protheus IGNORA este campo — a resposta veio com
  // orderDate = data/hora real do relógio dele no momento do processamento, mesmo tendo enviado
  // data_local adiantada. Ou seja, isto aqui não controla a data do documento no Protheus; quem
  // faz isso é a data de sistema do próprio Protheus, mudada manualmente pelo operador de lá (ver
  // "Data de operação" no PDV — essa sim controla o fechamento/relatórios locais, só isso).
  // Mantido mesmo assim (enviar a data local com a hora real de criado_em) por ser inofensivo e
  // documentar a intenção, caso o comportamento do 4Sales mude no futuro.
  const horaReal = new Date(venda.criado_em).toISOString().split('T')[1];
  const dataBilhete = `${venda.data_local}T${horaReal}`;
  const idIntegracao = montarIdIntegracao(venda, vendedor?.protheus_usr_id);
  const clienteAVista = codigoCliente === '0001' || codigoCliente === '000001';
  return prepararTeste4Sales({ url: URL_TESTE_4SALES, method: 'post', headers: { TenantId: tenant, 'x-erp-module': 'FAT' }, body: {
    _id: idIntegracao, date: dataBilhete, operation: { id: '2', name: 'Bilhete' },
    // Campo personalizado configurado pela Fort Fruit na 4Sales com erpField = Z4_NOMCLI.
    // client.name/shortName pertencem ao cadastro SA1 e são substituídos pelo integrador.
    ...(clienteAVista ? { clientName: nomeClienteBilhete } : {}),
    subsidiary: { id: tenant, name: 'Operacao', companyName: 'FORT FRUIT LTDA' },
    client: clientePayload,
    seller, priceTable, paymentType, paymentMethods, items,
    currency: { currency: 'BRL', id: '1', locale: 'pt-BR', name: 'REAL' }, currencyConvert: false, currencyValue: 0,
    value: venda.total / 100, productsValue: venda.total / 100, productsValueWithDiscount: venda.total / 100,
    quantity: itens.reduce((s, i) => s + i.quantidade, 0), addition: 0, additions: [], discount: 0, discountPercent: 0, discounts: [], financialAddition: 0, financialDiscount: 0,
    isBudget: false, needsApprovement: false, strategies: [], status: { id: '', name: '' }, previousStatus: { id: '', name: '' },
    shippingType: { id: 'S', name: 'Sem frete' }, transactionType: { id: '01', name: 'VENDA DE MERCADORIA' },
  } });
}

export async function prepararVenda4Sales(venda, itens, vendedor, opcoes) {
  const timeoutMs = opcoes?.timeoutMs;
  const codigoCliente = String(venda.cliente_codigo || 'YDOVT3').trim();
  const lojaCliente = String(venda.cliente_loja || '01').trim();
  const cliente = await consultar(`api/tgv/customers/${encodeURIComponent(codigoCliente)}/${encodeURIComponent(lojaCliente)}`, timeoutMs);
  const tabelaCliente = String(venda.tabela_preco || cliente.pricelist?.id || cliente.pricelist || '015').trim();
  const precos = [];
  for (let page = 1; page <= 100; page++) {
    const data = await consultar(`api/supply/v2/PriceListHeaderItems/${encodeURIComponent(tabelaCliente)}/itensTablePrice/?page=${page}&pageSize=500`, timeoutMs);
    if (!Array.isArray(data.items)) throw new Error(`Resposta inválida da tabela ${tabelaCliente}.`);
    precos.push(...data.items);
    if (!data.hasNext) return montarVenda4Sales({ ...venda, tabela_preco: tabelaCliente }, itens, vendedor, cliente, precos);
  }
  throw new Error(`Consulta da tabela ${tabelaCliente} excedeu o limite de páginas.`);
}

export async function enviarVenda4Sales(preparado, opcoes) {
  const resultado = await enviarTeste4Sales(preparado, opcoes);
  const r = resultado.resposta;
  const sucesso = resultado.httpOk && r?.idWeb === preparado.body._id && r?.company === '14' && r?.branch === '01' && r?.status === 'EFE' && typeof r.ticket === 'string' && !!r.ticket.trim();
  const resultadoDesconhecido = !sucesso && Boolean(resultado.resultadoDesconhecido);
  return { ...resultado, sucesso: !!sucesso, bilhete: sucesso ? r.ticket : null,
    ...(!sucesso && { resultadoDesconhecido, rejeitado: !resultadoDesconhecido,
      erro: r?.message || resultado.erro || 'Gravação não confirmada pelo Protheus.' }) };
}
