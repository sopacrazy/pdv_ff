// Ponte exposta pelo processo principal via contextBridge (ver electron/preload.cjs) — só existe
// dentro do app empacotado/rodando via Electron, nunca no navegador puro (`npm run dev`) nem no
// app Android.
export interface ElectronAPI {
  imprimirSilencioso: () => Promise<{ sucesso: boolean; erro: string | null }>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
