import 'dotenv/config';
import cron from 'node-cron';
import { syncProdutos } from './sync-produtos.js';
import { syncClientePadrao } from './sync-cliente.js';
import { iniciarApi } from './api.js';

const CRON_EXPRESSAO = '*/15 * * * *';

async function rodarSync(origem) {
  console.log(`[server] Iniciando sincronização (${origem})...`);

  const produtos = await syncProdutos();
  if (produtos.sucesso) {
    console.log(`[server] Produtos OK — ${produtos.produtosSincronizados} produto(s) sincronizado(s).`);
  } else {
    console.error(`[server] Produtos FALHA — cache local mantido intacto. Erro: ${produtos.erro}`);
  }

  const cliente = await syncClientePadrao();
  if (cliente.sucesso) {
    console.log(`[server] Cliente padrão OK.`);
  } else {
    console.error(`[server] Cliente padrão FALHA — cache local mantido intacto. Erro: ${cliente.erro}`);
  }

  return { produtos, cliente };
}

iniciarApi();

await rodarSync('inicialização');

cron.schedule(CRON_EXPRESSAO, () => rodarSync('agendada'));

console.log(`[server] Backend PDV rodando. Sincronização agendada a cada 15 minutos (${CRON_EXPRESSAO}).`);
