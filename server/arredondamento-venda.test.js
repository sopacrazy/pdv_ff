import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularAjusteArredondamento } from './arredondamento-venda.js';

const itens = [
  { quantidade: 0.71, valor_unitario: 1350, valor_total: 959, desconto: 0 },
  { quantidade: 2.42, valor_unitario: 590, valor_total: 1428, desconto: 0 },
];

test('corrige centavos legados pela soma das linhas arredondadas', () => {
  assert.deepEqual(calcularAjusteArredondamento({ tipo_operacao: 'PDV', total: 2386.3, desconto: 0 }, itens),
    { total: 2387, subtotal: 2387 });
});

test('não altera bilhete, payload já preparado ou diferença sem origem no arredondamento', () => {
  for (const venda of [
    { tipo_operacao: 'BILHETE', total: 2386.3 },
    { tipo_operacao: 'PDV', total: 2386.3, payload_protheus: '{}' },
    { tipo_operacao: 'PDV', total: 2300 },
  ]) assert.equal(calcularAjusteArredondamento(venda, itens), null);
});
