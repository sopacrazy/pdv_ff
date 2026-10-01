// Processo principal do Electron. Fica em CommonJS (.cjs) de propósito — electron e electron-updater
// são mais tranquilos em CJS, e o resto do projeto usa "type": "module" (ESM) no package.json, então
// aqui dentro usamos import() dinâmico pra carregar o servidor (server/server.js, que é ESM).
const path = require('node:path');
const fs = require('node:fs');
const { app, BrowserWindow, Menu, dialog, nativeTheme, shell, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');

const PORTA = 3001;
let janelaPrincipal = null;
let janelaSplash = null;
let janelaProgresso = null;

// Impede abrir uma segunda instância desta MESMA instalação (ex: clicar duas vezes no atalho sem
// perceber que já está aberto) — cada instância tentaria subir seu próprio servidor na porta 3001
// e a segunda falharia com EADDRINUSE. Quando isso acontece, a segunda cópia simplesmente fecha e
// avisa a primeira pra vir pra frente.
const ehInstanciaUnica = app.requestSingleInstanceLock();
if (!ehInstanciaUnica) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (janelaPrincipal) {
      if (janelaPrincipal.isMinimized()) janelaPrincipal.restore();
      janelaPrincipal.focus();
    }
  });
}

// O código do app empacotado roda dentro do instalador (pasta somente-leitura em Program Files).
// O banco SQLite precisa ficar num lugar gravável — a pasta de dados do usuário do Windows
// (%APPDATA%/pdv-fort-fruit ou similar). server/db.js lê PDV_DB_DIR na hora que é importado, então
// isso tem que ser setado ANTES do import() do servidor lá embaixo.
process.env.PDV_DB_DIR = path.join(app.getPath('userData'), 'data');
process.env.PDV_CONFIG_DIR = path.join(app.getPath('userData'), 'config');
process.env.API_PORT = String(PORTA);

// O app empacotado não tem terminal — sem isso, todo console.log/warn/error do servidor embutido
// (sync com Protheus, fila de envio, etc.) simplesmente desaparece, e não tem como diagnosticar
// nada remotamente. Gravamos tudo num arquivo simples em texto, acessível pelo menu Ajuda > Ver logs.
const LOG_DIR = path.join(app.getPath('userData'), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'app.log');

function configurarLogParaArquivo() {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  // Rotação bem simples: se o log antigo já estiver grande, guarda como .old (sobrescrevendo o
  // anterior) e começa um arquivo novo — evita crescer pra sempre num caixa que fica ligado dias.
  try {
    if (fs.statSync(LOG_FILE).size > 5 * 1024 * 1024) {
      fs.renameSync(LOG_FILE, `${LOG_FILE}.old`);
    }
  } catch {
    // arquivo ainda não existe — primeira execução, segue normal
  }

  const stream = fs.createWriteStream(LOG_FILE, { flags: 'a' });
  const niveis = ['log', 'info', 'warn', 'error'];
  for (const nivel of niveis) {
    const original = console[nivel].bind(console);
    console[nivel] = (...args) => {
      original(...args);
      const texto = args
        .map((a) => (typeof a === 'string' ? a : a instanceof Error ? (a.stack || a.message) : JSON.stringify(a)))
        .join(' ');
      stream.write(`[${new Date().toISOString()}] [${nivel.toUpperCase()}] ${texto}\n`);
    };
  }
}

configurarLogParaArquivo();

let autoUpdateDisponivel = false;
let checagemManualEmAndamento = false;

function configurarAutoUpdate() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  // O repositório é público: downloads não precisam de credenciais no instalador.
  autoUpdateDisponivel = true;

  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'sopacrazy',
    repo: 'pdv_ff',
    private: false,
  });

  // As mensagens abaixo só viram diálogo quando a checagem foi disparada pelo menu "Verificar
  // atualizações agora" — a checagem automática de fundo (abertura + a cada 4h) fica só no log,
  // pra não interromper o operador de caixa com popup sem ele ter pedido nada.
  autoUpdater.on('error', (erro) => {
    console.error('[electron] Erro no auto-update:', erro);
    if (checagemManualEmAndamento) {
      fecharJanelaProgresso();
      dialog.showMessageBox(janelaPrincipal, {
        type: 'error',
        title: 'Verificar atualizações',
        message: 'Não foi possível verificar atualizações.',
        detail: String(erro?.message || erro),
      });
    }
    checagemManualEmAndamento = false;
  });
  autoUpdater.on('update-available', (info) => {
    console.log(`[electron] Atualização disponível: v${info.version}. Baixando...`);
    // Não fecha a janela de progresso ainda — ela segue mostrando "Baixando..." até o download
    // terminar (update-downloaded), que é quando o diálogo de "reiniciar agora?" aparece.
    if (checagemManualEmAndamento) {
      atualizarJanelaProgresso(`Baixando atualização v${info.version}…`);
    }
  });
  autoUpdater.on('update-not-available', () => {
    console.log('[electron] App já está na versão mais recente.');
    if (checagemManualEmAndamento) {
      fecharJanelaProgresso();
      dialog.showMessageBox(janelaPrincipal, {
        type: 'info',
        title: 'Verificar atualizações',
        message: 'Você já está usando a versão mais recente.',
      });
    }
    checagemManualEmAndamento = false;
  });
  autoUpdater.on('update-downloaded', async (info) => {
    console.log(`[electron] Atualização v${info.version} baixada.`);
    fecharJanelaProgresso();
    checagemManualEmAndamento = false;
    const resposta = await dialog.showMessageBox(janelaPrincipal, {
      type: 'info',
      title: 'Atualização disponível',
      message: `Uma nova versão (${info.version}) foi baixada.`,
      detail: 'Reinicie agora para aplicar, ou deixe para a próxima vez que o sistema for fechado.',
      buttons: ['Reiniciar agora', 'Depois'],
      defaultId: 0,
      cancelId: 1,
    });
    if (resposta.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });

  // Primeira checagem logo após abrir, e depois a cada 4h — o caixa costuma ficar ligado o dia
  // inteiro, então não dá pra confiar só na checagem de abertura do app pra pegar atualizações.
  autoUpdater.checkForUpdates().catch((erro) => console.error('[electron] Falha ao checar update:', erro));
  setInterval(() => {
    autoUpdater.checkForUpdates().catch((erro) => console.error('[electron] Falha ao checar update:', erro));
  }, 4 * 60 * 60 * 1000);
}

function verificarAtualizacoesManualmente() {
  if (!autoUpdateDisponivel) {
    dialog.showMessageBox(janelaPrincipal, {
      type: 'warning',
      title: 'Verificar atualizações',
      message: 'O serviço de atualização ainda não está disponível. Aguarde a inicialização do PDV.',
    });
    return;
  }
  checagemManualEmAndamento = true;
  abrirJanelaProgresso('Verificando atualizações…');
  autoUpdater.checkForUpdates().catch((erro) => {
    checagemManualEmAndamento = false;
    fecharJanelaProgresso();
    console.error('[electron] Falha ao checar update (manual):', erro);
  });
}

function montarMenu() {
  // Só o essencial: nada de File/Edit/View/Window/Reload/DevTools pro operador de caixa mexer.
  const template = [
    {
      label: 'Ajuda',
      submenu: [
        { label: 'Verificar atualizações agora', click: () => verificarAtualizacoesManualmente() },
        { type: 'separator' },
        {
          label: 'Ver logs',
          click: async () => {
            const erro = await shell.openPath(LOG_FILE);
            if (erro) {
              dialog.showMessageBox(janelaPrincipal, {
                type: 'error',
                title: 'Ver logs',
                message: 'Não foi possível abrir o arquivo de log.',
                detail: erro,
              });
            }
          },
        },
        { type: 'separator' },
        {
          label: 'Sobre o PDV Fort Fruit',
          click: () => {
            dialog.showMessageBox(janelaPrincipal, {
              type: 'info',
              title: 'Sobre',
              message: 'PDV Fort Fruit',
              detail: `Versão ${app.getVersion()}`,
            });
          },
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// Abrir o app envolve subir apenas o servidor local (Express + SQLite). As sincronizações remotas
// começam depois, em segundo plano, então a splash não fica presa aguardando VPN/SQL Server.
function abrirSplash() {
  janelaSplash = new BrowserWindow({
    width: 340,
    height: 220,
    frame: false,
    resizable: false,
    movable: false,
    center: true,
    show: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    icon: path.join(__dirname, '..', 'build-resources', 'icon.ico'),
    webPreferences: { contextIsolation: true },
  });
  janelaSplash.loadFile(path.join(__dirname, 'splash.html'));
  janelaSplash.on('closed', () => {
    janelaSplash = null;
  });
}

function fecharSplash() {
  if (janelaSplash && !janelaSplash.isDestroyed()) janelaSplash.close();
  janelaSplash = null;
}

// Janelinha de progresso reaproveitada pra "Verificar atualizações agora" — o checkForUpdates()
// contra a API do GitHub pode levar alguns segundos, e sem isso o clique parecia não fazer nada.
function abrirJanelaProgresso(mensagem) {
  janelaProgresso = new BrowserWindow({
    width: 320,
    height: 140,
    parent: janelaPrincipal,
    modal: true,
    frame: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    show: true,
    webPreferences: { contextIsolation: true },
  });
  janelaProgresso.loadFile(path.join(__dirname, 'progresso.html'), { query: { mensagem } });
  janelaProgresso.on('closed', () => {
    janelaProgresso = null;
  });
}

function atualizarJanelaProgresso(mensagem) {
  if (janelaProgresso && !janelaProgresso.isDestroyed()) {
    janelaProgresso.loadFile(path.join(__dirname, 'progresso.html'), { query: { mensagem } });
  }
}

function fecharJanelaProgresso() {
  if (janelaProgresso && !janelaProgresso.isDestroyed()) janelaProgresso.close();
  janelaProgresso = null;
}

// Impressão automática do bilhete (ver src/hooks/useImpressaoBilheteProtheus.ts): sem o `silent`,
// webContents.print() abre o mesmo diálogo do window.print() do navegador. Sem `deviceName`, o
// Electron manda pra impressora marcada como padrão no Windows — não precisamos descobrir qual é.
// A página já está com a área de impressão certa visível (mesmo @media print usado por
// window.print()), então isso imprime exatamente o que a tela já monta.
ipcMain.handle('pdv:imprimir-silencioso', (evento) => {
  const janela = BrowserWindow.fromWebContents(evento.sender);
  if (!janela) return Promise.resolve({ sucesso: false, erro: 'Janela não encontrada.' });
  return new Promise((resolve) => {
    janela.webContents.print({ silent: true, printBackground: true }, (sucesso, motivo) => {
      if (!sucesso) console.error(`[electron] Falha ao imprimir bilhete: ${motivo}`);
      resolve({ sucesso, erro: sucesso ? null : motivo });
    });
  });
});

async function criarJanela() {
  janelaPrincipal = new BrowserWindow({
    width: 1366,
    height: 768,
    show: false,
    icon: path.join(__dirname, '..', 'build-resources', 'icon.ico'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  janelaPrincipal.on('closed', () => {
    janelaPrincipal = null;
  });

  for (let tentativa = 1; tentativa <= 2; tentativa += 1) {
    let temporizador;
    try {
      await Promise.race([
        janelaPrincipal.loadURL(`http://localhost:${PORTA}`),
        new Promise((_, reject) => {
          temporizador = setTimeout(() => reject(new Error('A janela do PDV não carregou em 30 segundos.')), 30000);
        }),
      ]);
      break;
    } catch (erro) {
      console.error(`[electron] Tentativa ${tentativa} de abrir a janela falhou:`, erro);
      if (tentativa === 2) throw erro;
      await new Promise(resolve => setTimeout(resolve, 1000));
    } finally {
      clearTimeout(temporizador);
    }
  }
  janelaPrincipal.maximize();
  janelaPrincipal.show();
}

app.whenReady().then(async () => {
  // Força tema claro pra barra de título nativa (Windows aplica dark mode do sistema por padrão,
  // deixando a barra preta) — a UI do PDV é toda clara, então a barra escura destoa.
  nativeTheme.themeSource = 'light';

  // Troca o menu padrão (File/Edit/View/Window/Help com "Reload"/"Toggle DevTools", que não faz
  // sentido pro operador de caixa) por um menu mínimo só com "Ajuda" (verificar atualização, sobre).
  montarMenu();

  // A instalação nova ainda não tem cadastro de conexão. Permite importá-lo antes de
  // carregar qualquer módulo do servidor, preservando a inicialização das instalações existentes.
  try {
    const configurado = await require('./configuracao-inicial.cjs')({ dialog,
      diretorioProjeto: path.join(__dirname, '..'), diretorioResources: process.resourcesPath,
      diretorioConfiguracao: process.env.PDV_CONFIG_DIR, arquivoExplicito: process.env.PDV_ENV_FILE });
    if (!configurado) { app.quit(); return; }
  } catch (erro) {
    dialog.showErrorBox('Configurar PDV Fort Fruit', String(erro.message || erro));
    app.quit(); return;
  }
  abrirSplash();

  // Sobe o servidor embutido (Express + SQLite) antes de abrir a janela. server/server.js termina
  // o import sem aguardar qualquer rede; a janela espera somente a porta local estar escutando.
  const servidorUrl = require('node:url').pathToFileURL(path.join(__dirname, '..', 'server', 'server.js')).href;
  try {
    const { servidorPronto } = await import(servidorUrl);
    await servidorPronto;
  } catch (erro) {
    console.error('[electron] Falha ao subir o servidor embutido:', erro);
    const mensagem =
      erro?.code === 'EADDRINUSE'
        ? 'Já existe outra cópia do PDV Fort Fruit (ou outro programa) usando a porta 3001. Feche-a antes de abrir de novo.'
        : `Não foi possível iniciar o servidor local: ${erro?.message || erro}`;
    fecharSplash();
    dialog.showErrorBox('PDV Fort Fruit', mensagem);
    app.quit();
    return;
  }

  try {
    await criarJanela();
  } catch (erro) {
    console.error('[electron] Falha ao abrir a janela principal:', erro);
    fecharSplash();
    if (janelaPrincipal && !janelaPrincipal.isDestroyed()) janelaPrincipal.destroy();
    dialog.showErrorBox('PDV Fort Fruit', `Não foi possível abrir a janela principal: ${erro?.message || erro}`);
    app.quit();
    return;
  }
  fecharSplash();

  configurarAutoUpdate();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) criarJanela();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
