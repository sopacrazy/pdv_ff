import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.PDV_DB_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'pdv-vendas-periodo-'));
process.env.API_PORT = '0';
const { getDb } = await import('./db.js');
const { iniciarApi } = await import('./api.js');
const db = getDb();
db.prepare('UPDATE caixa_estado SET data_operacao=? WHERE id=1').run('2026-09-30');
for (const [id, data] of [['antes', '2026-09-28'], ['inicio', '2026-09-29'], ['excluido', '2026-09-30'], ['fim', '2026-10-01'], ['depois', '2026-10-02']]) {
  db.prepare("INSERT INTO vendas (id, numero_cupom, total, criado_em, data_local, deletado) VALUES (?, ?, 100, ?, ?, '')")
    .run(id, id, `${data}T12:00:00.000Z`, data);
}
db.prepare("UPDATE vendas SET deletado='*' WHERE id='excluido'").run();
const servidor = await iniciarApi();
after(() => new Promise(resolve => servidor.close(resolve)));
const consultar = (query = '') => fetch(`http://localhost:${servidor.address().port}/api/vendas${query}`);

test('consulta por período inclui limites e ignora vendas excluídas', async () => {
  const resposta = await consultar('?inicio=2026-09-29&fim=2026-10-01');
  assert.equal(resposta.status, 200);
  const vendas = await resposta.json();
  assert.deepEqual(vendas.map(v => v.id), ['fim', 'inicio']);
  assert.equal(vendas[1].dataLocal, '2026-09-29');
  assert.deepEqual((await (await consultar()).json()).map(v => v.id), []);
  assert.deepEqual((await (await consultar('?data=2026-09-29')).json()).map(v => v.id), ['inicio']);
});

test('período incompleto, invertido ou com data inválida recebe 400', async () => {
  for (const query of ['?inicio=2026-09-29', '?inicio=2026-10-02&fim=2026-09-29', '?inicio=2026-02-30&fim=2026-03-01']) {
    assert.equal((await consultar(query)).status, 400);
  }
});
