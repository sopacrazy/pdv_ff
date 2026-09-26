import { URL_TESTE_4SALES } from './protheus-4sales-test.js';

const BASE_REST = URL_TESTE_4SALES.replace('4SALFORTFRUITORDERS', '');

function autenticacaoBasica(usuario, senha) {
  return 'Basic ' + Buffer.from(`${usuario}:${senha}`).toString('base64');
}

// Endpoint oficial encontrado no catálogo REST deste Protheus. Ele resolve o vendedor a partir do
// usuário realmente autenticado, aplicando a mesma amarração SYS_USR.USR_ID -> SA3.A3_CODUSR que
// o RFATA03 usa ao incluir o bilhete.
export async function consultarVendedorDoUsuario({ usuario, senha, filial = '01', timeoutMs = 30000 }) {
  if (!usuario || !senha) throw new Error('Usuário e senha Protheus são obrigatórios para consultar o vendedor.');
  const response = await fetch(new URL('api/tgv/sellers/codeuser', BASE_REST), {
    method: 'GET',
    headers: {
      Authorization: autenticacaoBasica(usuario, senha),
      TenantId: `14,${filial}`,
      'x-erp-module': 'FAT',
    },
    signal: AbortSignal.timeout(timeoutMs),
    redirect: 'error',
  });
  const texto = await response.text();
  let corpo;
  try {
    corpo = texto ? JSON.parse(texto) : null;
  } catch {
    throw new Error(`Consulta do vendedor devolveu resposta inválida (HTTP ${response.status}).`);
  }
  if (!response.ok) throw new Error(corpo?.message || `Consulta do vendedor falhou: HTTP ${response.status}.`);
  const vendedores = Array.isArray(corpo?.items)
    ? corpo.items.filter((item) => String(item.branchid || '').trim() === filial && item.isseller !== false)
    : [];
  if (vendedores.length !== 1) {
    throw new Error(
      vendedores.length === 0
        ? `O usuário Protheus não possui vendedor ativo vinculado na filial ${filial}.`
        : `O usuário Protheus possui mais de um vendedor na filial ${filial}; corrija o vínculo no SA3.`
    );
  }
  const vendedor = vendedores[0];
  if (!vendedor.code || !vendedor.userid) throw new Error('Vínculo de vendedor retornado pelo Protheus está incompleto.');
  return {
    filial: String(vendedor.branchid).trim(),
    codigo: String(vendedor.code).trim(),
    nome: String(vendedor.name || vendedor.shortname || '').trim(),
    usuarioId: String(vendedor.userid).trim(),
  };
}
