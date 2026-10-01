import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import sql from 'mssql';
import { situacaoBilhete, consultarSituacaoBilhetes, conferirBilhetesProtheus } from './conferencia-bilhetes-protheus.js';
import { enviarVendaAoProtheus, processarFilaProtheus } from './fila-protheus.js';

const venda = { id: 'v1', status_protheus: 'INTEGRADO', bilhete_protheus: 'SAS001', id_integracao: 'pdv-id-1' };
const registro = { filial: '01', bilhete: 'SAS001', idIntegracao: 'pdv-id-1', excluido: '*' };
function criarDb() {
  const db = new Database(':memory:');
  db.exec(`CREATE TABLE vendas (id TEXT PRIMARY KEY, status_protheus TEXT, bilhete_protheus TEXT, id_integracao TEXT,
    deletado TEXT DEFAULT '', criado_em TEXT, protheus_conferido_em TEXT, protheus_excluido_em TEXT,
    protheus_status_antes_exclusao TEXT, protheus_atualizado_em TEXT, payload_protheus TEXT, resultado_protheus TEXT, total INTEGER,
    tipo_operacao TEXT DEFAULT 'BILHETE');
    CREATE TABLE venda_itens (id TEXT, venda_id TEXT, valor_total INTEGER);`);
  db.prepare(`INSERT INTO vendas (id,status_protheus,bilhete_protheus,id_integracao,criado_em,total,payload_protheus,resultado_protheus)
    VALUES ('v1','INTEGRADO','SAS001','pdv-id-1','2026-09-30T12:00:00Z',12500,?,?)`)
    .run(JSON.stringify({ body: { _id: 'pdv-id-1' } }), JSON.stringify({ sucesso: true, bilhete: 'SAS001' }));
  db.exec("INSERT INTO venda_itens VALUES ('item-1','v1',12500)");
  return db;
}

test('exclusão exige filial, bilhete e ID correspondentes; ausência, duplicidade ou marca inválida não confirmam exclusão', () => {
  assert.deepEqual(situacaoBilhete(venda, [registro]), { situacao: 'EXCLUIDO', bilhete: 'SAS001' });
  assert.equal(situacaoBilhete(venda, [{ ...registro, excluido: ' ' }]).situacao, 'ATIVO');
  for (const registros of [[], [{ ...registro, filial: '02' }], [{ ...registro, bilhete: 'OUTRO' }],
    [{ ...registro, idIntegracao: 'outra-venda' }], [registro, registro], [{ ...registro, excluido: null }]]) {
    assert.ok(!['EXCLUIDO', 'ATIVO'].includes(situacaoBilhete(venda, registros).situacao));
  }
  assert.equal(situacaoBilhete({ ...venda, id_integracao: '' }, [registro]).situacao, 'DIVERGENTE');
  assert.equal(situacaoBilhete({ ...venda, payload_protheus: JSON.stringify({ headers: { TenantId: '99,01' } }) }, [registro]).situacao, 'DIVERGENTE');
});

test('ID legado truncado em 30 caracteres pode ser conferido, prefixo menor é recusado', () => {
  const id = 'abcdefghijabcdefghijabcdefghij123456';
  assert.equal(situacaoBilhete({ ...venda, id_integracao: id }, [{ ...registro, idIntegracao: id.slice(0, 30) }]).situacao, 'EXCLUIDO');
  assert.equal(situacaoBilhete({ ...venda, id_integracao: id }, [{ ...registro, idIntegracao: id.slice(0, 20) }]).situacao, 'NAO_LOCALIZADO');
});

test('confirma exclusão, preserva histórico e valores e bloqueia fila/envio sem chamar HTTP', async () => {
  const db = criarDb(); const original = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('Não pode fazer POST/GET externo.'); };
  try {
    const antes = db.prepare('SELECT * FROM vendas').get();
    const resumo = await conferirBilhetesProtheus({ db, consultar: async () => [registro], agora: '2026-09-30T13:00:00Z' });
    assert.equal(resumo.excluidas, 1);
    const depois = db.prepare('SELECT * FROM vendas').get();
    assert.equal(depois.status_protheus, 'EXCLUIDO_PROTHEUS');
    assert.equal(depois.protheus_status_antes_exclusao, 'INTEGRADO');
    for (const campo of ['total', 'payload_protheus', 'resultado_protheus', 'deletado']) assert.equal(depois[campo], antes[campo]);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM venda_itens').get().n, 1);
    assert.match((await enviarVendaAoProtheus(db, 'v1')).erro, /excluído/);
    assert.equal((await processarFilaProtheus('teste', db)).processadas, 0);
  } finally { globalThis.fetch = original; db.close(); }
});

test('registro não localizado ou erro de rede não cancela venda; falha preserva todos os dados', async () => {
  const db = criarDb();
  try {
    const resumo = await conferirBilhetesProtheus({ db, consultar: async () => [] });
    assert.equal(resumo.naoLocalizadas, 1);
    assert.equal(db.prepare('SELECT status_protheus FROM vendas').get().status_protheus, 'INTEGRADO');
    const antes = db.prepare('SELECT * FROM vendas').get();
    await assert.rejects(conferirBilhetesProtheus({ db, consultar: async () => { throw new Error('SQL sem conexão'); } }), /SQL sem conexão/);
    assert.deepEqual(db.prepare('SELECT * FROM vendas').get(), antes);
  } finally { db.close(); }
});

test('mesmo bilhete restaurado no ERP volta a integrado, sem novo envio ou alteração de valor', async () => {
  const db = criarDb();
  try {
    await conferirBilhetesProtheus({ db, consultar: async () => [registro] });
    const resumo = await conferirBilhetesProtheus({ db, consultar: async () => [{ ...registro, excluido: '' }] });
    assert.equal(resumo.restauradas, 1);
    const atual = db.prepare('SELECT * FROM vendas').get();
    assert.equal(atual.status_protheus, 'INTEGRADO'); assert.equal(atual.protheus_excluido_em, null); assert.equal(atual.total, 12500);
  } finally { db.close(); }
});

test('conferências simultâneas compartilham consulta e não duplicam a atualização', async () => {
  const db = criarDb(); let consultas = 0; let liberar;
  const aguardar = new Promise(resolve => { liberar = resolve; });
  const consultar = async () => { consultas++; await aguardar; return [registro]; };
  try {
    const p1 = conferirBilhetesProtheus({ db, consultar }); const p2 = conferirBilhetesProtheus({ db, consultar });
    liberar(); const resultados = await Promise.all([p1, p2]);
    assert.equal(consultas, 1); assert.deepEqual(resultados[0], resultados[1]);
  } finally { db.close(); }
});

test('SELECT consulta inclusive excluídos, usa parâmetros e fecha conexão em falha de um lote posterior', async () => {
  const original = sql.ConnectionPool; let consultas = 0; let fechado = false; const entradas = [];
  sql.ConnectionPool = class {
    async connect() {}
    request() { return { input(nome, tipo, valor) { entradas.push([nome, valor]); return this; }, async query(texto) {
      assert.match(texto.trim(), /^SELECT /); assert.match(texto, /D_E_L_E_T_ AS excluido/);
      assert.doesNotMatch(texto, /D_E_L_E_T_\s*=/); assert.doesNotMatch(texto, /\b(UPDATE|INSERT|DELETE|EXEC|MERGE)\b/i);
      consultas++; if (consultas === 2) throw new Error('lote 2 indisponível'); return { recordset: [registro] };
    } }; }
    async close() { fechado = true; }
  };
  try {
    await assert.rejects(consultarSituacaoBilhetes(Array.from({ length: 101 }, (_, i) => ({ ...venda, id_integracao: `id-${i}` }))), /lote 2/);
    assert.equal(consultas, 2); assert.equal(fechado, true);
    assert.deepEqual(entradas[0], ['id0', 'id-0']);
    assert.deepEqual(entradas[1], ['bilhete0', 'SAS001']);
  } finally { sql.ConnectionPool = original; }
});

test('tentativa com resultado incerto verifica exclusão antes de qualquer POST', async () => {
  const db = criarDb(); const originalPool = sql.ConnectionPool; const originalFetch = globalThis.fetch;
  db.prepare("UPDATE vendas SET status_protheus='CONFERIR',protheus_atualizado_em='2026-09-30T12:00:00Z'").run();
  sql.ConnectionPool = class { async connect() {} request() { return { input() { return this; }, async query() { return { recordset: [registro] }; } }; } async close() {} };
  globalThis.fetch = () => { throw new Error('Não pode enviar bilhete excluído.'); };
  try {
    const r = await enviarVendaAoProtheus(db, 'v1');
    assert.equal(r.http, 409); assert.match(r.erro, /excluído/);
    assert.equal(db.prepare('SELECT status_protheus FROM vendas').get().status_protheus, 'EXCLUIDO_PROTHEUS');
  } finally { sql.ConnectionPool = originalPool; globalThis.fetch = originalFetch; db.close(); }
});
