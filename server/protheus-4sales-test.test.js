import test from 'node:test';
import assert from 'node:assert/strict';
import { prepararTeste4Sales, enviarTeste4Sales, URL_TESTE_4SALES } from './protheus-4sales-test.js';

const documento = () => ({ url: URL_TESTE_4SALES, method: 'post', headers: { TenantId: '14,01', 'x-erp-module': 'FAT', Authorization: 'nao encaminhar' },
  body: { _id: 'teste', operation: { id: '2' }, subsidiary: { id: '14,01' }, client: { externalCode: 'C', storeCode: '01' },
    seller: { id: 'V' }, paymentType: { id: '033' }, items: [{ product: 'P', quantity: 1 }], value: 10 } });

test('contrato 4Sales limita destino e encaminha somente body/cabecalhos permitidos', async () => {
  const doc = documento();
  const p = prepararTeste4Sales(doc);
  assert.equal(p.headers.Authorization, undefined);
  assert.throws(() => prepararTeste4Sales({ ...doc, url: 'http://outro/'}), /base teste/);
  assert.throws(() => prepararTeste4Sales({ ...doc, headers: { ...doc.headers, TenantId: '01,01' } }), /TenantId/);
  assert.throws(() => prepararTeste4Sales({ ...doc, body: { ...doc.body, operation: { id: '1' } } }), /Bilhete/);
  const originalFetch = globalThis.fetch;
  const oldUser = process.env.PROTHEUS_REST_USER;
  const oldPass = process.env.PROTHEUS_REST_PASSWORD;
  process.env.PROTHEUS_REST_USER = 'teste'; process.env.PROTHEUS_REST_PASSWORD = 'teste';
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, URL_TESTE_4SALES);
      assert.deepEqual(JSON.parse(options.body), doc.body);
      assert.equal(options.headers.TenantId, '14,01');
      assert.equal(options.headers['x-erp-module'], 'FAT');
      assert.equal(options.headers.Authorization, 'Basic ' + Buffer.from('operador.protheus:senha-operador').toString('base64'));
      assert.equal(options.redirect, 'error');
      return new Response(JSON.stringify({ message: 'Operação inválida' }), { status: 500 });
    };
    const credenciaisProtheus = { usuario: 'operador.protheus', senha: 'senha-operador' };
    const erro = await enviarTeste4Sales(p, { credenciaisProtheus });
    assert.equal(erro.status, 500);
    assert.equal(erro.resposta.message, 'Operação inválida');
    globalThis.fetch = async () => new Response(JSON.stringify({ pedido: '123' }), { status: 200 });
    const ok = await enviarTeste4Sales(p, { credenciaisProtheus });
    assert.equal(ok.httpOk, true);
    assert.equal(ok.sucesso, undefined); // HTTP 200 não comprova inclusão.
    let tentativas = 0;
    globalThis.fetch = async () => { tentativas++; throw new Error('timeout'); };
    assert.equal((await enviarTeste4Sales(p, { credenciaisProtheus })).resultadoDesconhecido, true);
    assert.equal(tentativas, 1);
  } finally {
    globalThis.fetch = originalFetch;
    if (oldUser === undefined) delete process.env.PROTHEUS_REST_USER; else process.env.PROTHEUS_REST_USER = oldUser;
    if (oldPass === undefined) delete process.env.PROTHEUS_REST_PASSWORD; else process.env.PROTHEUS_REST_PASSWORD = oldPass;
  }
});
