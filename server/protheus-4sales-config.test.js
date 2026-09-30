import test from 'node:test';
import assert from 'node:assert/strict';
import { resolverUrls4Sales } from './protheus-4sales-config.js';

test('consultas e bilhetes seguem o mesmo ambiente configurado, com ou sem barra final', () => {
  for (const base of ['https://producao.example:65535/rest', 'https://producao.example:65535/rest/']) {
    const urls = resolverUrls4Sales(base);
    assert.equal(new URL('api/tgv/products', urls.base).href, 'https://producao.example:65535/rest/api/tgv/products');
    assert.equal(urls.pedidos, 'https://producao.example:65535/rest/4SALFORTFRUITORDERS');
  }
  assert.equal(resolverUrls4Sales('http://homologacao.example:9990/rest').pedidos, 'http://homologacao.example:9990/rest/4SALFORTFRUITORDERS');
});

test('configuração ausente ou inválida não recai silenciosamente na REST de teste', () => {
  for (const base of ['', ' ', 'ftp://servidor/rest', 'https://login:senha@servidor/rest', 'https://servidor/rest?ambiente=teste']) {
    assert.throws(() => resolverUrls4Sales(base));
  }
});
