import test from 'node:test';
import assert from 'node:assert/strict';
import { precoSegundaUnidade } from './precoSegundaUnidade';

test('mostra seis casas como no bilhete sem alterar o total da linha', () => {
  assert.equal(precoSegundaUnidade(1682, 1.21), '13,900826');
  assert.equal(precoSegundaUnidade(3218, 8.25), '3,900606');
  assert.equal(precoSegundaUnidade(2062, 1.22), '16,901639');
  assert.equal(precoSegundaUnidade(1682, 0), null);
});
