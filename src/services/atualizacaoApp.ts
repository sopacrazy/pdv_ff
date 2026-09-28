import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { estaNoAppNativo, obterApiBaseUrl } from './apiBase';

// Live update do app Android (ver server/api.js rotas /api/app/*) — troca só o bundle web dentro
// do app já instalado, sem passar pelo instalador do Android. A URL do update é a do PC (mesma
// configurada em ConfiguracaoServidorPage), só conhecida em runtime — por isso setUpdateUrl()
// dinâmico em vez de um valor fixo no capacitor.config.ts.
export async function configurarAtualizacaoAutomatica(): Promise<void> {
  if (!estaNoAppNativo()) return;
  const baseUrl = obterApiBaseUrl();
  if (!baseUrl) return;
  try {
    await CapacitorUpdater.setUpdateUrl({ url: `${baseUrl}/api/app/atualizacao` });
  } catch (erro) {
    console.error('[atualizacaoApp] Falha ao configurar URL de atualização automática', erro);
  }
}

// Sem isso, o plugin entende que o app pode ter travado ao abrir e reverte sozinho pro bundle
// anterior na próxima vez — precisa ser chamado sempre que o app termina de carregar com sucesso.
export async function confirmarAppPronto(): Promise<void> {
  if (!estaNoAppNativo()) return;
  try {
    await CapacitorUpdater.notifyAppReady();
  } catch (erro) {
    console.error('[atualizacaoApp] Falha ao confirmar app pronto', erro);
  }
}
