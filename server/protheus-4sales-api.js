import './env.js';

export const PROTHEUS_REST_BASE = 'http://177.67.71.212:9990/rest/';
export const PROTHEUS_TENANT = '14,01';

function headers() {
  const usuario = process.env.PROTHEUS_REST_USER;
  const senha = process.env.PROTHEUS_REST_PASSWORD;
  if (!usuario || !senha) throw new Error('Credenciais técnicas REST não configuradas.');
  return {
    Authorization: `Basic ${Buffer.from(`${usuario}:${senha}`).toString('base64')}`,
    TenantId: PROTHEUS_TENANT,
    'x-erp-module': 'FAT',
    Accept: 'application/json',
  };
}

export async function consultar4Sales(caminho, { timeoutMs = 30000 } = {}) {
  const resposta = await fetch(new URL(caminho, PROTHEUS_REST_BASE), {
    headers: headers(),
    signal: AbortSignal.timeout(timeoutMs),
    redirect: 'error',
  });
  const texto = await resposta.text();
  let corpo;
  try { corpo = JSON.parse(texto); } catch { corpo = null; }
  if (!resposta.ok || corpo === null) {
    throw new Error(`Consulta 4Sales ${caminho} falhou: HTTP ${resposta.status}.`);
  }
  return corpo;
}

export async function consultarTodasPaginas4Sales(caminho, { pageSize = 500, timeoutMs = 30000 } = {}) {
  const itens = [];
  let ultimaSincronizacao = null;
  for (let pagina = 1; pagina <= 1000; pagina += 1) {
    const separador = caminho.includes('?') ? '&' : '?';
    const corpo = await consultar4Sales(`${caminho}${separador}page=${pagina}&pageSize=${pageSize}`, { timeoutMs });
    if (!Array.isArray(corpo.items)) throw new Error(`Resposta paginada inválida em ${caminho}.`);
    itens.push(...corpo.items);
    ultimaSincronizacao = corpo.po_sync_date || ultimaSincronizacao;
    if (!corpo.hasNext) return { itens, ultimaSincronizacao, total: corpo.total ?? itens.length };
  }
  throw new Error(`Paginação excedeu o limite em ${caminho}.`);
}
