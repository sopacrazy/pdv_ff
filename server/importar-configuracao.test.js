import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { validarConfiguracaoLocal, importarConfiguracaoLocal } from './importar-configuracao.js';

const require = createRequire(import.meta.url);
const iniciar = require('../electron/configuracao-inicial.cjs');
const configValida = 'MSSQL_SERVER=sql.exemplo.local\nMSSQL_DATABASE=PROTHEUS11\nMSSQL_USER=usuario\nMSSQL_PASSWORD="senha#com-caracteres"\nPROTHEUS_REST_URL=https://erp.exemplo.local/rest\nPROTHEUS_REST_USER=conta\nPROTHEUS_REST_PASSWORD="segredo#teste"\nIMPRESSORA_NOME=Impressora do caixa\n';

async function comDiretorio(fn) {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'pdv-config-inicial-'));
  try { await fn(raiz); } finally { fs.rmSync(raiz, { recursive: true, force: true }); }
}

test('importa configuração completa, preservando valores especiais e o cadastro da impressora', () => comDiretorio(raiz => {
  const origem = path.join(raiz, 'origem.env'); fs.writeFileSync(origem, configValida);
  const destino = path.join(raiz, 'config/.env');
  const resultado = importarConfiguracaoLocal(origem, destino);
  assert.equal(resultado.backup, null);
  assert.equal(fs.readFileSync(destino, 'utf8'), configValida);
  assert.equal(validarConfiguracaoLocal(fs.readFileSync(destino)).PROTHEUS_REST_PASSWORD, 'segredo#teste');
}));

test('arquivo inválido não substitui a configuração existente nem divulga senhas no erro', () => comDiretorio(raiz => {
  const origem = path.join(raiz, 'invalido.env'); fs.writeFileSync(origem, 'MSSQL_PASSWORD=segredo-que-nao-pode-aparecer');
  const destino = path.join(raiz, '.env'); fs.writeFileSync(destino, configValida);
  assert.throws(() => importarConfiguracaoLocal(origem, destino), erro => {
    assert.match(erro.message, /PROTHEUS_REST_URL/);
    assert.doesNotMatch(erro.message, /segredo-que-nao-pode-aparecer/);
    return true;
  });
  assert.equal(fs.readFileSync(destino, 'utf8'), configValida);
  assert.deepEqual(fs.readdirSync(raiz).sort(), ['.env', 'invalido.env']);
}));

test('substituição autorizada guarda o arquivo anterior e recusa URL ou porta inválida', () => comDiretorio(raiz => {
  const origem = path.join(raiz, 'origem.env'); fs.writeFileSync(origem, configValida);
  const destino = path.join(raiz, '.env'); fs.writeFileSync(destino, 'CONFIGURACAO_ANTIGA=1');
  const resultado = importarConfiguracaoLocal(origem, destino);
  assert.equal(fs.readFileSync(resultado.backup, 'utf8'), 'CONFIGURACAO_ANTIGA=1');
  assert.throws(() => validarConfiguracaoLocal(configValida.replace('https://erp.exemplo.local/rest', 'https://usuario:senha@erp.exemplo.local/rest')), /HTTP\/HTTPS/);
  assert.throws(() => validarConfiguracaoLocal(configValida + 'MSSQL_PORT=65536\n'), /MSSQL_PORT/);
}));

test('instalação sem cadastro importa o arquivo pelo diálogo antes de liberar o servidor', () => comDiretorio(async raiz => {
  const origem = path.join(raiz, 'origem.env'); fs.writeFileSync(origem, configValida);
  const destino = path.join(raiz, 'config/.env');
  const chamadas = [];
  const configurado = await iniciar({ diretorioProjeto: path.resolve('.'), diretorioConfiguracao: path.dirname(destino), arquivoExplicito: destino,
    dialog: {
      async showMessageBox(opcoes) { chamadas.push(opcoes.message); return { response: 0 }; },
      async showOpenDialog() { return { canceled: false, filePaths: [origem] }; },
    } });
  assert.equal(configurado, true);
  assert.equal(chamadas.length, 1);
  assert.equal(fs.readFileSync(destino, 'utf8'), configValida);
}));

test('fechar a configuração impede iniciar o servidor e não cria arquivo vazio', () => comDiretorio(async raiz => {
  const destino = path.join(raiz, '.env');
  const configurado = await iniciar({ diretorioProjeto: path.resolve('.'), diretorioConfiguracao: raiz, arquivoExplicito: destino,
    dialog: { async showMessageBox() { return { response: 1 }; }, async showOpenDialog() { throw new Error('Não deve abrir.'); } } });
  assert.equal(configurado, false);
  assert.equal(fs.existsSync(destino), false);
}));

test('instalação com cadastro válido abre diretamente sem exibir configuração', () => comDiretorio(async raiz => {
  const destino = path.join(raiz, '.env'); fs.writeFileSync(destino, configValida);
  assert.equal(await iniciar({ diretorioProjeto: path.resolve('.'), diretorioConfiguracao: raiz, arquivoExplicito: destino,
    dialog: { async showMessageBox() { throw new Error('Não deve exibir.'); }, async showOpenDialog() { throw new Error('Não deve abrir.'); } } }), true);
}));
