import test from 'node:test';
import assert from 'node:assert/strict';
import { totalMinimoKg } from './preco-minimo-kg.js';

test('preço mínimo KG exige um centavo adicional quando arredondamento cai abaixo da tabela', () => {
  assert.equal(totalMinimoKg(0.99, 790), 783);
  assert.equal(totalMinimoKg(1.42, 470), 668);
  assert.equal(totalMinimoKg(1.21, 1390), 1682);
  assert.equal(totalMinimoKg(0.99, 790, 8), 792);
});
