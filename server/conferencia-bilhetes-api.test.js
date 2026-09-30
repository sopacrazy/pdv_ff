import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sql from 'mssql';

process.env.PDV_DB_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'pdv-exclusao-api-'));
process.env.API_PORT = '0';
const { getDb } = await import('./db.js');
const { iniciarApi } = await import('./api.js');
const db = getDb();
const agora = new Date().toISOString();
const data = '2026-09-30';
db.prepare('INSERT INTO sessoes VALUES (?,?,?)').run('token-local', db.prepare('SELECT id FROM usuarios LIMIT 1').get().id, agora);
db.prepare('UPDATE caixa_estado SET data_operacao=? WHERE id=1').run(data);
for (const [id, total] of [['ativo', 10000], ['excluido', 25000]]) {
  db.prepare(`INSERT INTO vendas (id,total,criado_em,data_local,status_protheus,bilhete_protheus,id_integracao,tipo_operacao)
    VALUES (?,?,?,?,'INTEGRADO',?,?,'PDV')`).run(id, total, agora, data, id, id);
}
const servidor = await iniciarApi();
after(() => new Promise(resolve => servidor.close(resolve)));
const fetchHttp = globalThis.fetch;
const PoolOriginal = sql.ConnectionPool;

test('API conserva histórico, exclui dos totais e bloqueia reenvio e confirmação manual; indisponibilidade preserva dados', async () => {
  globalThis.fetch = async () => { throw new Error('Proibido acessar REST neste teste.'); };
  let falhar = false;
  sql.ConnectionPool = class {
    async connect() { if (falhar) throw new Error('SQL indisponível'); }
    async close() {}
    request() { return { input() { return this; }, async query(texto) {
      assert.match(texto, /^SELECT/);
      return { recordset: ['ativo', 'excluido'].map(id => ({ filial: '01', bilhete: id, idIntegracao: id, excluido: id === 'excluido' ? '*' : '' })) };
    } }; }
  };
  const request = (rota, method = 'GET') => fetchHttp(`http://localhost:${servidor.address().port}/api/vendas${rota}`, {
    method, headers: { Authorization: 'Bearer token-local', 'Content-Type': 'application/json' },
    ...(method === 'POST' ? { body: '{}' } : {}),
  });
  try {
    const resposta = await request('/conferir-protheus', 'POST');
    assert.equal(resposta.status, 200);
    assert.equal((await resposta.json()).excluidas, 1);
    const vendas = await (await request(`?data=${data}`)).json();
    assert.equal(vendas.length, 2);
    assert.equal(vendas.find(v => v.id === 'excluido').statusProtheus, 'EXCLUIDO_PROTHEUS');
    const semana = await (await request('/resumo-semana')).json();
    assert.equal(semana.find(d => d.data === data).total, 10000);
    assert.equal((await request('/excluido/enviar-protheus', 'POST')).status, 409);
    assert.equal((await request('/excluido/marcar-integrado', 'POST')).status, 409);
    falhar = true;
    assert.equal((await request('/conferir-protheus', 'POST')).status, 503);
    assert.equal(db.prepare("SELECT status_protheus FROM vendas WHERE id='ativo'").get().status_protheus, 'INTEGRADO');
    assert.equal(db.prepare("SELECT total FROM vendas WHERE id='excluido'").get().total, 25000);
  } finally {
    sql.ConnectionPool = PoolOriginal;
    globalThis.fetch = fetchHttp;
  }
});
