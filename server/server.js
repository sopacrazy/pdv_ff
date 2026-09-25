import './env.js';
import cron from 'node-cron';
import { syncProdutos } from './sync-produtos.js';
import { syncClientePadrao } from './sync-cliente.js';
import { syncUsuariosProtheus } from './sync-usuarios-protheus.js';
import { syncVendedoresProtheus } from './sync-vendedores-protheus.js';
import { iniciarApi } from './api.js';
import { processarFilaProtheus } from './fila-protheus.js';

const CRON_EXPRESSAO = '*/15 * * * *';
// Mais frequente que a sincronização de catálogo: uma venda parada na fila (sem internet no
// momento da finalização) não pode esperar 15 minutos pra ser entregue ao Protheus.
const CRON_EXPRESSAO_FILA_PROTHEUS = '*/2 * * * *';

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

  const usuariosProtheus = await syncUsuariosProtheus();
  if (usuariosProtheus.sucesso) {
    console.log(`[server] Usuários Protheus OK — ${usuariosProtheus.usuariosSincronizados} usuário(s) sincronizado(s).`);
  } else {
    console.error(`[server] Usuários Protheus FALHA — cache local mantido intacto. Erro: ${usuariosProtheus.erro}`);
  }

  const vendedoresProtheus = await syncVendedoresProtheus();
  if (vendedoresProtheus.sucesso) {
    console.log(
      `[server] Vendedores Protheus OK — ${vendedoresProtheus.vendedoresSincronizados} vendedor(es) sincronizado(s).`
    );
  } else {
    console.error(`[server] Vendedores Protheus FALHA — cache local mantido intacto. Erro: ${vendedoresProtheus.erro}`);
  }

  return { produtos, cliente, usuariosProtheus, vendedoresProtheus };
}

// Exportado pra quem embute este servidor (processo principal do Electron) saber exatamente quando
// a porta já está escutando, sem precisar esperar a sincronização em segundo plano abaixo.
export const servidorPronto = iniciarApi();

await rodarSync('inicialização');
await processarFilaProtheus('inicialização');

cron.schedule(CRON_EXPRESSAO, () => rodarSync('agendada'));
cron.schedule(CRON_EXPRESSAO_FILA_PROTHEUS, () => processarFilaProtheus('agendada'));

console.log(`[server] Backend PDV rodando. Sincronização agendada a cada 15 minutos (${CRON_EXPRESSAO}).`);
console.log(`[server] Fila de envio ao Protheus agendada a cada 2 minutos (${CRON_EXPRESSAO_FILA_PROTHEUS}).`);
