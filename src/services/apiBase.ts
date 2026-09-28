import { Capacitor } from '@capacitor/core';

const CHAVE_STORAGE = '@pdv:apiBaseUrl';

export function estaNoAppNativo(): boolean {
  return Capacitor.isNativePlatform();
}

export function obterApiBaseUrl(): string {
  try {
    return localStorage.getItem(CHAVE_STORAGE) || '';
  } catch {
    return '';
  }
}

export function definirApiBaseUrl(url: string): void {
  localStorage.setItem(CHAVE_STORAGE, url.trim().replace(/\/+$/, ''));
}

// Fora do app nativo (navegador normal, servido pelo próprio Express do PC), fetch('/api/...')
// relativo já funciona sozinho — front e API estão no mesmo host:porta. Dentro do app Android os
// arquivos vêm embutidos no APK (esquema local do WebView), então esse mesmo fetch relativo iria
// pro esquema local errado em vez do servidor do PC na rede. Interceptamos window.fetch uma única
// vez no boot do app nativo pra prefixar automaticamente qualquer chamada a /api com o IP
// configurado (ver ConfiguracaoServidorPage) — assim nenhum dos ~40 call sites em src/services
// precisa saber que está rodando dentro de um app empacotado.
export function instalarInterceptorApiNativo(): void {
  if (!estaNoAppNativo()) return;
  const fetchOriginal = window.fetch.bind(window);
  window.fetch = (entrada, init) => {
    if (typeof entrada === 'string' && entrada.startsWith('/api')) {
      return fetchOriginal(`${obterApiBaseUrl()}${entrada}`, init);
    }
    return fetchOriginal(entrada, init);
  };
}
