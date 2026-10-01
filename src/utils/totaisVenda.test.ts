import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularTotaisVenda } from './totaisVenda';

test('soma totais arredondados dos itens KG como no cupom e no Protheus', () => {
  const totais = calcularTotaisVenda([
    { valorTotal: 1600, desconto: 0 },
    { valorTotal: 1580, desconto: 0 },
    { valorTotal: 520, desconto: 0 },
    { valorTotal: Math.round(0.71 * 1350), desconto: 0 },
    { valorTotal: Math.round(2.42 * 590), desconto: 0 },
  ]);
  assert.deepEqual(totais, { subtotal: 6087, desconto: 0, total: 6087 });
});
