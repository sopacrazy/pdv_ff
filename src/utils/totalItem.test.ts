import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularTotalItem } from './totalItem';

test('KG no preço mínimo arredonda para cima sem cobrar menos que a tabela', () => {
  const kg = { unidade: 'KG' } as Parameters<typeof calcularTotalItem>[0];
  assert.equal(calcularTotalItem(kg, 0.99, 790), 783);
  assert.equal(calcularTotalItem(kg, 1.42, 470), 668);
  assert.equal(calcularTotalItem(kg, 1.21, 1390), 1682);
  const unidade = { unidade: 'BJ' } as Parameters<typeof calcularTotalItem>[0];
  assert.equal(calcularTotalItem(unidade, 1.42, 470), 667);
});
