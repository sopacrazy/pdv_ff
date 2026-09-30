import test from 'node:test';
import assert from 'node:assert/strict';
import sql from 'mssql';
import { consultarCatalogoBilhete, consultarCatalogoBilheteSql } from './sync-catalogo-bilhetes.js';

test('usa SQL somente quando o catálogo REST é proibido e mantém falhas de autenticação/rede', async () => {
  let consultasSql = 0;
  const consultarSql = async () => { consultasSql++; return { itens: [{ code: '100.007' }], fonte: 'sql' }; };
  const proibido = Object.assign(new Error('Vendedor exigido'), { status: 403 });
  const resultado = await consultarCatalogoBilhete(async () => { throw proibido; }, consultarSql);
  assert.equal(resultado.fonte, 'sql');
  assert.equal(resultado.itens[0].code, '100.007');
  assert.equal(consultasSql, 1);
  for (const status of [401, 500, undefined]) {
    const erro = Object.assign(new Error('Indisponível'), { status });
    await assert.rejects(consultarCatalogoBilhete(async () => { throw erro; }, consultarSql), error => error === erro);
  }
  assert.equal(consultasSql, 1);
  assert.equal((await consultarCatalogoBilhete(async () => ({ itens: [] }), consultarSql)).fonte, 'rest');
  assert.equal(consultasSql, 1);
});

test('catálogo SQL faz apenas SELECT, preserva exclusões e unidades e fecha a conexão', async () => {
  const original = sql.ConnectionPool;
  let fechamentos = 0;
  let itens = [{ code: '100.007', secondmeasureunit: 'UN', conversionfactor: 360, deleted: '*' }];
  sql.ConnectionPool = class {
    async connect() {}
    request() { return { query: async comando => {
      assert.match(comando.trim(), /^SELECT/);
      assert.match(comando, /FROM SB1140/);
      assert.match(comando, /D_E_L_E_T_/);
      return { recordset: itens };
    } }; }
    async close() { fechamentos++; }
  };
  try {
    const resultado = await consultarCatalogoBilheteSql();
    assert.deepEqual(resultado.itens, itens);
    assert.equal(resultado.fonte, 'sql');
    itens = [];
    await assert.rejects(consultarCatalogoBilheteSql(), /vazio/);
    assert.equal(fechamentos, 2);
  } finally { sql.ConnectionPool = original; }
});
