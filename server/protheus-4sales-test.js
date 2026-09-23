import './env.js';

export const URL_TESTE_4SALES = 'http://177.67.71.212:9990/rest/4SALFORTFRUITORDERS';

// Falha de rede/timeout (provável sem internet ou Protheus fora do ar) vs. erro de negócio já respondido pelo servidor.
export function pareceFalhaDeRede(erro) {
  const codigo = erro?.cause?.code || erro?.code || '';
  return erro?.name === 'TimeoutError' || erro?.name === 'AbortError' ||
    /ENOTFOUND|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|ECONNRESET|ENETUNREACH/i.test(String(codigo)) ||
    /fetch failed/i.test(erro?.message || '');
}

export function prepararTeste4Sales(documento) {
  if (!documento || typeof documento !== 'object' || Array.isArray(documento)) throw new Error('Informe o JSON enviado pela empresa.');
  const body = documento.body;
  const headers = documento.headers;
  if (documento.url !== URL_TESTE_4SALES || documento.method?.toLowerCase() !== 'post') {
    throw new Error('Este teste aceita somente POST no 4SALFORTFRUITORDERS da base teste.');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body) || !headers) throw new Error('O arquivo deve conter body e headers.');
  if (body.operation?.id !== '2') throw new Error('O teste exige operation.id = "2" (Bilhete).');
  if (typeof body._id !== 'string' || !body._id.trim()) throw new Error('Identificador do pedido ausente.');
  if (typeof headers.TenantId !== 'string' || !/^\d+,\d+$/.test(headers.TenantId) || headers.TenantId !== body.subsidiary?.id) {
    throw new Error('TenantId deve corresponder à empresa/filial de subsidiary.id.');
  }
  if (headers['x-erp-module'] !== 'FAT') throw new Error('O módulo deve ser FAT.');
  if (!Array.isArray(body.items) || body.items.length === 0) throw new Error('Pedido sem itens.');
  if (!body.client?.externalCode || !body.client?.storeCode || !body.seller?.id || !body.paymentType?.id) {
    throw new Error('Cliente/loja, vendedor e condição são obrigatórios.');
  }
  if (!Number.isFinite(body.value) || body.value <= 0 || body.items.some(i => !i.product || !Number.isFinite(i.quantity) || i.quantity <= 0)) {
    throw new Error('Confira produtos, quantidades e valor do bilhete.');
  }
  return {
    body,
    headers: { 'Content-Type': 'application/json', 'Accept-Charset': 'UTF8', TenantId: headers.TenantId, 'x-erp-module': 'FAT' },
    resumo: { id: body._id, tenant: headers.TenantId, cliente: body.client.externalCode, loja: body.client.storeCode,
      vendedor: body.seller.id, condicao: body.paymentType.id, itens: body.items.length, total: body.value, data: body.date },
  };
}

export async function enviarTeste4Sales(preparado, { timeoutMs = 150000 } = {}) {
  const usuario = process.env.PROTHEUS_REST_USER;
  const senha = process.env.PROTHEUS_REST_PASSWORD;
  if (!usuario || !senha) throw new Error('Credenciais REST não configuradas no servidor do PDV.');
  const inicio = Date.now();
  try {
    const response = await fetch(URL_TESTE_4SALES, {
      method: 'POST',
      headers: { ...preparado.headers, Authorization: 'Basic ' + Buffer.from(`${usuario}:${senha}`).toString('base64') },
      body: JSON.stringify(preparado.body),
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'error',
    });
    const texto = await response.text();
    let resposta;
    try { resposta = JSON.parse(texto); } catch { resposta = texto; }
    // Não conhecemos ainda o contrato de sucesso do 4Sales. Não marcar vendas locais como integradas.
    return { status: response.status, httpOk: response.ok, resposta, duracaoMs: Date.now() - inicio,
      mensagem: 'Resposta recebida. Confira o retorno e o bilhete no Protheus antes de novo envio.' };
  } catch (erro) {
    return { httpOk: false, resultadoDesconhecido: true, semInternet: pareceFalhaDeRede(erro), duracaoMs: Date.now() - inicio,
      erro: erro.message, mensagem: 'Resultado remoto desconhecido. Confira no Protheus; o envio não será repetido automaticamente.' };
  }
}
