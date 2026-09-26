import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { resolverDiretorioBanco } from './db.js';

test('localhost e Electron usam a mesma pasta persistente no Windows', () => {
  const resolvido = resolverDiretorioBanco({
    diretorioConfigurado: '',
    plataforma: 'win32',
    appData: 'C:\\Users\\Caixa\\AppData\\Roaming',
    diretorioServidor: 'C:\\Projeto\\server',
  });
  assert.equal(resolvido, path.join('C:\\Users\\Caixa\\AppData\\Roaming', 'react-example', 'data'));
});

test('PDV_DB_DIR explícito continua tendo prioridade em ambientes controlados', () => {
  assert.equal(
    resolverDiretorioBanco({ diretorioConfigurado: 'C:\\Banco-Controlado', plataforma: 'win32' }),
    path.resolve('C:\\Banco-Controlado')
  );
});
