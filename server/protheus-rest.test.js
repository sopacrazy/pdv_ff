import test from 'node:test';
import assert from 'node:assert/strict';
import { montarPayloadVenda, enviarVendaProtheus } from './protheus-rest.js';

const venda = { id: 'ebf14746-0853-4f67-95ca-e88640519a10', numero_cupom: '123', loja: '01', data_local: '2026-09-22', total: 1250, desconto: 0 };
const itens = [{ codigo_produto: 'P1', quantidade: 2.5, valor_unitario: 500, valor_total: 1250, desconto: 0 }];
const entrada = { venda, itens, cliente: { codigo: 'C1', loja: '01' }, vendedorUsuario: { protheus_vend_codigo: 'V1' } };

test('contrato PDV e retorno de negócio (sem acesso à rede)', async (t) => {
  const original = { ...process.env };
  const fetchOriginal = globalThis.fetch;
  Object.assign(process.env, {
    PROTHEUS_REST_URL: 'http://teste.invalid/rest/', PROTHEUS_REST_USER: 'teste', PROTHEUS_REST_PASSWORD: 'teste',
    PROTHEUS_REST_ENDPOINT_PEDIDO: '/PDVFORTFRUIT/pedido', PROTHEUS_PDV_EMPRESA: '14',
    PROTHEUS_PDV_FILIAL: '01', PROTHEUS_PDV_ARMAZEM: '01', PROTHEUS_COND_PAGAMENTO_PADRAO: '001',
  });
  try {
    const payload = montarPayloadVenda(entrada);
    assert.equal(payload.data, '20260922');
    assert.equal(payload.total, 12.5);
    assert.equal(payload.itens[0].valorUnitario, 5);
    assert.equal(payload.itens[0].valorTotal, 12.5);
    assert.equal(payload.idVendaPdv, venda.id);
    assert.throws(() => montarPayloadVenda({ ...entrada, venda: { ...venda, desconto: 10 } }), /desconto/);
    assert.throws(() => montarPayloadVenda({ ...entrada, venda: { ...venda, total: 1200 } }), /Total/);
    assert.throws(() => montarPayloadVenda({ ...entrada, itens: [{ ...itens[0], quantidade: 0 }] }), /inválido/);
    assert.throws(() => montarPayloadVenda({ ...entrada, vendedorUsuario: null }), /obrigatórios/);

    const valid = { sucesso: true, etapa: 'BILHETE_E_PEDIDO_GRAVADOS', idVendaPdv: venda.id, bilhete: '000123', pedido: '000123' };
    for (const [nome, body, status, esperado] of [
      ['201 confirmado', valid, 201, true],
      ['reenvio confirmado', { ...valid, reenvio: true }, 200, true],
      ['erro de negocio com 200', { sucesso: false, erro: 'Falha' }, 200, false],
      ['HTML login com 200', '<html>Login Protheus</html>', 200, false],
      ['outra venda', { ...valid, idVendaPdv: 'outra' }, 200, false],
      ['sem bilhete', { ...valid, bilhete: '' }, 200, false],
      ['erro HTTP', valid, 500, false],
    ]) {
      await t.test(nome, async () => {
        globalThis.fetch = async (url, options) => {
          assert.equal(url, 'http://teste.invalid/rest/PDVFORTFRUIT/pedido');
          assert.equal(options.method, 'POST');
          assert.deepEqual(JSON.parse(options.body), payload);
          return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
        };
        assert.equal((await enviarVendaProtheus(payload)).sucesso, esperado);
      });
    }
    let tentativas = 0;
    globalThis.fetch = async () => { tentativas++; throw new Error('timeout'); };
    const falha = await enviarVendaProtheus(payload);
    assert.equal(falha.sucesso, false);
    assert.match(falha.erro, /não confirmado/);
    assert.equal(tentativas, 1);
  } finally {
    globalThis.fetch = fetchOriginal;
    for (const key of Object.keys(process.env)) if (!(key in original)) delete process.env[key];
    Object.assign(process.env, original);
  }
});
