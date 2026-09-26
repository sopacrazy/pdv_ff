import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const diretorioTeste = fs.mkdtempSync(path.join(os.tmpdir(), 'pdv-bilhete-validacao-'));
process.env.PDV_DB_DIR = diretorioTeste;

const [{ validarBilheteLocal }, { getProtheusCacheDb }] = await Promise.all([
  import('./api.js'),
  import('./protheus-cache-db.js'),
]);

function prepararCliente({ codigo = '000004', condicao = '010', saldo = 50 } = {}) {
  const db = getProtheusCacheDb();
  const agora = new Date().toISOString();
  db.exec('DELETE FROM clientes; DELETE FROM situacoes_financeiras; DELETE FROM situacoes_credito; DELETE FROM condicoes_pagamento; DELETE FROM tabelas_preco; DELETE FROM produtos_bilhete; DELETE FROM precos; DELETE FROM cache_metadata;');
  db.prepare(`INSERT INTO clientes
    (filial,codigo,loja,nome,condicao_pagamento,tabela_preco,risco,limite_credito,status,excluido,dados_json,atualizado_em)
    VALUES ('01',?,'01','CLIENTE TESTE',?,'001','D',3000,'1',0,'{}',?)`).run(codigo, condicao, agora);
  db.prepare(`INSERT INTO condicoes_pagamento (filial,codigo,descricao,status,excluido,atualizado_em)
    VALUES ('01',?,'CONDICAO','1',0,?)`).run(condicao, agora);
  db.prepare(`INSERT INTO tabelas_preco (filial,codigo,descricao,inicio,fim,status,excluido,atualizado_em)
    VALUES ('01','001','TABELA GERAL',NULL,NULL,'1',0,?)`).run(agora);
  db.prepare(`INSERT INTO produtos_bilhete (codigo,descricao,tipo,status,ativo,unidade,excluido,atualizado_em)
    VALUES ('253.013','UVA BLACK','PA','1','1','CX',0,?)`).run(agora);
  db.prepare(`INSERT INTO precos (tabela,produto,preco,ativo,validade,atualizado_em)
    VALUES ('001','253.013',60,1,NULL,?)`).run(agora);
  db.prepare(`INSERT INTO situacoes_credito (filial,codigo,loja,saldo_credito,inadimplencia,atualizado_em)
    VALUES ('01',?,'01',?,0,?)`).run(codigo, saldo, agora);
  for (const chave of ['clientes_sync', 'financeiro_sync', 'produtos_sync', 'precos_001']) {
    db.prepare('INSERT INTO cache_metadata (chave,valor,atualizado_em) VALUES (?,?,?)').run(chave, agora, agora);
  }
}

function venda(total = 6000, codigo = '000004', nomeAVista = '') {
  return {
    cliente: { codigo, loja: '01', nomeAVista },
    itens: [{ produto: { codigo: '253.013' }, quantidade: 1, valorUnitario: total, desconto: 0 }],
    desconto: 0,
    total,
  };
}

test('exige nome de até 40 caracteres para o cliente à vista 0001', () => {
  prepararCliente({ codigo: '0001', condicao: '001', saldo: 0 });
  assert.ok(validarBilheteLocal(venda(6000, '0001')).erros.some((erro) => erro.includes('nome do cliente à vista')));
  assert.ok(validarBilheteLocal(venda(6000, '0001', 'A'.repeat(41))).erros.some((erro) => erro.includes('máximo 40')));
  assert.ok(!validarBilheteLocal(venda(6000, '0001', 'MARIA DA SILVA')).erros.some((erro) => erro.includes('nome do cliente à vista')));
});

test('bloqueia condição a prazo quando o saldo calculado pela REST é insuficiente', () => {
  prepararCliente({ condicao: '010', saldo: 50 });
  const resultado = validarBilheteLocal(venda(6000));
  assert.ok(resultado.erros.some((erro) => erro.includes('saldo de crédito suficiente')));
});

for (const condicao of ['001', '033', '200', '901']) {
  test(`permite falta de crédito na condição à vista ${condicao}`, () => {
    prepararCliente({ condicao, saldo: 0 });
    const resultado = validarBilheteLocal(venda(6000));
    assert.ok(!resultado.erros.some((erro) => erro.includes('saldo de crédito suficiente')));
  });
}

test('bloqueia quando o snapshot de crédito ainda não existe', () => {
  prepararCliente({ condicao: '010', saldo: 100 });
  getProtheusCacheDb().prepare('DELETE FROM situacoes_credito').run();
  const resultado = validarBilheteLocal(venda(6000));
  assert.ok(resultado.erros.some((erro) => erro.includes('ainda não foi sincronizado')));
});

test('aceita preço acima do mínimo e rejeita preço abaixo da tabela', () => {
  prepararCliente({ condicao: '001', saldo: 0 });
  assert.ok(!validarBilheteLocal(venda(6100)).erros.some((erro) => erro.includes('abaixo do mínimo')));
  assert.ok(validarBilheteLocal(venda(5900)).erros.some((erro) => erro.includes('abaixo do mínimo')));
});
