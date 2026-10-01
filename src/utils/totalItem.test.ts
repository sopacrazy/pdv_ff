import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularTotalItem, calcularTetoLegadoKg, reaisParaCentavos } from './totalItem';

test('KG segue o arredondamento do total usado no Protheus', () => {
  const kg = { unidade: 'KG' } as Parameters<typeof calcularTotalItem>[0];
  assert.equal(calcularTotalItem(kg, 0.99, 790), 782);
  assert.equal(calcularTotalItem(kg, 1.42, 470), 667);
  assert.equal(calcularTotalItem(kg, 1.21, 1390), 1682);
  assert.equal(calcularTotalItem(kg, 6.06, 1690), 10241);
  const unidade = { unidade: 'BJ' } as Parameters<typeof calcularTotalItem>[0];
  assert.equal(calcularTotalItem(unidade, 1.42, 470), 667);
});

test('arredonda o empate decimal para cima antes de descontar', () => {
  const kg = { unidade: 'KG' } as Parameters<typeof calcularTotalItem>[0];
  assert.equal(calcularTotalItem(kg, 1.005, 100), 101);
  assert.equal(calcularTotalItem(kg, 6.06, 1690, 1), 10240);
});

test('converte preço da tabela em centavos sem multiplicação binária', () => {
  assert.equal(reaisParaCentavos(16.9), 1690);
  assert.equal(reaisParaCentavos(1.005), 101);
});

test('reconhece o teto antigo sem aplicá-lo em venda nova', () => {
  assert.equal(calcularTetoLegadoKg(0.99, 790), 783);
  assert.equal(calcularTetoLegadoKg(6.06, 1690), 10242);
  assert.equal(calcularTotalItem({ unidade: 'KG' } as Parameters<typeof calcularTotalItem>[0], 6.06, 1690), 10241);
});
