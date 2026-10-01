import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.PDV_DB_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'pdv-conta-central-'));
process.env.API_PORT = '0';
const { getDb } = await import('./db.js');
const { iniciarApi } = await import('./api.js');
const db = getDb();
const servidor = await iniciarApi();
after(() => new Promise(resolve => servidor.close(resolve)));
const base = `http://localhost:${servidor.address().port}`;
const fetchHttp = globalThis.fetch;
const json = async (rota, token, corpo) => {
  const resposta = await fetchHttp(base+rota,{method:corpo?'POST':'GET',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},...(corpo?{body:JSON.stringify(corpo)}:{})});
  return {status:resposta.status,corpo:await resposta.json()};
};

for (const n of ['1','2']) {
  db.prepare('INSERT INTO protheus_usuarios (codigo,id_protheus,nome,atualizado_em) VALUES (?,?,?,?)').run(`login${n}`,`00010${n}`,`Operador ${n}`,'2026-09-30');
  db.prepare('INSERT INTO protheus_vendedores (filial,codigo,nome,usuario_codigo,atualizado_em) VALUES (?,?,?,?,?)').run('01',`00000${n}`,`Vendedor ${n}`,`00010${n}`,'2026-09-30');
  db.prepare(`INSERT INTO usuarios (id,nome,login,senha_hash,papel,criado_em,protheus_usr_codigo,protheus_vend_filial,protheus_vend_codigo,protheus_vend_nome)
    VALUES (?,?,?,'hash-nao-usado',?,'2026-09-30',?,'01',?,?)`).run(`u${n}`,`Operador ${n}`,`pdv${n}`,n==='1'?'ADMIN':'OPERADOR',`login${n}`,`00000${n}`,`Vendedor ${n}`);
  db.prepare("INSERT INTO sessoes (token,usuario_id,criado_em) VALUES (?,?,'2026-09-30')").run(`token${n}`,`u${n}`);
}

test('contas sem senha REST individual podem vender e guardam seu vendedor sem aceitar vendedor do navegador', async () => {
  const ids=[];
  for(const n of ['1','2']) {
    const venda={numeroCupom:'ignorado',loja:'01',caixa:'001',cliente:{nome:'Cliente',cpf:''},subtotal:1800,desconto:0,total:1800,formaPagamento:'033',
      vendedor_codigo:'999999',usuario_id:'outro',protheus_usr_id:'999999',
      itens:[{produto:{codigo:'100.074',descricao:'OVO',unidade:'FM'},quantidade:1,valorUnitario:1800,valorTotal:1800,desconto:0}]};
    const resultado=await json('/api/vendas',`token${n}`,venda);
    assert.equal(resultado.status,200,JSON.stringify(resultado.corpo));
    ids.push(resultado.corpo.id);
    const salva=db.prepare('SELECT vendedor_codigo,vendedor_nome,protheus_usr_id,id_integracao FROM vendas WHERE id=?').get(resultado.corpo.id);
    assert.equal(salva.vendedor_codigo,`00000${n}`); assert.equal(salva.protheus_usr_id,`00010${n}`);
    assert.equal(salva.id_integracao.length,27);
  }
  db.prepare("UPDATE usuarios SET protheus_vend_codigo='000002',protheus_vend_nome='ALTERADO' WHERE id='u1'").run();
  const detalhe=await json(`/api/vendas/${ids[0]}`,'token1');
  assert.equal(detalhe.corpo.impressao.vendedorCodigo,'000001');
  assert.equal(detalhe.corpo.impressao.vendedorNome,'Vendedor 1');
});

test('API salva venda PDV pelo total de cada item arredondado, mesmo com frontend antigo', async () => {
  db.prepare("UPDATE usuarios SET protheus_vend_codigo='000001', protheus_vend_nome='Vendedor 1' WHERE id='u1'").run();
  const venda = { loja: '01', caixa: '001', cliente: { nome: 'Cliente', cpf: '' },
    subtotal: 2386.3, desconto: 0, total: 2386.3, formaPagamento: '001',
    itens: [
      { produto: { codigo: '217.050', descricao: 'TANGERINA', unidade: 'KG' }, quantidade: 0.71, valorUnitario: 1350, valorTotal: 959, desconto: 0 },
      { produto: { codigo: '210.025', descricao: 'MELANCIA', unidade: 'KG' }, quantidade: 2.42, valorUnitario: 590, valorTotal: 1428, desconto: 0 },
    ] };
  const resposta = await json('/api/vendas', 'token1', venda);
  assert.equal(resposta.status, 200, JSON.stringify(resposta.corpo));
  assert.deepEqual(db.prepare('SELECT subtotal, total FROM vendas WHERE id=?').get(resposta.corpo.id), { subtotal: 2387, total: 2387 });
});

test('API aceita somente o total KG half up antes do pagamento', async () => {
  const venda = { loja: '01', caixa: '001', cliente: { nome: 'Cliente', cpf: '' },
    subtotal: 782, desconto: 0, total: 782, formaPagamento: '001',
    itens: [{ produto: { codigo: '211.064', descricao: 'MELAO CEPI', unidade: 'KG' }, quantidade: 0.99,
      valorUnitario: 790, valorTotal: 782, desconto: 0 }] };
  const resposta = await json('/api/vendas', 'token1', venda);
  assert.equal(resposta.status, 200, JSON.stringify(resposta.corpo));
  assert.equal(db.prepare('SELECT total FROM vendas WHERE id=?').get(resposta.corpo.id).total, 782);
  assert.equal((await json('/api/vendas', 'token1', { ...venda, itens: [{ ...venda.itens[0], valorTotal: 783 }] })).status, 400);
});

test('API grava exemplo 6,06 × 16,90 como R$ 102,41', async () => {
  const venda = { loja: '01', caixa: '001', cliente: { nome: 'Cliente', cpf: '' },
    subtotal: 10241, desconto: 0, total: 10241, formaPagamento: '001',
    itens: [{ produto: { codigo: '211.064', descricao: 'MELAO CEPI', unidade: 'KG', segundaUnidade: 'KG', fatorConversao: 1, tipoConversao: 'D' }, quantidade: 6.06,
      valorUnitario: 1690, valorTotal: 10241, desconto: 0 }] };
  const resposta = await json('/api/vendas', 'token1', venda);
  assert.equal(resposta.status, 200, JSON.stringify(resposta.corpo));
  assert.deepEqual(db.prepare('SELECT quantidade,valor_unitario,valor_total,quantidade2 FROM venda_itens WHERE venda_id=?').get(resposta.corpo.id),
    { quantidade: 6.06, valor_unitario: 1690, valor_total: 10241, quantidade2: 6.06 });
});

test('edita quantidade apenas em venda PDV rejeitada, recalcula e registra auditoria sem reenviar', async () => {
  const venda = { loja: '01', caixa: '001', cliente: { nome: 'Cliente', cpf: '' },
    subtotal: 782, desconto: 0, total: 782, formaPagamento: '001',
    itens: [{ produto: { codigo: '211.064', descricao: 'MELAO CEPI', unidade: 'KG' }, quantidade: 0.99,
      valorUnitario: 790, valorTotal: 782, desconto: 0 }] };
  const criada = await json('/api/vendas', 'token1', venda);
  assert.equal(criada.status, 200);
  const id = criada.corpo.id;
  const item = db.prepare('SELECT id FROM venda_itens WHERE venda_id=?').get(id);
  const rota = `/api/vendas/${id}/itens/${item.id}/quantidade`;
  const editar = async (quantidade, token = 'token1') => {
    const resposta = await fetchHttp(base + rota, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ quantidade }) });
    return { status: resposta.status, corpo: await resposta.json() };
  };
  assert.equal((await editar(1)).status, 409);
  db.prepare("UPDATE vendas SET status_protheus='REJEITADO', payload_protheus='{}' WHERE id=?").run(id);
  assert.equal((await editar(0)).status, 400);
  const editada = await editar(1, 'token2');
  assert.equal(editada.status, 200, JSON.stringify(editada.corpo));
  assert.equal(editada.corpo.total, 790);
  assert.deepEqual(db.prepare('SELECT quantidade, valor_total FROM venda_itens WHERE id=?').get(item.id), { quantidade: 1, valor_total: 790 });
  const depois = db.prepare('SELECT total,subtotal,status_protheus,payload_protheus,editado_em FROM vendas WHERE id=?').get(id);
  assert.equal(depois.total, 790); assert.equal(depois.subtotal, 790);
  assert.equal(depois.status_protheus, 'REJEITADO'); assert.equal(depois.payload_protheus, null);
  assert.ok(depois.editado_em);
  assert.deepEqual(db.prepare('SELECT usuario_id,quantidade_anterior,quantidade_nova,total_venda_anterior,total_venda_novo FROM venda_edicoes_quantidade WHERE venda_id=?').get(id),
    { usuario_id: 'u2', quantidade_anterior: 0.99, quantidade_nova: 1, total_venda_anterior: 782, total_venda_novo: 790 });
  assert.equal((await editar(1.0001)).status, 400);
});

test('recalcula apenas itens KG com teto legado, sem alterar quantidade ou reenviar', async () => {
  const itens = [
    { produto: { codigo: 'KG1', descricao: 'MELAO', unidade: 'KG' }, quantidade: 0.99, valorUnitario: 790, valorTotal: 782, desconto: 0 },
    { produto: { codigo: 'KG2', descricao: 'OUTRO KG', unidade: 'KG' }, quantidade: 6.06, valorUnitario: 1690, valorTotal: 10241, desconto: 0 },
    { produto: { codigo: 'UN1', descricao: 'CAIXA', unidade: 'UN' }, quantidade: 2, valorUnitario: 100, valorTotal: 200, desconto: 0 },
  ];
  const venda = { loja: '01', caixa: '001', cliente: { nome: 'Cliente', cpf: '' },
    subtotal: 11223, desconto: 0, total: 11223, formaPagamento: 'Dinheiro', valorRecebido: 12000, troco: 777, itens };
  const criada = await json('/api/vendas', 'token1', venda);
  assert.equal(criada.status, 200, JSON.stringify(criada.corpo));
  const id = criada.corpo.id;
  const gravados = db.prepare('SELECT id,codigo_produto,quantidade,valor_total FROM venda_itens WHERE venda_id=? ORDER BY rowid').all(id);
  db.prepare('UPDATE venda_itens SET valor_total=valor_total+1 WHERE venda_id=? AND codigo_produto IN (\'KG1\',\'KG2\')').run(id);
  db.prepare("UPDATE vendas SET total=11225,subtotal=11225,troco=775,status_protheus='REJEITADO',payload_protheus='{}' WHERE id=?").run(id);
  const rota = `/api/vendas/${id}/recalcular-arredondamento`;
  const confirmar = (totalAtualEsperado, totalEsperado, token = 'token2') =>
    json(rota, token, { confirmado: true, totalAtualEsperado, totalEsperado });
  assert.equal((await json(rota, 'token2', { totalAtualEsperado: 11225, totalEsperado: 11223 })).status, 400);
  assert.equal((await confirmar(11224, 11223)).status, 409);
  assert.equal((await confirmar(11225, 11224)).status, 409);
  assert.equal(db.prepare('SELECT total FROM vendas WHERE id=?').get(id).total, 11225);
  const resultado = await confirmar(11225, 11223);
  assert.deepEqual(resultado, { status: 200, corpo: { sucesso: true, totalAnterior: 11225, total: 11223, itensAjustados: 2 } });
  assert.deepEqual(db.prepare('SELECT codigo_produto,quantidade,valor_total FROM venda_itens WHERE venda_id=? ORDER BY rowid').all(id),
    gravados.map(({ codigo_produto, quantidade, valor_total }) => ({ codigo_produto, quantidade, valor_total })));
  assert.deepEqual(db.prepare('SELECT total,subtotal,troco,status_protheus,payload_protheus FROM vendas WHERE id=?').get(id),
    { total: 11223, subtotal: 11223, troco: 777, status_protheus: 'REJEITADO', payload_protheus: null });
  assert.deepEqual(db.prepare('SELECT usuario_id,total_item_anterior,total_item_novo,total_venda_anterior,total_venda_novo FROM venda_ajustes_preco WHERE venda_id=? ORDER BY rowid').all(id), [
    { usuario_id: 'u2', total_item_anterior: 783, total_item_novo: 782, total_venda_anterior: 11225, total_venda_novo: 11224 },
    { usuario_id: 'u2', total_item_anterior: 10242, total_item_novo: 10241, total_venda_anterior: 11224, total_venda_novo: 11223 },
  ]);
  assert.equal((await confirmar(11223, 11223)).status, 409);
  assert.equal(db.prepare('SELECT COUNT(*) AS total FROM venda_ajustes_preco WHERE venda_id=?').get(id).total, 2);
});

test('recalcular arredondamento preserva itens de outra origem e exige total anterior consistente', async () => {
  const venda = { loja: '01', caixa: '001', cliente: { nome: 'Cliente', cpf: '' },
    subtotal: 782, desconto: 0, total: 782, formaPagamento: '001',
    itens: [{ produto: { codigo: 'KG3', descricao: 'MELAO', unidade: 'KG' }, quantidade: 0.99, valorUnitario: 790, valorTotal: 782, desconto: 0 }] };
  const criada = await json('/api/vendas', 'token1', venda);
  assert.equal(criada.status, 200, JSON.stringify(criada.corpo));
  const id = criada.corpo.id;
  const rota = `/api/vendas/${id}/recalcular-arredondamento`;
  const corpo = { confirmado: true, totalAtualEsperado: 783, totalEsperado: 782 };
  assert.equal((await json(rota, 'token1', corpo)).status, 409);
  db.prepare("UPDATE vendas SET status_protheus='REJEITADO',total=783 WHERE id=?").run(id);
  assert.equal((await json(rota, 'token1', corpo)).status, 409);
  db.prepare('UPDATE venda_itens SET valor_total=784 WHERE venda_id=?').run(id);
  db.prepare('UPDATE vendas SET total=784 WHERE id=?').run(id);
  assert.equal((await json(rota, 'token1', { ...corpo, totalAtualEsperado: 784 })).status, 409);
  assert.equal(db.prepare('SELECT valor_total FROM venda_itens WHERE venda_id=?').get(id).valor_total, 784);
});

test('localizar vendedor usa o cadastro sincronizado e não autentica o operador no REST', async () => {
  globalThis.fetch=async()=>{throw new Error('A localização não deve acessar REST');};
  try {
    const r=await json('/api/protheus/vendedor-do-usuario','token1',{protheusCodigo:'login2'});
    assert.equal(r.status,200); assert.equal(r.corpo.vendedor.codigo,'000002');
    const legado=await json('/api/minha-conta/protheus','token2',{protheusSenha:'nao-armazenar'});
    assert.equal(legado.status,410);
    assert.equal(db.prepare("SELECT protheus_usr_senha_cifrada FROM usuarios WHERE id='u2'").get().protheus_usr_senha_cifrada,null);
    assert.equal((await json('/api/protheus/integracao','token2')).status,403);
  } finally {globalThis.fetch=fetchHttp;}
});
