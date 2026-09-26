import './env.js';
import sql from 'mssql';
import { fileURLToPath } from 'url';
import { getMssqlConfig } from './mssql-config.js';
import { getProtheusCacheDb } from './protheus-cache-db.js';

export function aplicarUnidadesBilhete(db, produtos) {
  const atualizar = db.prepare(`
    UPDATE produtos_bilhete SET unidade=@unidade, segunda_unidade=@segunda_unidade,
      fator_conversao=@fator_conversao, tipo_conversao=@tipo_conversao
    WHERE codigo=@codigo
  `);
  return db.transaction(() => produtos.reduce((total, produto) =>
    total + atualizar.run(produto).changes, 0))();
}

// O catálogo do Bilhete não está limitado à tabela de preços 015 do PDV.
// Consulta apenas cadastro/unidades; os preços continuam sendo os do cliente.
export async function sincronizarUnidadesBilhete() {
  const pool = new sql.ConnectionPool(getMssqlConfig());
  try {
    await pool.connect();
    const { recordset } = await pool.request().query(`
      SELECT RTRIM(B1_COD) AS codigo, RTRIM(B1_UM) AS unidade,
        RTRIM(B1_SEGUM) AS segunda_unidade, B1_CONV AS fator_conversao,
        RTRIM(B1_TIPCONV) AS tipo_conversao
      FROM SB1140 WHERE D_E_L_E_T_ = ''
    `);
    const atualizados = aplicarUnidadesBilhete(getProtheusCacheDb(), recordset);
    return { sucesso: true, atualizados };
  } catch (erro) {
    console.warn(`[sync-unidades-bilhete] Cache mantido: ${erro.message}`);
    return { sucesso: false, erro: erro.message };
  } finally {
    await pool.close().catch(() => {});
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const resultado = await sincronizarUnidadesBilhete();
  console.log(JSON.stringify(resultado));
  process.exitCode = resultado.sucesso ? 0 : 1;
}
