// Preparar é somente leitura no ERP. --executar cria dois bilhetes na base DESENV,
// com IDs exclusivos; tentativas ficam registradas e nunca são reenviadas automaticamente.
import '../env.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import sql from 'mssql';
import { getMssqlConfig } from '../mssql-config.js';
import { validarContaRestPrincipal } from '../conta-rest-principal.js';
import { consultar4Sales, consultarTodasPaginas4Sales } from '../protheus-4sales-api.js';
import { montarVenda4Sales, enviarVenda4Sales } from '../protheus-4sales-vendas.js';
import { consultarFormaPagamentoCliente } from '../forma-pagamento-cliente.js';

const arquivo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data/homologacao-rest-principal-20260930.json');
const executar = process.argv.includes('--executar');
const somenteVerificar = process.argv.includes('--verificar');
const salvar = plano => { fs.mkdirSync(path.dirname(arquivo), {recursive:true}); fs.writeFileSync(arquivo, JSON.stringify(plano,null,2)); };

async function conferir(pool, tentativa) {
  const r = await pool.request().input('id',sql.VarChar(100),tentativa.preparado.body._id)
    .input('bilhete',sql.VarChar(10),tentativa.resultado?.bilhete || '').query(`
    SELECT RTRIM(Z4_BILHETE) AS bilhete, RTRIM(Z4_VEND) AS vendedorBilhete,
      RTRIM(C5_VEND1) AS vendedorPedido, RTRIM(Z4_XPED4SA) AS idArmazenado
    FROM SZ4140 LEFT JOIN SC5140 ON C5_FILIAL=Z4_FILIAL AND C5_NUM=Z4_BILHETE AND SC5140.D_E_L_E_T_=''
    WHERE SZ4140.D_E_L_E_T_='' AND Z4_FILIAL='01' AND
      (RTRIM(Z4_XPED4SA)=@id OR (@bilhete<>'' AND Z4_BILHETE=@bilhete))`);
  if(r.recordset.length!==1) throw new Error(`Esperado um bilhete para o ID ${tentativa.preparado.body._id}; encontrados ${r.recordset.length}.`);
  const registro=r.recordset[0];
  if(!registro.idArmazenado || !tentativa.preparado.body._id.startsWith(registro.idArmazenado))
    throw new Error('O identificador do bilhete consultado não corresponde à homologação.');
  if(registro.vendedorBilhete!==tentativa.vendedor || registro.vendedorPedido!==tentativa.vendedor)
    throw new Error(`Vendedor divergente: esperado ${tentativa.vendedor}, bilhete ${registro.vendedorBilhete}, pedido ${registro.vendedorPedido}.`);
  tentativa.conferencia=registro;
  tentativa.estado='CONFERIDO';
}

const pool = new sql.ConnectionPool(getMssqlConfig());
try {
  if(process.env.MSSQL_DATABASE?.toUpperCase()!=='DESENV') throw new Error('Esta homologação exige o SQL da base DESENV.');
  const conta = await validarContaRestPrincipal({timeoutMs:20000});
  await pool.connect();
  let plano;
  if(fs.existsSync(arquivo)) plano=JSON.parse(fs.readFileSync(arquivo,'utf8'));
  else {
    const controle=JSON.parse(fs.readFileSync(path.resolve(path.dirname(arquivo),'controle-homologacao-rest.json'),'utf8'));
    if(!controle.id || !controle.bilhete) throw new Error('Sem venda integrada para comprovar que REST e SQL consultam a mesma base.');
    const confirmado=await pool.request().input('bilhete',sql.VarChar(10),controle.bilhete).input('id',sql.VarChar(100),controle.id)
      .query("SELECT Z4_BILHETE FROM SZ4140 WHERE D_E_L_E_T_='' AND Z4_FILIAL='01' AND Z4_BILHETE=@bilhete AND RTRIM(Z4_XPED4SA)=@id");
    if(confirmado.recordset.length!==1) throw new Error('O bilhete de controle não confere: SQL e REST podem estar em bases diferentes.');
    const vendedores=(await pool.request().query("SELECT RTRIM(A3_COD) AS codigo,RTRIM(A3_NOME) AS nome,RTRIM(A3_CODUSR) AS usuarioId FROM SA3140 WHERE D_E_L_E_T_='' AND A3_FILIAL='01' AND A3_MSBLQL<>'1' AND A3_COD IN ('000004','000007') ORDER BY A3_COD")).recordset;
    if(vendedores.length!==2 || vendedores.some(v=>!v.usuarioId)) throw new Error('Os dois vendedores de homologação devem estar ativos e vinculados a usuários.');
    const cadastro=await consultar4Sales('api/tgv/customers/0001/01');
    const forma=await consultarFormaPagamentoCliente('0001','01');
    const cliente={...cadastro,formaPagamento:forma.codigo,formaPagamentoDescricao:forma.descricao};
    const tabela=String(cliente.pricelist?.id || cliente.pricelist || '').trim();
    if(!tabela) throw new Error('Cliente à vista sem tabela.');
    const precos=(await consultarTodasPaginas4Sales(`api/supply/v2/PriceListHeaderItems/${encodeURIComponent(tabela)}/itensTablePrice/`)).itens;
    const encontrados=precos.filter(p=>p.itemCode?.trim()==='100.074' && p.activeItemPrice==='1');
    if(encontrados.length!==1) throw new Error('Produto 100.074 sem preço ativo único na tabela do cliente.');
    const unitario=Math.round(Number(encontrados[0].minimumSalesPrice)*100);
    if(!Number.isSafeInteger(unitario) || unitario<=0) throw new Error('Preço de homologação inválido.');
    plano={conta:conta.usuario,base:'DESENV',controle,criadoEm:new Date().toISOString(),tentativas:vendedores.map(v=>{
      const venda={id_integracao:randomUUID().replaceAll('-','').slice(0,27),numero_cupom:'HOMOLOG',caixa:'0001',cliente_codigo:'0001',cliente_loja:'01',cliente_nome:'HOMOLOGACAO CONTA REST PDV',tabela_preco:tabela,forma_pagamento:'033',total:unitario,desconto:0,criado_em:new Date().toISOString(),data_local:'2026-09-30'};
      const itens=[{codigo_produto:'100.074',descricao:'OVO BRANCO FORMA C/30',quantidade:1,valor_unitario:unitario,valor_total:unitario,desconto:0}];
      return {vendedor:v.codigo,estado:'PREPARADO',preparado:montarVenda4Sales(venda,itens,{protheus_usr_id:v.usuarioId,protheus_vend_codigo:v.codigo,protheus_vend_nome:v.nome},cliente,precos)};
    })};
    salvar(plano);
  }
  if(plano.conta!==conta.usuario) throw new Error('Conta configurada diverge do plano preparado.');
  if(executar || somenteVerificar) for(const tentativa of plano.tentativas) {
    if(tentativa.estado==='CONFERIDO') continue;
    if(executar && tentativa.estado==='PREPARADO') {
      // IDs preparados antes da medição do campo podem ser reduzidos, pois nunca foram enviados.
      if(tentativa.preparado.body._id.length>30) {
        tentativa.preparado.body._id=tentativa.preparado.body._id.slice(0,27);
        tentativa.preparado.resumo.id=tentativa.preparado.body._id;
      }
      tentativa.estado='ENVIO_INICIADO'; salvar(plano);
      const resultado=await enviarVenda4Sales(tentativa.preparado,{timeoutMs:150000});
      tentativa.resultado=resultado; salvar(plano);
      if(!resultado.sucesso) throw new Error(`Envio não confirmado para vendedor ${tentativa.vendedor}: ${resultado.erro || resultado.status}. Conferir antes de qualquer nova tentativa.`);
    }
    await conferir(pool,tentativa); salvar(plano);
  }
  console.log(JSON.stringify({conta:plano.conta,base:plano.base,bilhetes:plano.tentativas.map(t=>({vendedor:t.vendedor,id:t.preparado.body._id,valor:t.preparado.body.value,estado:t.estado,conferencia:t.conferencia}))},null,2));
} catch(erro) { console.error(erro.message); process.exitCode=1; }
finally {await pool.close().catch(()=>{});}
