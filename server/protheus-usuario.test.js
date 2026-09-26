import test from 'node:test';
import assert from 'node:assert/strict';
import { consultarVendedorDoUsuario } from './protheus-usuario.js';

test('consulta o vendedor pelo usuário autenticado e normaliza o vínculo retornado', async () => {
  const fetchOriginal = globalThis.fetch;
  try {
    globalThis.fetch = async (url, opcoes) => {
      assert.match(String(url), /api\/tgv\/sellers\/codeuser$/);
      assert.equal(opcoes.method, 'GET');
      assert.equal(opcoes.headers.TenantId, '14,01');
      assert.equal(opcoes.headers.Authorization, 'Basic ' + Buffer.from('operador:senha').toString('base64'));
      return new Response(JSON.stringify({
        items: [{ branchid: '01', code: '000013', name: 'VENDEDOR', userid: '000163', isseller: true }],
      }), { status: 200 });
    };
    assert.deepEqual(await consultarVendedorDoUsuario({ usuario: 'operador', senha: 'senha' }), {
      filial: '01', codigo: '000013', nome: 'VENDEDOR', usuarioId: '000163',
    });
  } finally {
    globalThis.fetch = fetchOriginal;
  }
});

test('recusa usuário sem vendedor vinculado na filial', async () => {
  const fetchOriginal = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({ items: [] }), { status: 200 });
    await assert.rejects(
      consultarVendedorDoUsuario({ usuario: 'operador', senha: 'senha' }),
      /não possui vendedor ativo/
    );
  } finally {
    globalThis.fetch = fetchOriginal;
  }
});
