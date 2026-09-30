import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolverArquivoEnv } from './configuracao-env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const caminhoEnv = resolverArquivoEnv({
  diretorioProjeto: path.resolve(__dirname, '..'),
  diretorioConfiguracao: process.env.PDV_CONFIG_DIR,
  diretorioResources: process.resourcesPath,
  arquivoExplicito: process.env.PDV_ENV_FILE,
});
dotenv.config({ path: caminhoEnv });
