import test from 'node:test';
import assert from 'node:assert/strict';
import { validarContaRestPrincipal, limparCacheContaRestPrincipal } from './conta-rest-principal.js';

async function comConta(fn) {
  const original = globalThis.fetch;
  const usuario = process.env.PROTHEUS_REST_USER, senha = process.env.PROTHEUS_REST_PASSWORD;
  process.env.PROTHEUS_REST_USER = 'integracao'; process.env.PROTHEUS_REST_PASSWORD = 'senha-tecnica';
  limparCacheContaRestPrincipal();
  try { await fn(); } finally {
    globalThis.fetch = original; limparCacheContaRestPrincipal();
    if (usuario === undefined) delete process.env.PROTHEUS_REST_USER; else process.env.PROTHEUS_REST_USER = usuario;
    if (senha === undefined) delete process.env.PROTHEUS_REST_PASSWORD; else process.env.PROTHEUS_REST_PASSWORD = senha;
  }
}

test('validação concorrente usa uma consulta técnica e não retorna a senha', () => comConta(async () => {
  let chamadas = 0;
  globalThis.fetch = async (url, opcoes) => {
    chamadas++;
    assert.equal(opcoes.headers.Authorization, 'Basic ' + Buffer.from('integracao:senha-tecnica').toString('base64'));
    return new Response(JSON.stringify({ items: [] }));
  };
  const respostas = await Promise.all([validarContaRestPrincipal(), validarContaRestPrincipal()]);
  assert.equal(chamadas, 1);
  assert.deepEqual(respostas, [{usuario: 'integracao', validada: true}, {usuario: 'integracao', validada: true}]);
}));

test('conta técnica vinculada a vendedor é recusada e falha não é armazenada no cache', () => comConta(async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({items: [{branchid:'01',code:'000090',isseller:true}]}));
  await assert.rejects(validarContaRestPrincipal(), /vinculada a vendedor/);
  globalThis.fetch = async () => new Response(JSON.stringify({items: []}));
  assert.equal((await validarContaRestPrincipal()).validada, true);
}));

test('resposta inesperada não libera integração', () => comConta(async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({message:'não autorizado'}),{status:401});
  await assert.rejects(validarContaRestPrincipal(), /não autorizado/);
  globalThis.fetch = async () => new Response(JSON.stringify({message:'ok'}));
  await assert.rejects(validarContaRestPrincipal(), /lista inválida/);
}));
