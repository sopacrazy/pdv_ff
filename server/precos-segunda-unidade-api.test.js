import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.PDV_DB_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'pdv-preco2-api-'));
process.env.API_PORT = '0';
const [{ getDb }, { getProtheusCacheDb }, { iniciarApi }] = await Promise.all([import('./db.js'), import('./protheus-cache-db.js'), import('./api.js')]);
const db = getDb();
const cache = getProtheusCacheDb();
const agora = new Date().toISOString();
const usuario = db.prepare('SELECT id FROM usuarios LIMIT 1').get();
db.prepare('INSERT INTO sessoes VALUES (?,?,?)').run('token-local', usuario.id, agora);
cache.prepare("INSERT INTO produtos_bilhete (codigo,descricao,unidade,segunda_unidade,fator_conversao,tipo_conversao,atualizado_em) VALUES ('134.026','BATATA ESCOVADA A 25KG','SC','KG',25,'M',?)").run(agora);
for (const [tabela, preco, preco2] of [['001', 120, 4.8], ['006', 125, 5]]) {
  cache.prepare("INSERT INTO clientes (filial,codigo,loja,tabela_preco,atualizado_em) VALUES ('01',?,'01',?,?)").run(`C${tabela}`, tabela, agora);
  cache.prepare("INSERT INTO precos (tabela,produto,preco,preco_segunda_unidade,atualizado_em) VALUES (?,'134.026',?,?,?)").run(tabela, preco, preco2, agora);
  cache.prepare('INSERT INTO cache_metadata VALUES (?,?,?)').run(`precos_${tabela}`, agora, agora);
}
const servidor = await iniciarApi();
after(() => new Promise(resolve => servidor.close(resolve)));
const fetchHttp = globalThis.fetch;
test('busca do bilhete retorna preço secundário da tabela do cliente e conversão SC/KG', async () => {
  globalThis.fetch = async () => { throw new Error('Este teste não pode consultar o Protheus.'); };
  try {
    for (const [tabela, preco, preco2] of [['001', 120, 4.8], ['006', 125, 5]]) {
      const resposta = await fetchHttp(`http://localhost:${servidor.address().port}/api/bilhetes/produtos?q=134.026&cliente=C${tabela}&loja=01`, { headers: { Authorization: 'Bearer token-local' } });
      assert.equal(resposta.status, 200);
      const [produto] = await resposta.json();
      assert.equal(produto.preco, preco);
      assert.equal(produto.precoSegundaUnidade, preco2);
      assert.equal(produto.segundaUnidade, 'KG');
      assert.equal(produto.fatorConversao, 25);
    }
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM vendas').get().n, 0);
  } finally { globalThis.fetch = fetchHttp; }
});
