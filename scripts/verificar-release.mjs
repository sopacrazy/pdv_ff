import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import yaml from 'js-yaml';
import AdmZip from 'adm-zip';

export function verificarRelease() {
  const fonte = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const versao = fonte.version;
  assert.match(versao, /^\d+\.\d+\.\d+$/);
  const diretorio = path.resolve('release', `v${versao}`);
  const resources = path.join(diretorio, 'win-unpacked/resources');
  const app = path.join(resources, 'app');
  const pacote = JSON.parse(fs.readFileSync(path.join(app, 'package.json'), 'utf8'));
  assert.equal(pacote.version, versao);
  assert.equal(fonte.build.publish.private, false);
  assert.deepEqual(fonte.build.extraResources, []);
  const proibidos = [];
  function examinar(diretorioAtual) {
    for (const item of fs.readdirSync(diretorioAtual, { withFileTypes: true })) {
      const arquivo = path.join(diretorioAtual, item.name);
      if (item.name === '.env' || item.name === 'gh-token.txt' || /\.(db|sqlite)(-wal|-shm)?$/i.test(item.name)) proibidos.push(arquivo);
      if (item.isDirectory()) examinar(arquivo);
    }
  }
  examinar(resources);
  assert.deepEqual(proibidos, [], 'O instalador não pode conter configuração, token ou SQLite.');
  assert.equal(fs.existsSync(path.join(app, 'server/data')), false);
  assert.equal(JSON.parse(fs.readFileSync(path.join(app, 'dist-bundle/version.json'), 'utf8')).version, versao);
  const zip = new AdmZip(path.join(app, 'dist-bundle/app-bundle.zip'));
  assert.equal(zip.readAsText('index.html'), fs.readFileSync(path.join(app, 'dist/index.html'), 'utf8'));
  const feed = yaml.load(fs.readFileSync(path.join(resources, 'app-update.yml'), 'utf8'));
  assert.equal(feed.private, false);
  assert.equal(feed.token, undefined);
  assert.equal(feed.owner, 'sopacrazy'); assert.equal(feed.repo, 'pdv_ff');
  const metadata = yaml.load(fs.readFileSync(path.join(diretorio, 'latest.yml'), 'utf8'));
  assert.equal(metadata.version, versao);
  const instalador = path.join(diretorio, `PDV Fort Fruit Setup ${versao}.exe`);
  const digest = createHash('sha512').update(fs.readFileSync(instalador)).digest('base64');
  const nomePublico = path.basename(instalador).replaceAll(' ', '-');
  assert.equal(metadata.path, nomePublico);
  assert.equal(metadata.sha512, digest);
  assert.equal(metadata.files[0].url, nomePublico);
  assert.equal(metadata.files[0].sha512, digest);
  assert.equal(metadata.files[0].size, fs.statSync(instalador).size);
  const arquivos = [instalador, `${instalador}.blockmap`, path.join(diretorio, 'latest.yml')];
  for (const arquivo of arquivos) assert.ok(fs.statSync(arquivo).size > 0);
  return { versao, diretorio, arquivos, sha512: digest };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve('scripts/verificar-release.mjs')) {
  const resultado = verificarRelease();
  console.log(JSON.stringify({ versao: resultado.versao, arquivos: resultado.arquivos.map(a => path.basename(a)),
    configuracaoEmbutida: false }, null, 2));
}
