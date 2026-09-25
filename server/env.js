import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Em dev/servidor solto, o .env fica na raiz do projeto (ao lado de server/). No app empacotado
// (Electron) esse caminho não existe — o .env real (credenciais MSSQL/Protheus) é copiado pelo
// electron-builder pra dentro de resources/ (ver extraResources no package.json), então também
// tentamos process.resourcesPath. Sem isso, o app sobe sem credencial nenhuma e a sincronização
// de produtos/cliente/Protheus falha silenciosamente (banco local fica vazio).
const candidatos = [
  path.resolve(__dirname, '..', '.env'),
  process.resourcesPath ? path.join(process.resourcesPath, '.env') : null,
].filter(Boolean);

const caminhoEnv = candidatos.find((candidato) => fs.existsSync(candidato));
dotenv.config({ path: caminhoEnv || candidatos[0] });
