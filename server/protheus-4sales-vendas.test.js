import test from 'node:test';
import assert from 'node:assert/strict';
import { montarVenda4Sales, enviarVenda4Sales } from './protheus-4sales-vendas.js';
const venda = { id: 'pdv-test-123', forma_pagamento: '033', total: 33000, desconto: 0, criado_em: '2026-09-22T12:00:00Z', data_local: '2026-09-22' };
const itens = [{ codigo_produto: '199.029', descricao: 'MACA', quantidade: 2, valor_unitario: 16500, valor_total: 33000, desconto: 0 }];
const vendedor = { protheus_vend_codigo: '000090' };
const cliente = { code: 'YDOVT3', store: '01', pricelist: '015' };
const precos = [{ itemCode: '199.029 ', activeItemPrice: '1', minimumSalesPrice: 165 }];
const montar = (v = venda, p = precos) => montarVenda4Sales(v, itens, vendedor, cliente, p);
test('mapeia centavos e contexto autorizado sem reutilizar o bilhete 645', () => {
 const p = montar(); assert.equal(p.body.value, 330); assert.equal(p.body.items[0].price,165);
 assert.equal(p.body._id,venda.id); assert.equal(p.body.client.externalCode,'YDOVT3');
 assert.equal(p.body.priceTable.id,'015'); assert.equal(p.body.paymentType.id,'033'); assert.equal(p.headers.TenantId,'14,01');
});
test('usa a condição de pagamento do cadastro do cliente como paymentType, sem exigir PIX', () => {
 const p = montar({...venda, forma_pagamento: '001'});
 assert.equal(p.body.paymentType.id, '001'); assert.equal(p.body.paymentType.name, '001');
});
test('usa a data de operação (data_local) no bilhete, não o dia real de criado_em, mantendo a hora real', () => {
 const p = montar({...venda, data_local: '2026-09-25'});
 assert.equal(p.body.date, '2026-09-25T12:00:00.000Z');
});
test('bloqueia venda sem condição de pagamento, descontos e preços não homologados antes do POST', () => {
 assert.throws(() => montar({...venda, forma_pagamento: ''}), /condição de pagamento/);
 assert.throws(() => montar({...venda, desconto:100}), /Descontos/);
 assert.throws(() => montar(venda, []), /cadastro ativo/);
 assert.throws(() => montar(venda,[{...precos[0],minimumSalesPrice:160}]), /165.00.*160.00/);
 assert.throws(() => montar({...venda,total:1}), /Total/);
});
test('somente retorno EFE da mesma venda e empresa confirma inclusão; não repete falhas', async () => {
 const original = globalThis.fetch; const user=process.env.PROTHEUS_REST_USER, pass=process.env.PROTHEUS_REST_PASSWORD;
 process.env.PROTHEUS_REST_USER='test'; process.env.PROTHEUS_REST_PASSWORD='test';
 let calls=0;
 try {
  globalThis.fetch=async()=>{calls++;return new Response(JSON.stringify({idWeb:venda.id,company:'14',branch:'01',ticket:'TEST01',status:'EFE'}),{status:200});};
  assert.equal((await enviarVenda4Sales(montar())).sucesso,true);
  globalThis.fetch=async()=>{calls++;return new Response(JSON.stringify({idWeb:'645',company:'14',branch:'01',ticket:'TEST01',status:'EFE'}),{status:200});};
  assert.equal((await enviarVenda4Sales(montar())).sucesso,false);
  globalThis.fetch=async()=>{calls++;throw new Error('timeout');};
  const r=await enviarVenda4Sales(montar()); assert.equal(r.resultadoDesconhecido,true);assert.equal(r.sucesso,false);assert.equal(calls,3);
 } finally {globalThis.fetch=original;if(user===undefined)delete process.env.PROTHEUS_REST_USER;else process.env.PROTHEUS_REST_USER=user;if(pass===undefined)delete process.env.PROTHEUS_REST_PASSWORD;else process.env.PROTHEUS_REST_PASSWORD=pass;}
});
