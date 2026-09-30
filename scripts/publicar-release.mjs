import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { verificarRelease } from './verificar-release.mjs';

const { versao, arquivos } = verificarRelease();
const tag = `v${versao}`;
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
assert.equal(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(), '', 'Commit os fontes antes de publicar.');
let token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '';
if (!token) {
  try {
    const credencial = execFileSync('git', ['credential', 'fill'], {
      input: 'protocol=https\nhost=github.com\npath=sopacrazy/pdv_ff.git\n\n', encoding: 'utf8',
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never' }, stdio: ['pipe', 'pipe', 'pipe'],
    });
    token = credencial.split(/\r?\n/).find(linha => linha.startsWith('password='))?.slice(9) || '';
  } catch { throw new Error('Autenticação local do GitHub indisponível.'); }
}
assert.ok(token, 'Autenticação local do GitHub indisponível.');
const headers = { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'User-Agent': 'PDV-Fort-Fruit-Release' };
const base = 'https://api.github.com/repos/sopacrazy/pdv_ff';
async function api(url, opcoes = {}) {
  const resposta = await fetch(url, { ...opcoes, headers: { ...headers, ...opcoes.headers } });
  if (!resposta.ok) throw new Error(`GitHub HTTP ${resposta.status} na operação ${opcoes.method || 'GET'}.`);
  return resposta.json();
}
async function json(url, method, dados) {
  return api(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados) });
}
const repo = await api(base);
assert.equal(repo.private, false, 'O fluxo de atualização configurado exige o repositório público.');
const commitRemoto = await api(`${base}/commits/${sha}`);
assert.equal(commitRemoto.sha, sha, 'O commit da release ainda não está no GitHub.');
const lista = await api(`${base}/releases?per_page=100`);
const existentes = lista.filter(r => r.tag_name === tag);
assert.ok(existentes.length <= 1, 'Existe mais de uma release para esta tag; confira antes de continuar.');
let release = existentes[0];
if (!release) {
  release = await json(`${base}/releases`, 'POST', { tag_name: tag, target_commitish: sha,
    name: `PDV Fort Fruit ${versao}`, body: fs.readFileSync('RELEASE-NOTES.md', 'utf8'), draft: true, prerelease: false });
}
assert.ok(release.draft, 'Esta versão já está publicada; não substituir arquivos públicos.');
for (const arquivo of arquivos) {
  const nome = path.basename(arquivo).replaceAll(' ', '-');
  const conteudo = fs.readFileSync(arquivo);
  const digest = `sha256:${createHash('sha256').update(conteudo).digest('hex')}`;
  let asset = release.assets.find(a => a.name === nome);
  if (!asset) {
    const destino = `${release.upload_url.split('{')[0]}?name=${encodeURIComponent(nome)}`;
    asset = await api(destino, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: conteudo });
    console.log(`Enviado: ${nome}`);
  }
  assert.equal(asset.size, conteudo.length, `Tamanho divergente: ${nome}`);
  if (asset.digest) assert.equal(asset.digest, digest, `Hash divergente: ${nome}`);
  else {
    const resposta = await fetch(asset.url, { headers: { ...headers, Accept: 'application/octet-stream' } });
    assert.ok(resposta.ok);
    assert.equal(`sha256:${createHash('sha256').update(Buffer.from(await resposta.arrayBuffer())).digest('hex')}`, digest);
  }
}
release = await api(`${base}/releases/${release.id}`);
const nomes = arquivos.map(a => path.basename(a).replaceAll(' ', '-'));
assert.deepEqual(release.assets.map(a => a.name).sort(), nomes.sort(), 'A release precisa dos três arquivos completos.');
if (process.argv.includes('--publicar')) {
  release = await json(`${base}/releases/${release.id}`, 'PATCH', { draft: false, make_latest: 'true' });
  assert.equal(release.draft, false);
}
console.log(JSON.stringify({ tag, commit: sha, publicada: !release.draft, url: release.html_url,
  arquivos: release.assets.map(a => ({ nome: a.name, tamanho: a.size })) }, null, 2));
