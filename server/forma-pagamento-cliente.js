import './env.js';
import sql from 'mssql';
import { getMssqlConfig } from './mssql-config.js';

// A1_COND define o prazo/parcelamento. A1_FORMA define BOL, DEP, R$ etc. (Z4_FORMA).
// A REST de clientes deste ambiente não expõe A1_FORMA; a SA1 é a fonte dessa informação.
export async function consultarFormaPagamentoCliente(codigo, loja, { timeoutMs = 30000 } = {}) {
  const codigoLimpo = String(codigo || '').trim();
  const lojaLimpa = String(loja || '').trim();
  if (!codigoLimpo || codigoLimpo.length > 6 || !lojaLimpa || lojaLimpa.length > 2) throw new Error('Cliente/loja inválidos para consultar A1_FORMA.');
  const pool = new sql.ConnectionPool({ ...getMssqlConfig(), requestTimeout: timeoutMs });
  try {
    await pool.connect();
    const { recordset } = await pool.request()
      .input('cliente', sql.VarChar(6), codigoLimpo)
      .input('loja', sql.VarChar(2), lojaLimpa)
      .query(`
        SELECT RTRIM(A1_FORMA) AS codigo,
          (SELECT TOP 1 RTRIM(X5_DESCRI) FROM SX5140
            WHERE X5_TABELA='24' AND X5_FILIAL IN ('','01') AND D_E_L_E_T_=''
              AND RTRIM(X5_CHAVE)=RTRIM(A1_FORMA)
            ORDER BY CASE WHEN X5_FILIAL='01' THEN 0 ELSE 1 END) AS descricao
        FROM SA1140 WHERE A1_FILIAL='01' AND A1_COD=@cliente AND A1_LOJA=@loja AND D_E_L_E_T_=''
      `);
    if (recordset.length !== 1) throw new Error(`Cliente ${codigoLimpo}/${lojaLimpa} não identificado de forma única na SA1.`);
    const forma = String(recordset[0].codigo || '').trim();
    if (!forma) throw new Error(`Cliente ${codigoLimpo}/${lojaLimpa} sem forma de pagamento (A1_FORMA). Confira o cadastro no Protheus.`);
    return { codigo: forma, descricao: String(recordset[0].descricao || forma).trim() };
  } finally { await pool.close().catch(() => {}); }
}
