import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.PDV_DB_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'pdv-impressao-'));
process.env.API_PORT = '0';
const { getDb } = await import('./db.js');
const { getProtheusCacheDb } = await import('./protheus-cache-db.js');
const { iniciarApi } = await import('./api.js');
const db = getDb();
const cache = getProtheusCacheDb();
const servidor = await iniciarApi();
after(() => new Promise(resolve => servidor.close(resolve)));
const buscar = async () => {
  const resposta = await fetch(`http://localhost:${servidor.address().port}/api/vendas/impressao-teste`);
  assert.equal(resposta.status, 200);
  return resposta.json();
};

db.prepare(`INSERT INTO vendas (id, numero_cupom, operador, cliente_codigo, cliente_loja,
  forma_pagamento, criado_em, data_local, total, usuario_id)
  VALUES ('impressao-teste','000001','Operador','000004','02','033','2026-09-28T12:00:00Z','2026-09-23',1550,'usuario-teste')`).run();
db.prepare(`INSERT INTO usuarios (id,nome,login,senha_hash,criado_em,protheus_vend_codigo,protheus_vend_nome)
  VALUES ('usuario-teste','Operador','impressao','segredo-nao-retornar','2026-09-28','000090','Vendedor')`).run();
const inserir = cache.prepare(`INSERT INTO clientes (filial,codigo,loja,fantasia,dados_json,atualizado_em)
  VALUES ('01','000004',?,?,?,'2026-09-28')`);
inserir.run('01', 'LOJA ERRADA', JSON.stringify({address:'ENDERECO ERRADO'}));
inserir.run('02', 'CLIENTE CERTO', JSON.stringify({address:'RUA A',neighborhood:'BAIRRO',city:'BELEM',ddd:'91',phone:'12345678',estadualregistration:'123'}));
cache.prepare(`INSERT INTO condicoes_pagamento (filial,codigo,descricao,atualizado_em) VALUES ('01','033','PIX','2026-09-28')`).run();

test('detalhe de impressão respeita loja, data de operação e só expõe dados necessários', async () => {
  const venda = await buscar();
  assert.equal(venda.dataLocal, '2026-09-23');
  assert.equal(venda.impressao.clienteFantasia, 'CLIENTE CERTO');
  assert.equal(venda.impressao.clienteEndereco, 'RUA A - BAIRRO');
  assert.equal(venda.impressao.clienteTelefone, '91 - 12345678');
  assert.equal(venda.impressao.condicaoDescricao, 'PIX');
  assert.equal(venda.impressao.vendedorCodigo, '000090');
  assert.ok(!JSON.stringify(venda).includes('segredo-nao-retornar'));
  assert.equal(venda.impressao.rota, undefined);
  assert.equal(venda.impressao.pesoTotal, undefined);
});

test('cadastro legado inválido não impede a reimpressão', async () => {
  cache.prepare("UPDATE clientes SET dados_json='invalido' WHERE loja='02'").run();
  const venda = await buscar();
  assert.equal(venda.impressao.clienteEndereco, '');
  assert.equal(venda.impressao.clienteTelefone, '');
  assert.equal(venda.numeroCupom, '000001');
});
