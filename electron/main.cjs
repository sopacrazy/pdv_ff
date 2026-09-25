// Processo principal do Electron. Fica em CommonJS (.cjs) de propósito — electron e electron-updater
// são mais tranquilos em CJS, e o resto do projeto usa "type": "module" (ESM) no package.json, então
// aqui dentro usamos import() dinâmico pra carregar o servidor (server/server.js, que é ESM).
const path = require('node:path');
const fs = require('node:fs');
const { app, BrowserWindow, Menu, dialog, nativeTheme } = require('electron');
const { autoUpdater } = require('electron-updater');

const PORTA = 3001;

// O código do app empacotado roda dentro do instalador (pasta somente-leitura em Program Files).
// O banco SQLite precisa ficar num lugar gravável — a pasta de dados do usuário do Windows
// (%APPDATA%/pdv-fort-fruit ou similar). server/db.js lê PDV_DB_DIR na hora que é importado, então
// isso tem que ser setado ANTES do import() do servidor lá embaixo.
process.env.PDV_DB_DIR = path.join(app.getPath('userData'), 'data');
process.env.API_PORT = String(PORTA);

let janelaPrincipal = null;
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
    checagemManualEmAndamento = false;
  });
  autoUpdater.on('update-not-available', () => {
    console.log('[electron] App já está na versão mais recente.');
    if (checagemManualEmAndamento) {
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
  autoUpdater.checkForUpdates().catch((erro) => {
    checagemManualEmAndamento = false;
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

  janelaPrincipal.once('ready-to-show', () => {
    janelaPrincipal.maximize();
    janelaPrincipal.show();
  });

  janelaPrincipal.on('closed', () => {
    janelaPrincipal = null;
  });

  await janelaPrincipal.loadURL(`http://localhost:${PORTA}`);
}

app.whenReady().then(async () => {
  // Força tema claro pra barra de título nativa (Windows aplica dark mode do sistema por padrão,
  // deixando a barra preta) — a UI do PDV é toda clara, então a barra escura destoa.
  nativeTheme.themeSource = 'light';

  // Troca o menu padrão (File/Edit/View/Window/Help com "Reload"/"Toggle DevTools", que não faz
  // sentido pro operador de caixa) por um menu mínimo só com "Ajuda" (verificar atualização, sobre).
  montarMenu();

  // Sobe o servidor embutido (Express + SQLite) antes de abrir a janela. server/server.js é ESM
  // e faz sync com o Protheus + agenda os crons assim que é importado — a janela só espera o
  // servidor HTTP estar de fato escutando (servidorPronto), não a sincronização em segundo plano.
  const servidorUrl = require('node:url').pathToFileURL(path.join(__dirname, '..', 'server', 'server.js')).href;
  const { servidorPronto } = await import(servidorUrl);
  await servidorPronto;

  await criarJanela();

  configurarAutoUpdate();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) criarJanela();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
