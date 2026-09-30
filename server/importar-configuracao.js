import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

export function validarConfiguracaoLocal(conteudo) {
  const campos = dotenv.parse(conteudo);
  const obrigatorios = ['MSSQL_SERVER', 'MSSQL_DATABASE', 'MSSQL_USER', 'MSSQL_PASSWORD',
    'PROTHEUS_REST_URL', 'PROTHEUS_REST_USER', 'PROTHEUS_REST_PASSWORD'];
  const ausentes = obrigatorios.filter(campo => !String(campos[campo] || '').trim());
  if (ausentes.length) throw new Error(`Preencha os campos: ${ausentes.join(', ')}.`);
  let url;
  try { url = new URL(campos.PROTHEUS_REST_URL); } catch { throw new Error('PROTHEUS_REST_URL deve ser uma URL válida.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('PROTHEUS_REST_URL deve ser HTTP/HTTPS sem credenciais ou parâmetros na URL.');
  }
  if (campos.MSSQL_PORT && (!/^\d+$/.test(campos.MSSQL_PORT) || Number(campos.MSSQL_PORT) < 1 || Number(campos.MSSQL_PORT) > 65535)) {
    throw new Error('MSSQL_PORT deve estar entre 1 e 65535.');
  }
  return campos;
}

export function importarConfiguracaoLocal(origem, destino) {
  const conteudo = fs.readFileSync(origem);
  validarConfiguracaoLocal(conteudo);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  const temporario = `${destino}.novo-${process.pid}`;
  let backup = null;
  try {
    fs.writeFileSync(temporario, conteudo, { flag: 'wx', mode: 0o600 });
    if (fs.existsSync(destino)) {
      backup = `${destino}.backup-${Date.now()}`;
      fs.copyFileSync(destino, backup, fs.constants.COPYFILE_EXCL);
    }
    fs.renameSync(temporario, destino);
    return { arquivo: destino, backup };
  } finally { if (fs.existsSync(temporario)) fs.unlinkSync(temporario); }
}
