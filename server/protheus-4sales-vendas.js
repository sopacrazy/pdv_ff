import { prepararTeste4Sales, enviarTeste4Sales, URL_TESTE_4SALES } from './protheus-4sales-test.js';

const tenant = '14,01';
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
  if (cliente.code !== 'YDOVT3' || cliente.store !== '01' || cliente.pricelist !== '015') throw new Error('Cliente YDOVT3/01 deve estar vinculado à tabela 015 na base teste.');
  if (venda.desconto || itens.some(i => i.desconto)) throw new Error('Descontos ainda precisam de homologação no 4Sales.');
  if (!itens.length || itens.length > 99) throw new Error('O bilhete deve conter de 1 a 99 itens.');
  const items = itens.map((i, index) => {
    if (!Number.isFinite(i.quantidade) || i.quantidade <= 0 || !Number.isSafeInteger(i.valor_unitario) || i.valor_unitario <= 0 || Math.round(i.quantidade * i.valor_unitario) !== i.valor_total) throw new Error(`Valores inválidos: ${i.codigo_produto}.`);
    const encontrados = precos.filter(p => p.itemCode?.trim() === i.codigo_produto.trim() && p.activeItemPrice === '1');
    if (encontrados.length !== 1) throw new Error(`Produto ${i.codigo_produto}: confira o cadastro ativo na tabela 015 da base teste.`);
    const preco = Number(encontrados[0].minimumSalesPrice);
    if (!Number.isFinite(preco) || Math.round(preco * 100) !== i.valor_unitario) throw new Error(`Produto ${i.codigo_produto}: PDV R$ ${(i.valor_unitario / 100).toFixed(2)}, tabela 015 teste R$ ${preco.toFixed(2)}. Ajuste o cadastro antes de enviar.`);
    return { product: i.codigo_produto.trim(), name: i.descricao, description: i.descricao, index: index + 1,
      quantity: i.quantidade, price: i.valor_unitario / 100, original: preco, priceFromTable: preco,
      total: i.valor_total / 100, discount: 0, discountPercent: 0, originalDiscount: 0,
      firstUnitQuantity: 0, secondUnitQuantity: 0, secondUnitValue: 0,
      stock: [{ id: tenant, name: 'LOJA', wharehouse: '01', batch: '', validity: '00/00/00', value: 0 }],
      rangePrices: [{ id: '015', maxQuantity: 999999.99, original: preco, value: preco }] };
  });
  if (!Number.isSafeInteger(venda.total) || venda.total !== itens.reduce((s, i) => s + i.valor_total, 0)) throw new Error('Total da venda diverge dos itens.');
  const seller = { id: vendedor.protheus_vend_codigo, name: vendedor.protheus_vend_nome || '', sellerType: { id: '2', name: 'Bilhete' } };
  const priceTable = { id: '015', name: 'Tabela 015' };
  // Código da condição de pagamento do cadastro do cliente (A1_COND), gravado como forma_pagamento na venda local.
  // Sem descrição/portions/averageDays reais sincronizados do Protheus ainda — usando o próprio código como nome.
  const condicaoPagamento = venda.forma_pagamento.trim();
  const paymentType = { id: condicaoPagamento, name: condicaoPagamento, paymentType: '1', portions: 1, averageDays: 1, financialAddition: 0, financialDiscount: 0, maximumValue: 0, minimumValue: 0, paymentMoreBusiness: false };
  const paymentMethods = { id: 'DEP ', name: 'DEPOSITO' };
  return prepararTeste4Sales({ url: URL_TESTE_4SALES, method: 'post', headers: { TenantId: tenant, 'x-erp-module': 'FAT' }, body: {
    _id: venda.id, date: venda.criado_em, operation: { id: '2', name: 'Bilhete' },
    subsidiary: { id: tenant, name: 'Operacao', companyName: 'FORT FRUIT LTDA' },
    client: { _id: 'YDOVT301', externalCode: 'YDOVT3', storeCode: '01', name: cliente.name || cliente.fantasy, priceTable, paymentType, paymentMethods, paymentForm: 'DEP', seller },
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
  const cliente = await consultar('api/tgv/customers/YDOVT3/01', timeoutMs);
  const precos = [];
  for (let page = 1; page <= 100; page++) {
    const data = await consultar(`api/supply/v2/PriceListHeaderItems/015/itensTablePrice/?page=${page}&pageSize=500`, timeoutMs);
    if (!Array.isArray(data.items)) throw new Error('Resposta inválida da tabela 015.');
    precos.push(...data.items);
    if (!data.hasNext) return montarVenda4Sales(venda, itens, vendedor, cliente, precos);
  }
  throw new Error('Consulta da tabela 015 excedeu o limite de páginas.');
}

export async function enviarVenda4Sales(preparado, opcoes) {
  const resultado = await enviarTeste4Sales(preparado, opcoes);
  const r = resultado.resposta;
  const sucesso = resultado.httpOk && r?.idWeb === preparado.body._id && r?.company === '14' && r?.branch === '01' && r?.status === 'EFE' && typeof r.ticket === 'string' && !!r.ticket.trim();
  return { ...resultado, sucesso: !!sucesso, bilhete: sucesso ? r.ticket : null,
    ...(!sucesso && { resultadoDesconhecido: true, erro: r?.message || resultado.erro || 'Gravação não confirmada. Confira no Protheus antes de reenviar.' }) };
}
