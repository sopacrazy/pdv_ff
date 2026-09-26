import { sincronizarUnidadesBilhete } from './sync-unidades-bilhete.js';
import { fileURLToPath } from 'url';
import { getProtheusCacheDb } from './protheus-cache-db.js';
import { getDb } from './db.js';
import { consultar4Sales, consultarTodasPaginas4Sales } from './protheus-4sales-api.js';

const FILIAL = '01';
const EMPRESA = '14';
const ARMAZEM_ESTOQUE = '01';
// Cada cliente exige duas leituras calculadas pela REST. Com 32 trabalhadores, a carga real
// de 5.581 clientes termina dentro da janela de cinco minutos sem iniciar ciclos sobrepostos.
const CONCORRENCIA_CREDITO = 32;
let sincronizacaoEmAndamento = null;
const sincronizacoesPrecosEmAndamento = new Map();

const texto = (valor) => String(valor ?? '').trim();
const codigoReferencia = (valor) => {
  if (valor && typeof valor === 'object') return texto(valor.id || valor.code || valor.internalid);
  return texto(valor);
};
const excluido = (valor) => valor === true || valor === 1 || texto(valor) === '1' || texto(valor) === '*';

function metadata(db, chave) {
  return db.prepare('SELECT valor FROM cache_metadata WHERE chave = ?').get(chave)?.valor || null;
}

function salvarMetadata(db, chave, valor) {
  if (!valor) return;
  db.prepare(`
    INSERT INTO cache_metadata (chave, valor, atualizado_em) VALUES (?, ?, ?)
    ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor, atualizado_em=excluded.atualizado_em
  `).run(chave, valor, new Date().toISOString());
}

async function colecaoCompletaOuDiff(db, chave, completo, diff) {
  const tabelaCache = { clientes_sync: 'clientes', financeiro_sync: 'situacoes_financeiras', produtos_sync: 'produtos_bilhete' }[chave];
  const cacheVazio = tabelaCache ? db.prepare(`SELECT COUNT(1) AS n FROM ${tabelaCache}`).get().n === 0 : false;
  // Se uma versão nova criar a tabela local depois de o marcador já existir, uma consulta diff
  // devolveria zero e deixaria o cache vazio para sempre. Nesse caso força a carga completa.
  const anterior = cacheVazio ? null : metadata(db, chave);
  const caminho = anterior ? `${diff}/${encodeURIComponent(anterior)}` : completo;
  const resultado = await consultarTodasPaginas4Sales(caminho);
  return { ...resultado, chaveMetadata: chave };
}

export async function sincronizarCreditoCliente(codigo, loja, { db = getProtheusCacheDb(), atualizarCadastro = false } = {}) {
  const codigoLimpo = texto(codigo);
  const lojaLimpa = texto(loja);
  if (!codigoLimpo || !lojaLimpa) throw new Error('Cliente/loja inválidos para sincronizar crédito.');
  const consultas = [
    consultar4Sales(`api/tgv/customers/creditlimit/${encodeURIComponent(codigoLimpo)}/${encodeURIComponent(lojaLimpa)}`),
    consultar4Sales(`api/tgv/financialsecurities/financialdefault/${encodeURIComponent(codigoLimpo)}/${encodeURIComponent(lojaLimpa)}`),
  ];
  if (atualizarCadastro) consultas.push(
    consultar4Sales(`api/tgv/customers/${encodeURIComponent(codigoLimpo)}/${encodeURIComponent(lojaLimpa)}`),
    consultar4Sales(`api/tgv/financialstatus/${encodeURIComponent(codigoLimpo)}/${encodeURIComponent(lojaLimpa)}`),
  );
  const [credito, inadimplencia, cadastro, financeiro] = await Promise.all(consultas);
  const saldoCredito = Number(credito?.creditLimitBalance);
  const valorInadimplencia = Number(inadimplencia?.financialdefault);
  if (!Number.isFinite(saldoCredito) || !Number.isFinite(valorInadimplencia)) {
    throw new Error(`Indicadores financeiros inválidos para ${codigoLimpo}/${lojaLimpa}.`);
  }
  const atualizadoEm = new Date().toISOString();
  db.prepare(`
    INSERT INTO situacoes_credito (filial,codigo,loja,saldo_credito,inadimplencia,atualizado_em)
    VALUES (?,?,?,?,?,?)
    ON CONFLICT(filial,codigo,loja) DO UPDATE SET
      saldo_credito=excluded.saldo_credito,
      inadimplencia=excluded.inadimplencia,
      atualizado_em=excluded.atualizado_em
  `).run(FILIAL, codigoLimpo, lojaLimpa, saldoCredito, valorInadimplencia, atualizadoEm);
  if (atualizarCadastro) {
    if (texto(cadastro?.code) !== codigoLimpo || texto(cadastro?.store) !== lojaLimpa) {
      throw new Error(`Cadastro devolvido pela REST não corresponde a ${codigoLimpo}/${lojaLimpa}.`);
    }
    db.transaction(() => {
      db.prepare(`
        UPDATE clientes SET nome=?,fantasia=?,cpf_cnpj=?,condicao_pagamento=?,tabela_preco=?,risco=?,
          limite_credito=?,status=?,dados_json=?,atualizado_em=?
        WHERE filial=? AND codigo=? AND loja=?
      `).run(
        texto(cadastro.name), texto(cadastro.fantasy), texto(cadastro.cgc),
        codigoReferencia(cadastro.paymentconditions || cadastro.paymentconditioninternalid),
        codigoReferencia(cadastro.pricelist || cadastro.pricelistinternalid), texto(cadastro.risk),
        Number(cadastro.creditlimit) || 0, texto(cadastro.status), JSON.stringify(cadastro), atualizadoEm,
        FILIAL, codigoLimpo, lojaLimpa,
      );
      db.prepare(`
        INSERT INTO situacoes_financeiras (filial,codigo,loja,vencimento_mais_antigo,excluido,atualizado_em)
        VALUES (?,?,?,?,0,?)
        ON CONFLICT(filial,codigo,loja) DO UPDATE SET
          vencimento_mais_antigo=excluded.vencimento_mais_antigo,excluido=0,atualizado_em=excluded.atualizado_em
      `).run(FILIAL, codigoLimpo, lojaLimpa, texto(financeiro?.oldestdue) || null, atualizadoEm);
    })();
  }
  return { saldoCredito, inadimplencia: valorInadimplencia, atualizadoEm };
}

async function sincronizarCreditosClientes(db) {
  const clientes = db.prepare(`
    SELECT codigo,loja FROM clientes
    WHERE filial=? AND excluido=0 AND codigo<>'' AND loja<>''
    ORDER BY COALESCE((SELECT atualizado_em FROM situacoes_credito sc
      WHERE sc.filial=clientes.filial AND sc.codigo=clientes.codigo AND sc.loja=clientes.loja), ''), codigo, loja
  `).all(FILIAL);
  let proximo = 0;
  let atualizados = 0;
  let falhas = 0;
  async function trabalhador() {
    while (proximo < clientes.length) {
      const cliente = clientes[proximo++];
      try {
        await sincronizarCreditoCliente(cliente.codigo, cliente.loja, { db });
        atualizados += 1;
      } catch (erro) {
        falhas += 1;
        if (falhas <= 5) console.error(`[sync-bilhetes] Crédito ${cliente.codigo}/${cliente.loja}: ${erro.message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCORRENCIA_CREDITO, clientes.length) }, () => trabalhador()));
  if (falhas === 0) salvarMetadata(db, 'credito_sync', new Date().toISOString());
  else console.error(`[sync-bilhetes] Crédito: ${falhas} cliente(s) não atualizado(s); snapshots anteriores preservados.`);
  return { atualizados, falhas, total: clientes.length };
}

async function executarSincronizacaoCacheBilhetes() {
  const db = getProtheusCacheDb();
  const agora = new Date().toISOString();
  try {
    const [clientes, financeiro, produtos, condicoes, tabelas, estoques] = await Promise.all([
      colecaoCompletaOuDiff(db, 'clientes_sync', 'api/tgv/customers', 'api/tgv/customers/sync/diff'),
      colecaoCompletaOuDiff(db, 'financeiro_sync', 'api/tgv/financialstatus/sync', 'api/tgv/financialstatus/sync/diff'),
      colecaoCompletaOuDiff(db, 'produtos_sync', 'api/tgv/products', 'api/tgv/products/sync/diff'),
      consultarTodasPaginas4Sales('api/tgv/paymentconditions'),
      consultarTodasPaginas4Sales('api/tgv/priceList'),
      // A API nativa retorna o saldo por empresa, filial e armazém. Uma carga única grande é
      // consideravelmente mais leve que consultar milhares de produtos individualmente.
      consultarTodasPaginas4Sales('api/retail/v1/RetailStockLevel', { pageSize: 20000, timeoutMs: 60000 })
        .catch((erro) => ({ erro })),
    ]);

    const gravarCliente = db.prepare(`
      INSERT INTO clientes (filial,codigo,loja,nome,fantasia,cpf_cnpj,condicao_pagamento,tabela_preco,risco,limite_credito,status,excluido,dados_json,atualizado_em)
      VALUES (@filial,@codigo,@loja,@nome,@fantasia,@cpf_cnpj,@condicao_pagamento,@tabela_preco,@risco,@limite_credito,@status,@excluido,@dados_json,@atualizado_em)
      ON CONFLICT(filial,codigo,loja) DO UPDATE SET nome=excluded.nome,fantasia=excluded.fantasia,cpf_cnpj=excluded.cpf_cnpj,
        condicao_pagamento=excluded.condicao_pagamento,tabela_preco=excluded.tabela_preco,risco=excluded.risco,
        limite_credito=excluded.limite_credito,status=excluded.status,excluido=excluded.excluido,dados_json=excluded.dados_json,atualizado_em=excluded.atualizado_em
    `);
    const gravarFinanceiro = db.prepare(`
      INSERT INTO situacoes_financeiras (filial,codigo,loja,vencimento_mais_antigo,excluido,atualizado_em)
      VALUES (@filial,@codigo,@loja,@vencimento,@excluido,@atualizado_em)
      ON CONFLICT(filial,codigo,loja) DO UPDATE SET vencimento_mais_antigo=excluded.vencimento_mais_antigo,excluido=excluded.excluido,atualizado_em=excluded.atualizado_em
    `);
    const gravarProduto = db.prepare(`
      INSERT INTO produtos_bilhete (codigo,descricao,tipo,status,ativo,armazem_padrao,unidade,codigo_barras,segunda_unidade,fator_conversao,tipo_conversao,excluido,atualizado_em)
      VALUES (@codigo,@descricao,@tipo,@status,@ativo,@armazem_padrao,@unidade,@codigo_barras,@segunda_unidade,@fator_conversao,@tipo_conversao,@excluido,@atualizado_em)
      ON CONFLICT(codigo) DO UPDATE SET descricao=excluded.descricao,tipo=excluded.tipo,status=excluded.status,
        ativo=excluded.ativo,armazem_padrao=excluded.armazem_padrao,unidade=excluded.unidade,
        codigo_barras=excluded.codigo_barras,segunda_unidade=COALESCE(NULLIF(excluded.segunda_unidade,''),produtos_bilhete.segunda_unidade),
        fator_conversao=COALESCE(excluded.fator_conversao,produtos_bilhete.fator_conversao),tipo_conversao=COALESCE(NULLIF(excluded.tipo_conversao,''),produtos_bilhete.tipo_conversao),
        excluido=excluded.excluido,atualizado_em=excluded.atualizado_em
    `);
    const gravarCondicao = db.prepare(`
      INSERT INTO condicoes_pagamento (filial,codigo,descricao,status,excluido,atualizado_em)
      VALUES (@filial,@codigo,@descricao,@status,@excluido,@atualizado_em)
      ON CONFLICT(filial,codigo) DO UPDATE SET descricao=excluded.descricao,status=excluded.status,excluido=excluded.excluido,atualizado_em=excluded.atualizado_em
    `);
    const gravarTabela = db.prepare(`
      INSERT INTO tabelas_preco (filial,codigo,descricao,inicio,fim,status,excluido,atualizado_em)
      VALUES (@filial,@codigo,@descricao,@inicio,@fim,@status,@excluido,@atualizado_em)
      ON CONFLICT(filial,codigo) DO UPDATE SET descricao=excluded.descricao,inicio=excluded.inicio,fim=excluded.fim,status=excluded.status,excluido=excluded.excluido,atualizado_em=excluded.atualizado_em
    `);

    const produtosLocais = new Map(getDb().prepare(`
      SELECT codigo,codigo_barras,segunda_unidade,fator_conversao,tipo_conversao FROM produtos
    `).all().map((produto) => [produto.codigo, produto]));

    db.transaction(() => {
      for (const c of clientes.itens) {
        const filial = texto(c.branch || c.branchid).split(',').at(-1) || FILIAL;
        if (filial !== FILIAL || !texto(c.code) || !texto(c.store)) continue;
        gravarCliente.run({
          filial, codigo: texto(c.code), loja: texto(c.store), nome: texto(c.name), fantasia: texto(c.fantasy),
          cpf_cnpj: texto(c.cgc), condicao_pagamento: codigoReferencia(c.paymentconditions || c.paymentconditioninternalid),
          tabela_preco: codigoReferencia(c.pricelist || c.pricelistinternalid), risco: texto(c.risk),
          limite_credito: Number(c.creditlimit) || 0, status: texto(c.status), excluido: excluido(c.deleted) ? 1 : 0,
          dados_json: JSON.stringify(c), atualizado_em: agora,
        });
      }
      for (const f of financeiro.itens) {
        const filial = texto(f.branch || f.branchid).split(',').at(-1) || FILIAL;
        if (filial !== FILIAL || !texto(f.code) || !texto(f.store)) continue;
        gravarFinanceiro.run({ filial, codigo: texto(f.code), loja: texto(f.store), vencimento: texto(f.oldestdue) || null,
          excluido: excluido(f.deleted) ? 1 : 0, atualizado_em: agora });
      }
      for (const p of produtos.itens) {
        const codigo = texto(p.code || p.internalid);
        if (!codigo) continue;
        const local = produtosLocais.get(codigo) || {};
        gravarProduto.run({ codigo, descricao: texto(p.description), tipo: texto(p.type), status: texto(p.status),
          ativo: texto(p.active), armazem_padrao: texto(p.standardwarehouse), unidade: texto(p.measureunit),
          codigo_barras: texto(p.barcode || p.ean || p.ean13 || local.codigo_barras),
          segunda_unidade: texto(p.secondmeasureunit || p.secondMeasureUnit || p.measureunit2 || p.secondunit || local.segunda_unidade),
          fator_conversao: Number(p.conversionfactor || p.conversionFactor || p.factorconversion || local.fator_conversao) || null,
          tipo_conversao: texto(p.conversiontype || p.conversionType || p.typeconversion || local.tipo_conversao),
          excluido: excluido(p.deleted) ? 1 : 0, atualizado_em: agora });
      }
      for (const c of condicoes.itens) {
        const filial = texto(c.branchid).split(',').at(-1) || FILIAL;
        if (filial !== FILIAL || !texto(c.paymentcode)) continue;
        gravarCondicao.run({ filial, codigo: texto(c.paymentcode), descricao: texto(c.paymentdescription), status: texto(c.status),
          excluido: excluido(c.deleted) ? 1 : 0, atualizado_em: agora });
      }
      for (const t of tabelas.itens) {
        const filial = texto(t.branchid).split(',').at(-1) || FILIAL;
        if (filial !== FILIAL || !texto(t.code)) continue;
        gravarTabela.run({ filial, codigo: texto(t.code), descricao: texto(t.description), inicio: texto(t.inicialdate), fim: texto(t.finaldate),
          status: texto(t.status), excluido: excluido(t.deleted) ? 1 : 0, atualizado_em: agora });
      }
      // O marcador incremental só avança junto com os dados. Se qualquer gravação falhar,
      // a transação inteira volta e o próximo ciclo pede novamente o mesmo intervalo ao REST.
      salvarMetadata(db, clientes.chaveMetadata, clientes.ultimaSincronizacao);
      salvarMetadata(db, financeiro.chaveMetadata, financeiro.ultimaSincronizacao);
      salvarMetadata(db, produtos.chaveMetadata, produtos.ultimaSincronizacao);
    })();

    let estoquesAtualizados = 0;
    if (!estoques.erro) {
      const gravarEstoque = db.prepare(`
        UPDATE produtos_bilhete
        SET saldo_estoque=?, estoque_reservado=?, estoque_atualizado_em=?
        WHERE codigo=?
      `);
      db.transaction(() => {
        // A resposta completa representa o retrato atual. Produtos sem registro no armazém 01
        // ficam com saldo zero; uma falha na REST não entra aqui e preserva o retrato anterior.
        db.prepare(`
          UPDATE produtos_bilhete
          SET saldo_estoque=0, estoque_reservado=0, estoque_atualizado_em=?
          WHERE excluido=0
        `).run(agora);
        for (const estoque of estoques.itens) {
          if (texto(estoque.companyId) !== EMPRESA || texto(estoque.branchId) !== FILIAL ||
              texto(estoque.warehouseinternalid) !== ARMAZEM_ESTOQUE) continue;
          const codigo = texto(estoque.iteminternalId);
          if (!codigo) continue;
          const resultado = gravarEstoque.run(
            Number(estoque.currentstockamount) || 0,
            Number(estoque.bookedstockamount) || 0,
            agora,
            codigo,
          );
          estoquesAtualizados += resultado.changes;
        }
        salvarMetadata(db, 'estoques_sync', agora);
      })();
    } else {
      console.error(`[sync-bilhetes] Estoque não atualizado; snapshot anterior preservado: ${estoques.erro.message}`);
    }

    await sincronizarUnidadesBilhete();
    const creditos = await sincronizarCreditosClientes(db);

    // Somente tabelas já utilizadas por algum Bilhete são mantidas quentes. Isso evita baixar
    // milhares de preços de 61 tabelas que este caixa talvez nunca use, mas garante atualização
    // automática a cada ciclo de cinco minutos para as tabelas efetivamente usadas.
    const tabelasUsadas = db.prepare("SELECT chave FROM cache_metadata WHERE chave LIKE 'precos_%'").all();
    for (const { chave } of tabelasUsadas) {
      const tabela = chave.slice('precos_'.length);
      try {
        await sincronizarPrecosTabela(tabela, { forcar: true });
      } catch (erro) {
        console.error(`[sync-bilhetes] Preços da tabela ${tabela} não atualizados; cache anterior preservado: ${erro.message}`);
      }
    }

    console.log(`[sync-bilhetes] ${agora} — clientes ${clientes.itens.length}, financeiro ${financeiro.itens.length}, crédito ${creditos.atualizados}/${creditos.total}, produtos ${produtos.itens.length}, estoque ${estoquesAtualizados}, condições ${condicoes.itens.length}, tabelas ${tabelas.itens.length}.`);
    return { sucesso: true, clientes: clientes.itens.length, financeiro: financeiro.itens.length, creditos };
  } catch (erro) {
    console.error(`[sync-bilhetes] Falha; cache anterior preservado: ${erro.message}`);
    return { sucesso: false, erro: erro.message };
  }
}

export function sincronizarCacheBilhetes() {
  if (sincronizacaoEmAndamento) return sincronizacaoEmAndamento;
  sincronizacaoEmAndamento = executarSincronizacaoCacheBilhetes()
    .finally(() => { sincronizacaoEmAndamento = null; });
  return sincronizacaoEmAndamento;
}

export async function sincronizarPrecosTabela(tabela, { forcar = false } = {}) {
  const codigo = texto(tabela);
  if (!/^\d{3}$/.test(codigo)) throw new Error('Tabela de preço inválida.');
  const db = getProtheusCacheDb();
  const ultima = metadata(db, `precos_${codigo}`);
  if (!forcar && ultima && Date.now() - new Date(ultima).getTime() < 5 * 60 * 1000) return { sucesso: true, cache: true };
  const existente = sincronizacoesPrecosEmAndamento.get(codigo);
  if (existente) return existente;

  const tarefa = (async () => {
    const resultado = await consultarTodasPaginas4Sales(`api/supply/v2/PriceListHeaderItems/${codigo}/itensTablePrice/`);
    const agora = new Date().toISOString();
    const gravar = db.prepare(`
      INSERT INTO precos (tabela,produto,preco,ativo,validade,atualizado_em) VALUES (?,?,?,?,?,?)
      ON CONFLICT(tabela,produto) DO UPDATE SET preco=excluded.preco,ativo=excluded.ativo,validade=excluded.validade,atualizado_em=excluded.atualizado_em
    `);
    db.transaction(() => {
      for (const item of resultado.itens) {
        if (!texto(item.itemCode)) continue;
        gravar.run(codigo, texto(item.itemCode), Number(item.minimumSalesPrice) || 0, texto(item.activeItemPrice) === '1' ? 1 : 0, texto(item.itemValidity), agora);
      }
      salvarMetadata(db, `precos_${codigo}`, agora);
    })();
    return { sucesso: true, itens: resultado.itens.length };
  })();
  sincronizacoesPrecosEmAndamento.set(codigo, tarefa);
  try {
    return await tarefa;
  } finally {
    if (sincronizacoesPrecosEmAndamento.get(codigo) === tarefa) sincronizacoesPrecosEmAndamento.delete(codigo);
  }
}

const executadoDiretamente = process.argv[1] === fileURLToPath(import.meta.url);
if (executadoDiretamente) {
  const resultado = await sincronizarCacheBilhetes();
  process.exit(resultado.sucesso ? 0 : 1);
}
