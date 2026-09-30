const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

// Executado antes do import do servidor: não inicia sincronização nem fila de vendas.
module.exports = async function configurarPrimeiraInstalacao({ dialog, diretorioProjeto, diretorioResources, diretorioConfiguracao, arquivoExplicito }) {
  const { resolverArquivoEnv } = await import(pathToFileURL(path.join(diretorioProjeto, 'server/configuracao-env.js')).href);
  const { validarConfiguracaoLocal, importarConfiguracaoLocal } = await import(pathToFileURL(path.join(diretorioProjeto, 'server/importar-configuracao.js')).href);
  let motivo = '';
  try {
    const arquivo = resolverArquivoEnv({ diretorioProjeto, diretorioResources, diretorioConfiguracao, arquivoExplicito });
    validarConfiguracaoLocal(fs.readFileSync(arquivo));
    return true;
  } catch (erro) { motivo = erro.message; }
  const destino = arquivoExplicito ? path.resolve(arquivoExplicito) : path.join(diretorioConfiguracao, '.env');
  for (;;) {
    const resposta = await dialog.showMessageBox({
      type: 'info', title: 'Configurar PDV Fort Fruit',
      message: 'Configure esta máquina para iniciar o PDV.',
      detail: `Importe o arquivo .env já configurado na máquina principal. Ele será salvo em:\n${destino}\n\n${motivo}`,
      buttons: ['Importar configuração', 'Fechar'], defaultId: 0, cancelId: 1,
    });
    if (resposta.response !== 0) return false;
    const escolha = await dialog.showOpenDialog({ title: 'Selecione o .env configurado do PDV',
      properties: ['openFile'], filters: [{ name: 'Todos os arquivos', extensions: ['*'] }] });
    if (escolha.canceled || !escolha.filePaths?.length) continue;
    try {
      importarConfiguracaoLocal(escolha.filePaths[0], destino);
      return true;
    } catch (erro) { motivo = erro.message; }
  }
};
