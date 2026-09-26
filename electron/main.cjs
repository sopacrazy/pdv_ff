// Processo principal do Electron. Fica em CommonJS (.cjs) de propósito — electron e electron-updater
// são mais tranquilos em CJS, e o resto do projeto usa "type": "module" (ESM) no package.json, então
// aqui dentro usamos import() dinâmico pra carregar o servidor (server/server.js, que é ESM).
const path = require('node:path');
const fs = require('node:fs');
const { app, BrowserWindow, Menu, dialog, nativeTheme, shell } = require('electron');
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

// Token de acesso ao GitHub pra baixar releases do repositório privado sopacrazy/pdv_ff — sem ele
// o electron-updater não consegue nem listar nem baixar os assets de um repo privado, mesmo sendo
// só leitura. Não é commitado: build-resources/gh-token.txt é gitignored, e o electron-builder
// copia esse arquivo pra dentro do app empacotado (extraResources, ver package.json). Em dev
// (rodando direto da pasta do projeto, sem empacotar), cai no fallback abaixo ou na variável de
// ambiente GH_TOKEN.
function lerTokenGithub() {
  const candidatos = [
    path.join(process.resourcesPath || '', 'gh-token.txt'),
    path.join(__dirname, '..', 'build-resources', 'gh-token.txt'),
  ];
  for (const candidato of candidatos) {
    try {
      const conteudo = fs.readFileSync(candidato, 'utf-8').trim();
      if (conteudo) return conteudo;
    } catch {
      // arquivo não existe nesse candidato — tenta o próximo
    }
  }
  return process.env.GH_TOKEN || '';
}

function configurarAutoUpdate() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  const token = lerTokenGithub();
  if (!token) {
    console.warn('[electron] Nenhum token do GitHub encontrado — auto-update desativado (repo é privado).');
    return;
  }
  autoUpdateDisponivel = true;

  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'sopacrazy',
    repo: 'pdv_ff',
    private: true,
    token,
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
      message: 'Auto-update não está configurado nesta instalação (token do GitHub ausente).',
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

async function criarJanela() {
  janelaPrincipal = new BrowserWindow({
    width: 1366,
    height: 768,
    show: false,
    icon: path.join(__dirname, '..', 'build-resources', 'icon.ico'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const prontoParaMostrar = new Promise((resolve) => {
    janelaPrincipal.once('ready-to-show', () => {
      janelaPrincipal.maximize();
      janelaPrincipal.show();
      resolve();
    });
  });

  janelaPrincipal.on('closed', () => {
    janelaPrincipal = null;
  });

  await janelaPrincipal.loadURL(`http://localhost:${PORTA}`);
  await prontoParaMostrar;
}

app.whenReady().then(async () => {
  abrirSplash();

  // Força tema claro pra barra de título nativa (Windows aplica dark mode do sistema por padrão,
  // deixando a barra preta) — a UI do PDV é toda clara, então a barra escura destoa.
  nativeTheme.themeSource = 'light';

  // Troca o menu padrão (File/Edit/View/Window/Help com "Reload"/"Toggle DevTools", que não faz
  // sentido pro operador de caixa) por um menu mínimo só com "Ajuda" (verificar atualização, sobre).
  montarMenu();

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

  await criarJanela();
  fecharSplash();

  configurarAutoUpdate();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) criarJanela();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
