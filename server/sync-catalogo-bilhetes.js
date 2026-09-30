import './env.js';
import sql from 'mssql';
import { getMssqlConfig } from './mssql-config.js';

// Alguns ambientes exigem vendedor na conta REST até para ler /api/tgv/products.
// O SQL já autorizado para sincronização permite ler a SB1 sem alterar a conta técnica.
export async function consultarCatalogoBilheteSql() {
  const pool = new sql.ConnectionPool(getMssqlConfig());
  try {
    await pool.connect();
    const { recordset } = await pool.request().query(`
      SELECT RTRIM(B1_COD) AS code, RTRIM(B1_DESC) AS description,
        RTRIM(B1_TIPO) AS type, RTRIM(B1_LOCPAD) AS standardwarehouse,
        RTRIM(B1_UM) AS measureunit, RTRIM(B1_CODBAR) AS barcode,
        RTRIM(B1_SEGUM) AS secondmeasureunit, B1_CONV AS conversionfactor,
        RTRIM(B1_TIPCONV) AS conversiontype, RTRIM(D_E_L_E_T_) AS deleted,
        CASE WHEN B1_MSBLQL='1' THEN '0' ELSE '1' END AS status
      FROM SB1140 WHERE B1_FILIAL IN ('','01') ORDER BY B1_FILIAL, B1_COD
    `);
    if (!recordset.length) throw new Error('Catálogo SQL vazio; cache anterior preservado.');
    return { itens: recordset, ultimaSincronizacao: new Date().toISOString(), chaveMetadata: 'produtos_sync', fonte: 'sql' };
  } finally {
    await pool.close().catch(() => {});
  }
}

export async function consultarCatalogoBilhete(consultarRest, consultarSql = consultarCatalogoBilheteSql) {
  try { return { ...await consultarRest(), fonte: 'rest' }; }
  catch (erro) {
    if (erro.status !== 403) throw erro;
    console.warn('[sync-bilhetes] Catálogo REST sem permissão; lendo SB1 no SQL configurado.');
    return consultarSql();
  }
}
