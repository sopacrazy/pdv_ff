import fs from 'node:fs';
import path from 'node:path';

// A configuração de cada caixa fica fora do diretório substituído pelo instalador.
export function resolverArquivoEnv({ diretorioProjeto, diretorioConfiguracao, diretorioResources, arquivoExplicito } = {}) {
  if (arquivoExplicito) {
    const arquivo = path.resolve(arquivoExplicito);
    if (!fs.existsSync(arquivo)) throw new Error(`Arquivo de configuração não encontrado: ${arquivo}`);
    return arquivo;
  }
  const candidatos = [
    diretorioConfiguracao && path.join(diretorioConfiguracao, '.env'),
    diretorioResources && path.join(diretorioResources, '.env'),
    diretorioProjeto && path.join(diretorioProjeto, '.env'),
  ].filter(Boolean);
  const arquivo = candidatos.find(candidato => fs.existsSync(candidato));
  if (!arquivo) throw new Error(`Configure o Protheus no arquivo ${candidatos[0] || '.env'} antes de abrir o PDV.`);
  return arquivo;
}

export function preservarConfiguracaoEnv(arquivoLegado, diretorioConfiguracao) {
  const destino = path.join(diretorioConfiguracao, '.env');
  if (fs.existsSync(destino)) return destino;
  if (!fs.existsSync(arquivoLegado)) throw new Error('Configuração anterior do PDV não encontrada.');
  fs.mkdirSync(diretorioConfiguracao, { recursive: true });
  try { fs.copyFileSync(arquivoLegado, destino, fs.constants.COPYFILE_EXCL); }
  catch (erro) { if (erro.code !== 'EEXIST') throw erro; }
  return destino;
}
