import './env.js';
import sql from 'mssql';
import { getMssqlConfig } from './mssql-config.js';

export async function consultarPrecosSegundaUnidade(tabela) {
  if (!/^\d{3}$/.test(tabela)) throw new Error('Tabela de preço inválida.');
  const pool = new sql.ConnectionPool(getMssqlConfig());
  try {
    await pool.connect();
    const { recordset } = await pool.request().input('tabela', sql.VarChar(3), tabela).query(`
      SELECT RTRIM(DA1_CODPRO) AS produto, DA1_PRC2UM AS preco
      FROM DA1140 WHERE DA1_FILIAL='01' AND DA1_CODTAB=@tabela
        AND D_E_L_E_T_='' AND DA1_ATIVO='1'
    `);
    const precos = new Map();
    for (const item of recordset) {
      const produto = String(item.produto || '').trim();
      const preco = item.preco == null ? null : Number(item.preco);
      if (!produto || preco == null || !Number.isFinite(preco) || preco < 0) continue;
      if (precos.has(produto) && precos.get(produto) !== preco) throw new Error(`Preço da segunda unidade ambíguo: ${produto}, tabela ${tabela}.`);
      precos.set(produto, preco);
    }
    return precos;
  } finally { await pool.close().catch(() => {}); }
}

export async function atualizarPrecosSegundaUnidade(db, tabela) {
  const precos = await consultarPrecosSegundaUnidade(tabela);
  const atualizar = db.prepare('UPDATE precos SET preco_segunda_unidade=? WHERE tabela=? AND produto=?');
  db.transaction(() => {
    db.prepare('UPDATE precos SET preco_segunda_unidade=NULL WHERE tabela=?').run(tabela);
    for (const [produto, preco] of precos) atualizar.run(preco, tabela, produto);
  })();
  return { tabela, produtos: precos.size };
}
