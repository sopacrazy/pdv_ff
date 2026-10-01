import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularTotalCentavos, calcularTotalLegadoKgCentavos, precoPorQuantidadeSeisCasas, reaisParaCentavos } from './decimal-money.js';

test('arredonda o total em centavos com half up decimal, inclusive empate', () => {
  assert.equal(calcularTotalCentavos(6.06, 1690), 10241);
  assert.equal(calcularTotalCentavos(0.99, 790), 782);
  assert.equal(calcularTotalCentavos(0.71, 1350), 959);
  assert.equal(calcularTotalCentavos(2.42, 590), 1428);
  assert.equal(calcularTotalCentavos(1.005, 100), 101);
  assert.equal(calcularTotalCentavos(0.0005, 1000), 1);
  assert.equal(reaisParaCentavos(1.005), 101);
});

test('preço derivado usa total arredondado e seis casas', () => {
  assert.equal(precoPorQuantidadeSeisCasas(10241, 6.06), '16.899340');
  assert.equal(precoPorQuantidadeSeisCasas(1682, 1.21), '13.900826');
  assert.equal(precoPorQuantidadeSeisCasas(3218, 8.25), '3.900606');
  assert.equal(precoPorQuantidadeSeisCasas(10241, 0), null);
  assert.equal(precoPorQuantidadeSeisCasas(10241, null), null);
});

test('teto de centavo existe apenas para compatibilidade com vendas KG legadas', () => {
  assert.equal(calcularTotalLegadoKgCentavos(0.99, 790), 783);
  assert.equal(calcularTotalCentavos(0.99, 790), 782);
  assert.equal(calcularTotalCentavos(0, 790), null);
  assert.equal(calcularTotalCentavos(1, Number.MAX_SAFE_INTEGER), Number.MAX_SAFE_INTEGER);
  assert.equal(calcularTotalCentavos(2, Number.MAX_SAFE_INTEGER), null);
});
