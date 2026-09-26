import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { enviarVendaAoProtheus, processarFilaProtheus } from './fila-protheus.js';
import { URL_TESTE_4SALES } from './protheus-4sales-test.js';
import { cifrarSenhaProtheus } from './credenciais-protheus.js';

// Fixo pro arquivo inteiro (não precisa ir/voltar por teste como PROTHEUS_REST_USER/PASSWORD):
// cifrarSenhaProtheus só é chamado nesse arquivo, então não há senha real de operador em jogo.
process.env.PROTHEUS_CRED_SECRET = process.env.PROTHEUS_CRED_SECRET || 'segredo-teste-fila-protheus';

function criarDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE vendas (
      id TEXT PRIMARY KEY, numero_cupom TEXT, loja TEXT, caixa TEXT, operador TEXT, usuario_id TEXT,
      cliente_nome TEXT, cliente_cpf TEXT, subtotal INTEGER, desconto INTEGER, total INTEGER,
      forma_pagamento TEXT, criado_em TEXT, data_local TEXT, deletado TEXT NOT NULL DEFAULT '',
      status_protheus TEXT NOT NULL DEFAULT 'LOCAL', valor_recebido INTEGER, troco INTEGER,
      editado_em TEXT, bilhete_protheus TEXT, resultado_protheus TEXT, payload_protheus TEXT,
      protheus_atualizado_em TEXT, id_integracao TEXT
    );
    CREATE TABLE venda_itens (
      id TEXT PRIMARY KEY, venda_id TEXT NOT NULL, codigo_produto TEXT, descricao TEXT,
      quantidade REAL, valor_unitario INTEGER, desconto INTEGER, valor_total INTEGER
    );
    CREATE TABLE usuarios (
      id TEXT PRIMARY KEY, nome TEXT, protheus_vend_codigo TEXT, protheus_vend_nome TEXT,
      protheus_usr_codigo TEXT, protheus_usr_senha_cifrada TEXT
    );
  `);
  return db;
}

// Bem no passado por padrão — processarFilaProtheus ignora vendas criadas há menos de 90s (dá
// prioridade ao envio direto do PDV), então testes que usam a fila precisam de vendas "antigas".
const HA_5_MINUTOS = () => new Date(Date.now() - 5 * 60 * 1000).toISOString();

function inserirVenda(db, id, overrides = {}) {
  db.prepare(`
    INSERT INTO vendas (id, numero_cupom, loja, caixa, operador, usuario_id, cliente_nome, cliente_cpf, subtotal, desconto, total, forma_pagamento, criado_em, data_local)
    VALUES (@id, '000001', '01', '001', 'Operador Teste', 'usuario-teste', 'Cliente', '', 33000, 0, 33000, '033', @criado_em, '2026-09-23')
  `).run({ id, criado_em: overrides.criado_em || HA_5_MINUTOS() });
  db.prepare(`
    INSERT INTO venda_itens (id, venda_id, codigo_produto, descricao, quantidade, valor_unitario, desconto, valor_total)
    VALUES (@id, @venda_id, '199.029', 'MACA', 2, 16500, 0, 33000)
  `).run({ id: `${id}-item`, venda_id: id });
  // Um único operador reaproveitado entre vendas, referenciado pela chave estável usuario_id.
  db.prepare(`
    INSERT OR IGNORE INTO usuarios (id, nome, protheus_vend_codigo, protheus_vend_nome, protheus_usr_codigo, protheus_usr_senha_cifrada)
    VALUES ('usuario-teste', 'Operador Teste', '000090', 'Vendedor Teste', 'usr.teste', @senhaCifrada)
  `).run({ senhaCifrada: cifrarSenhaProtheus('senha-teste') });
}

// Mocka as duas consultas feitas por prepararVenda4Sales (cliente + tabela de preços) e o POST final.
function mockFetchSucesso() {
  return async (url) => {
    const href = String(url);
    if (href.includes('api/tgv/sellers/codeuser')) {
      return new Response(JSON.stringify({ items: [{ branchid: '01', code: '000090', name: 'Vendedor Teste', userid: '000001', isseller: true }] }), { status: 200 });
    }
    if (href.includes('customers/YDOVT3/01')) {
      return new Response(JSON.stringify({ code: 'YDOVT3', store: '01', pricelist: '015', name: 'Cliente Teste' }), { status: 200 });
    }
    if (href.includes('itensTablePrice')) {
      return new Response(JSON.stringify({ items: [{ itemCode: '199.029 ', activeItemPrice: '1', minimumSalesPrice: 165 }], hasNext: false }), { status: 200 });
    }
    if (href === URL_TESTE_4SALES) {
      return new Response(JSON.stringify({ idWeb: '000001-0001-000001-20260923', company: '14', branch: '01', status: 'EFE', ticket: 'TESTE01' }), { status: 200 });
    }
    throw new Error(`URL inesperada no teste: ${href}`);
  };
}

// Mesma coisa, mas serve qualquer venda — o POST ecoa de volta o _id que foi enviado no corpo.
function mockFetchSucessoGenerico() {
  return async (url, opcoes) => {
    const href = String(url);
    if (href.includes('api/tgv/sellers/codeuser')) {
      return new Response(JSON.stringify({ items: [{ branchid: '01', code: '000090', name: 'Vendedor Teste', userid: '000001', isseller: true }] }), { status: 200 });
    }
    if (href.includes('customers/YDOVT3/01')) {
      return new Response(JSON.stringify({ code: 'YDOVT3', store: '01', pricelist: '015', name: 'Cliente Teste' }), { status: 200 });
    }
    if (href.includes('itensTablePrice')) {
      return new Response(JSON.stringify({ items: [{ itemCode: '199.029 ', activeItemPrice: '1', minimumSalesPrice: 165 }], hasNext: false }), { status: 200 });
    }
    if (href === URL_TESTE_4SALES) {
      const corpo = JSON.parse(opcoes.body);
      return new Response(JSON.stringify({ idWeb: corpo._id, company: '14', branch: '01', status: 'EFE', ticket: 'TESTE01' }), { status: 200 });
    }
    throw new Error(`URL inesperada no teste: ${href}`);
  };
}

async function comCredenciais(fn) {
  const originalFetch = globalThis.fetch;
  const oldUser = process.env.PROTHEUS_REST_USER;
  const oldPass = process.env.PROTHEUS_REST_PASSWORD;
  process.env.PROTHEUS_REST_USER = 'teste';
  process.env.PROTHEUS_REST_PASSWORD = 'teste';
  try {
    await fn();
  } finally {
    globalThis.fetch = originalFetch;
    if (oldUser === undefined) delete process.env.PROTHEUS_REST_USER; else process.env.PROTHEUS_REST_USER = oldUser;
    if (oldPass === undefined) delete process.env.PROTHEUS_REST_PASSWORD; else process.env.PROTHEUS_REST_PASSWORD = oldPass;
  }
}

test('venda inexistente devolve 404, sem mexer em nada', async () => {
  const db = criarDb();
  const r = await enviarVendaAoProtheus(db, 'nao-existe');
  assert.equal(r.http, 404);
  assert.equal(r.sucesso, false);
});

test('venda já enviada (não LOCAL) não é reprocessada', async () => {
  const db = criarDb();
  inserirVenda(db, 'v1');
  db.prepare("UPDATE vendas SET status_protheus = 'INTEGRADO' WHERE id = 'v1'").run();
  const r = await enviarVendaAoProtheus(db, 'v1');
  assert.equal(r.http, 409);
});

test('chamadas concorrentes na mesma venda: só uma processa, a outra vê "em andamento"', async () => {
  await comCredenciais(async () => {
    const db = criarDb();
    inserirVenda(db, 'v1');
    let liberarFetch;
    const travado = new Promise((resolve) => { liberarFetch = resolve; });
    globalThis.fetch = async (url) => {
      await travado;
      return mockFetchSucesso('v1')(url);
    };
    const p1 = enviarVendaAoProtheus(db, 'v1');
    // A reserva (LOCAL -> PREPARANDO) acontece de forma síncrona antes do primeiro await de rede,
    // então a segunda chamada já enxerga o status alterado e recusa reprocessar.
    const r2 = await enviarVendaAoProtheus(db, 'v1');
    assert.equal(r2.http, 409);
    assert.equal(r2.sucesso, false);
    liberarFetch();
    const r1 = await p1;
    assert.equal(r1.sucesso, true);
  });
});

test('sucesso: venda fica INTEGRADO com o bilhete devolvido pelo Protheus', async () => {
  await comCredenciais(async () => {
    const db = criarDb();
    inserirVenda(db, 'v1');
    globalThis.fetch = mockFetchSucesso('v1');
    const r = await enviarVendaAoProtheus(db, 'v1');
    assert.equal(r.sucesso, true);
    assert.equal(r.bilhete, 'TESTE01');
    const venda = db.prepare('SELECT status_protheus, bilhete_protheus FROM vendas WHERE id = ?').get('v1');
    assert.equal(venda.status_protheus, 'INTEGRADO');
    assert.equal(venda.bilhete_protheus, 'TESTE01');
  });
});

test('falha de rede: venda volta pra LOCAL (fila) com semInternet = true', async () => {
  await comCredenciais(async () => {
    const db = criarDb();
    inserirVenda(db, 'v1');
    globalThis.fetch = async () => { throw new Error('fetch failed'); };
    const r = await enviarVendaAoProtheus(db, 'v1');
    assert.equal(r.sucesso, false);
    assert.equal(r.semInternet, true);
    const venda = db.prepare('SELECT status_protheus FROM vendas WHERE id = ?').get('v1');
    assert.equal(venda.status_protheus, 'LOCAL');
  });
});

test('processarFilaProtheus envia as pendentes e para no primeiro sinal de "sem internet"', async () => {
  await comCredenciais(async () => {
    const db = criarDb();
    inserirVenda(db, 'v1', { criado_em: new Date(Date.now() - 5 * 60 * 1000 + 0).toISOString() });
    inserirVenda(db, 'v2', { criado_em: new Date(Date.now() - 5 * 60 * 1000 + 1000).toISOString() });
    inserirVenda(db, 'v3', { criado_em: new Date(Date.now() - 5 * 60 * 1000 + 2000).toISOString() });

    // v1 vai com sucesso; a partir da segunda tentativa, sem rede.
    let chamada = 0;
    const fetchSucesso = mockFetchSucesso('v1');
    globalThis.fetch = async (url, opts) => {
      chamada += 1;
      if (chamada <= 3) return fetchSucesso(url, opts); // vendedor + cliente + preços de v1
      if (chamada === 4) return fetchSucesso(url, opts); // POST de v1
      throw new Error('fetch failed'); // v2 falha por rede a partir daqui
    };

    const resultado = await processarFilaProtheus('teste', db);
    assert.equal(resultado.enviadas, 1);
    assert.equal(resultado.semInternet, true);
    assert.equal(resultado.falhas, 0);
    const status = db.prepare('SELECT id, status_protheus FROM vendas ORDER BY id').all();
    assert.deepEqual(status, [
      { id: 'v1', status_protheus: 'INTEGRADO' },
      { id: 'v2', status_protheus: 'LOCAL' },
      { id: 'v3', status_protheus: 'LOCAL' },
    ]);
  });
});

test('processarFilaProtheus não faz nada quando não há vendas pendentes', async () => {
  const db = criarDb();
  const r = await processarFilaProtheus('teste', db);
  assert.equal(r.processadas, 0);
});

test('processarFilaProtheus ignora venda criada há pouco tempo (dá prioridade ao envio direto do PDV)', async () => {
  const db = criarDb();
  inserirVenda(db, 'recente', { criado_em: new Date().toISOString() });
  const r = await processarFilaProtheus('teste', db);
  assert.equal(r.processadas, 0);
  const venda = db.prepare('SELECT status_protheus FROM vendas WHERE id = ?').get('recente');
  assert.equal(venda.status_protheus, 'LOCAL');
});

test('venda "em andamento" por outra tentativa conta separado de falha real, não como falha', async () => {
  await comCredenciais(async () => {
    const db = criarDb();
    // v0 é processada primeiro pela fila e fica travada na 1ª consulta de rede — dá tempo do envio
    // direto (como o PDV faria) reservar e concluir v1 antes da fila conseguir chegar nela.
    inserirVenda(db, 'v0', { criado_em: new Date(Date.now() - 5 * 60 * 1000 + 0).toISOString() });
    inserirVenda(db, 'v1', { criado_em: new Date(Date.now() - 5 * 60 * 1000 + 1000).toISOString() });

    let liberarV0;
    const travadoV0 = new Promise((resolve) => { liberarV0 = resolve; });
    let primeiraConsultaEmAndamento = true;
    const fetchBase = mockFetchSucessoGenerico();
    globalThis.fetch = async (url, opcoes) => {
      if (String(url).includes('customers/YDOVT3/01') && primeiraConsultaEmAndamento) {
        primeiraConsultaEmAndamento = false;
        await travadoV0;
      }
      return fetchBase(url, opcoes);
    };

    const filaPromise = processarFilaProtheus('teste', db);
    // Deixa a fila rodar até travar na consulta de v0 antes de disparar o envio direto de v1.
    await new Promise((resolve) => setTimeout(resolve, 10));
    const envioDireto = await enviarVendaAoProtheus(db, 'v1');
    assert.equal(envioDireto.sucesso, true);

    liberarV0();
    const resultadoFila = await filaPromise;

    assert.equal(resultadoFila.emAndamento, 1);
    assert.equal(resultadoFila.falhas, 0);
  });
});
