import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import sql from 'mssql';
import { consultarPrecosSegundaUnidade, atualizarPrecosSegundaUnidade } from './precos-segunda-unidade.js';

test('preço da segunda unidade vem da tabela do cliente e mantém quatro casas sem modificar preço principal', async () => {
  const original = sql.ConnectionPool;
  let falhar = false;
  let fechamentos = 0;
  const consulta = [];
  sql.ConnectionPool = class {
    async connect() {}
    request() {
      let tabela;
      const request = { input: (nome, tipo, valor) => { assert.equal(nome, 'tabela'); tabela = valor; return request; }, query: async comando => {
        assert.match(comando.trim(), /^SELECT/);
        assert.match(comando, /DA1_CODTAB=@tabela/);
        assert.match(comando, /DA1_PRC2UM/);
        consulta.push(tabela);
        if (falhar) throw new Error('SQL offline');
        return { recordset: [{ produto: '134.026 ', preco: tabela === '006' ? 5 : 4.8 }, { produto: 'OUTRO', preco: 0.1429 }] };
      } };
      return request;
    }
    async close() { fechamentos++; }
  };
  const db = new Database(':memory:');
  try {
    db.exec(`CREATE TABLE precos (tabela TEXT,produto TEXT,preco REAL,preco_segunda_unidade REAL);
      INSERT INTO precos VALUES ('006','134.026',125,NULL),('001','134.026',120,4.8),('006','OUTRO',1,NULL),('006','REMOVIDO',2,9);`);
    await atualizarPrecosSegundaUnidade(db, '006');
    assert.deepEqual(db.prepare("SELECT preco,preco_segunda_unidade FROM precos WHERE tabela='006' AND produto='134.026'").get(), { preco: 125, preco_segunda_unidade: 5 });
    assert.equal(db.prepare("SELECT preco_segunda_unidade FROM precos WHERE tabela='001'").get().preco_segunda_unidade, 4.8);
    assert.equal(db.prepare("SELECT preco_segunda_unidade FROM precos WHERE produto='OUTRO'").get().preco_segunda_unidade, 0.1429);
    assert.equal(db.prepare("SELECT preco_segunda_unidade FROM precos WHERE produto='REMOVIDO'").get().preco_segunda_unidade, null);
    falhar = true;
    await assert.rejects(atualizarPrecosSegundaUnidade(db, '006'), /SQL offline/);
    assert.equal(db.prepare("SELECT preco_segunda_unidade FROM precos WHERE tabela='006' AND produto='134.026'").get().preco_segunda_unidade, 5);
    await assert.rejects(consultarPrecosSegundaUnidade("006';DROP TABLE"), /inválida/);
    assert.deepEqual(consulta, ['006', '006']);
    assert.equal(fechamentos, 2);
  } finally { db.close(); sql.ConnectionPool = original; }
});
