import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolverArquivoEnv, preservarConfiguracaoEnv } from './configuracao-env.js';

function comArquivos(fn) {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'pdv-config-'));
  try {
    const projeto = path.join(raiz, 'projeto');
    const resources = path.join(raiz, 'resources');
    const configuracao = path.join(raiz, 'userData', 'config');
    fs.mkdirSync(projeto); fs.mkdirSync(resources);
    fn({ projeto, resources, configuracao });
  } finally { fs.rmSync(raiz, { recursive: true, force: true }); }
}

test('atualização preserva configuração externa e não a substitui pelo cadastro antigo', () => comArquivos(({ projeto, resources, configuracao }) => {
  const legado = path.join(resources, '.env');
  fs.writeFileSync(legado, 'PROTHEUS_REST_USER=caixa-atual');
  const salvo = preservarConfiguracaoEnv(legado, configuracao);
  fs.writeFileSync(legado, 'PROTHEUS_REST_USER=outra-maquina');
  assert.equal(preservarConfiguracaoEnv(legado, configuracao), salvo);
  assert.equal(fs.readFileSync(salvo, 'utf8'), 'PROTHEUS_REST_USER=caixa-atual');
  fs.writeFileSync(path.join(projeto, '.env'), 'PROTHEUS_REST_USER=desenvolvimento');
  assert.equal(resolverArquivoEnv({ diretorioProjeto: projeto, diretorioResources: resources, diretorioConfiguracao: configuracao }), salvo);
  fs.unlinkSync(legado);
  assert.equal(resolverArquivoEnv({ diretorioConfiguracao: configuracao }), salvo);
}));

test('dev e versão legada continuam carregando sua configuração sem gravar outro arquivo', () => comArquivos(({ projeto, resources }) => {
  const dev = path.join(projeto, '.env');
  fs.writeFileSync(dev, 'TESTE=dev');
  assert.equal(resolverArquivoEnv({ diretorioProjeto: projeto }), dev);
  const antigo = path.join(resources, '.env'); fs.writeFileSync(antigo, 'TESTE=legado');
  assert.equal(resolverArquivoEnv({ diretorioProjeto: projeto, diretorioResources: resources }), antigo);
}));

test('configuração explícita tem prioridade e caminho ausente não usa outro ambiente silenciosamente', () => comArquivos(({ projeto, configuracao }) => {
  fs.writeFileSync(path.join(projeto, '.env'), 'TESTE=dev');
  const explicito = path.join(projeto, 'servidor.env'); fs.writeFileSync(explicito, 'TESTE=externo');
  assert.equal(resolverArquivoEnv({ diretorioProjeto: projeto, arquivoExplicito: explicito }), explicito);
  assert.throws(() => resolverArquivoEnv({ diretorioProjeto: projeto, arquivoExplicito: path.join(projeto, 'ausente') }), /não encontrado/);
  assert.throws(() => resolverArquivoEnv({ diretorioConfiguracao: configuracao }), /Configure o Protheus/);
}));
