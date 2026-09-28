// Ponte mínima entre o renderer (React, contextIsolation ligado) e o processo principal —
// só o necessário pra impressão silenciosa do bilhete (window.print() sempre abre o diálogo do
// Windows; só o processo principal consegue mandar direto pra impressora padrão sem isso).
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  imprimirSilencioso: () => ipcRenderer.invoke('pdv:imprimir-silencioso'),
});
