import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { aplicarUnidadesBilhete } from './sync-unidades-bilhete.js';

test('complementa catálogo do bilhete sem modificar preços nem incluir produtos fora dele', () => {
  const db = new Database(':memory:');
  try {
    db.exec(`CREATE TABLE produtos_bilhete (codigo TEXT PRIMARY KEY, unidade TEXT,
      segunda_unidade TEXT, fator_conversao REAL, tipo_conversao TEXT);
      CREATE TABLE precos (produto TEXT, preco REAL);
      INSERT INTO produtos_bilhete VALUES ('131.003','CX',NULL,NULL,NULL);
      INSERT INTO precos VALUES ('131.003',50);`);
    const produto = { codigo: '131.003', unidade: 'CX', segunda_unidade: 'KG', fator_conversao: 20, tipo_conversao: 'M' };
    assert.equal(aplicarUnidadesBilhete(db, [produto, { ...produto, codigo: 'FORA' }]), 1);
    assert.deepEqual(db.prepare('SELECT * FROM produtos_bilhete').all(), [produto]);
    assert.equal(db.prepare('SELECT preco FROM precos').get().preco, 50);
    assert.throws(() => aplicarUnidadesBilhete(db, [{ ...produto, fator_conversao: 10 }, { codigo: 'incompleto' }]));
    assert.equal(db.prepare('SELECT fator_conversao FROM produtos_bilhete').get().fator_conversao, 20);
  } finally {
    db.close();
  }
});
