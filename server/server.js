import './env.js';
import cron from 'node-cron';
import { syncProdutos } from './sync-produtos.js';
import { syncClientePadrao } from './sync-cliente.js';
import { syncUsuariosProtheus } from './sync-usuarios-protheus.js';
import { syncVendedoresProtheus } from './sync-vendedores-protheus.js';
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

iniciarApi();

await rodarSync('inicialização');

cron.schedule(CRON_EXPRESSAO, () => rodarSync('agendada'));

console.log(`[server] Backend PDV rodando. Sincronização agendada a cada 15 minutos (${CRON_EXPRESSAO}).`);
