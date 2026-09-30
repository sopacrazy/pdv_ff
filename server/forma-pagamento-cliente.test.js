import test from 'node:test';
import assert from 'node:assert/strict';
import sql from 'mssql';
import { consultarFormaPagamentoCliente } from './forma-pagamento-cliente.js';
import { prepararVenda4Sales } from './protheus-4sales-vendas.js';

async function comSql(registros, fn) {
  const original = sql.ConnectionPool;
  const estado = { inputs: {}, fechado: false, consultas: [] };
  sql.ConnectionPool = class {
    async connect() {}
    request() {
      return {
        input(nome, tipo, valor) { estado.inputs[nome] = valor; return this; },
        async query(texto) {
          estado.consultas.push(texto);
          assert.match(texto.trim(), /^SELECT /);
          assert.doesNotMatch(texto, /\b(INSERT|UPDATE|DELETE|EXEC|MERGE)\b/i);
          if (registros instanceof Error) throw registros;
          return { recordset: registros };
        },
      };
    }
    async close() { estado.fechado = true; }
  };
  try { await fn(estado); } finally { sql.ConnectionPool = original; }
}

test('consulta SA1 por cliente e loja com parâmetros, e descrição SX5 tabela 24', () => comSql([
  { codigo: 'BOL ', descricao: 'BOLETO ' },
], async estado => {
  assert.deepEqual(await consultarFormaPagamentoCliente(' 374093 ', ' 01 '), { codigo: 'BOL', descricao: 'BOLETO' });
  assert.deepEqual(estado.inputs, { cliente: '374093', loja: '01' });
  assert.match(estado.consultas[0], /A1_FORMA/);
  assert.match(estado.consultas[0], /X5_TABELA='24'/);
  assert.equal(estado.fechado, true);
}));

test('não assume DEP quando A1_FORMA está vazio ou o cliente não foi identificado', async () => {
  for (const registros of [[], [{ codigo: ' ' }], [{ codigo: 'BOL' }, { codigo: 'DEP' }]]) {
    await comSql(registros, async estado => {
      await assert.rejects(consultarFormaPagamentoCliente('374093', '01'), /A1_FORMA|única/);
      assert.equal(estado.fechado, true);
    });
  }
});

test('falha SQL é propagada e a conexão é fechada', () => comSql(new Error('SQL indisponível'), async estado => {
  await assert.rejects(consultarFormaPagamentoCliente('374093', '01'), /SQL indisponível/);
  assert.equal(estado.fechado, true);
}));

test('cliente à vista preserva R$ mesmo sem descrição na SX5', () => comSql([{ codigo: 'R$ ', descricao: null }], async () => {
  assert.deepEqual(await consultarFormaPagamentoCliente('0001', '01'), { codigo: 'R$', descricao: 'R$' });
}));

test('preparação usa A1_FORMA do SQL apesar de forma conflitante na REST; faz somente GET', () => comSql([
  { codigo: 'BOL', descricao: 'BOLETO' },
], async estado => {
  const original = globalThis.fetch;
  const chamados = [];
  globalThis.fetch = async (url, opcoes) => {
    assert.ok(!opcoes.method || opcoes.method === 'GET');
    chamados.push(String(url));
    const resposta = String(url).includes('customers/')
      ? { code: '374093', store: '01', pricelist: '006', paymentForm: 'DEP' }
      : { items: [{ itemCode: '134.026', activeItemPrice: '1', minimumSalesPrice: 125 }], hasNext: false };
    return new Response(JSON.stringify(resposta), { status: 200 });
  };
  try {
    const p = await prepararVenda4Sales({ numero_cupom: '1', caixa: '001', cliente_codigo: '374093', cliente_loja: '01',
      tabela_preco: '006', forma_pagamento: '008', total: 12500, desconto: 0, criado_em: '2026-09-30T12:00:00Z', data_local: '2026-09-30' },
      [{ codigo_produto: '134.026', descricao: 'BATATA', quantidade: 1, valor_unitario: 12500, valor_total: 12500, desconto: 0 }],
      { protheus_usr_id: '163', protheus_vend_codigo: '000068' });
    assert.equal(p.body.paymentForm, 'BOL');
    assert.equal(p.body.client.paymentForm, 'BOL');
    assert.equal(p.body.paymentMethods.id, 'BOL ');
    assert.equal(p.body.paymentType.id, '008');
    assert.equal(p.body.value, 125);
    assert.equal(chamados.length, 2);
    assert.equal(estado.consultas.length, 1);
  } finally { globalThis.fetch = original; }
}));
