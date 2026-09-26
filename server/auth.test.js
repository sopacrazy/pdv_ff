import test from 'node:test';
import assert from 'node:assert/strict';
import { paraUsuarioFrontend } from './auth.js';

const usuarioBase = {
  id: 'u1',
  nome: 'Operador',
  login: 'operador',
  papel: 'OPERADOR',
  ativo: 1,
  criado_em: '2026-09-26T00:00:00.000Z',
  protheus_usr_codigo: 'operador.protheus',
  protheus_usr_nome: 'Operador Protheus',
  protheus_vend_filial: '01',
  protheus_vend_codigo: '000001',
  protheus_vend_nome: 'VENDEDOR',
};

test('libera venda somente quando vínculo e senha Protheus estão completos', () => {
  assert.equal(
    paraUsuarioFrontend({ ...usuarioBase, protheus_usr_senha_cifrada: 'cifrada' }).prontoParaVender,
    true
  );
  assert.equal(
    paraUsuarioFrontend({ ...usuarioBase, protheus_usr_senha_cifrada: null }).prontoParaVender,
    false
  );
  assert.equal(
    paraUsuarioFrontend({ ...usuarioBase, protheus_usr_senha_cifrada: 'cifrada', protheus_vend_codigo: null })
      .prontoParaVender,
    false
  );
});
