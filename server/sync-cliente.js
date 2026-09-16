import 'dotenv/config';
import sql from 'mssql';
import { fileURLToPath } from 'url';
import { getDb } from './db.js';
import { getMssqlConfig } from './mssql-config.js';

const QUERY = `
SELECT
    RTRIM(A1_COD)    AS codigo,
    RTRIM(A1_LOJA)   AS loja,
    RTRIM(A1_NOME)   AS nome,
    RTRIM(A1_CGC)    AS cpf_cnpj
FROM SA1140XX
WHERE A1_FILIAL = '01'
    AND A1_COD = 'YDOVT3'
    AND D_E_L_E_T_ = ''
`;

export async function syncClientePadrao() {
  let pool;
  try {
    pool = await sql.connect(getMssqlConfig());
    const resultado = await pool.request().query(QUERY);
    const linha = resultado.recordset[0];

    if (!linha) {
      throw new Error('Cliente padrão (YDOVT3, filial 01) não encontrado na SA1140XX.');
    }

    const agora = new Date().toISOString();
    const db = getDb();

    db.prepare(`
      INSERT INTO clientes (codigo, loja, nome, cpf_cnpj, atualizado_em)
      VALUES (@codigo, @loja, @nome, @cpf_cnpj, @atualizado_em)
      ON CONFLICT(codigo, loja) DO UPDATE SET
        nome = excluded.nome,
        cpf_cnpj = excluded.cpf_cnpj,
        atualizado_em = excluded.atualizado_em
    `).run({
      codigo: linha.codigo,
      loja: linha.loja,
      nome: linha.nome,
      cpf_cnpj: linha.cpf_cnpj,
      atualizado_em: agora,
    });

    console.log(`[sync-cliente] ${agora} — cliente padrão (${linha.codigo}) sincronizado com sucesso.`);
    return { sucesso: true, clientesSincronizados: 1 };
  } catch (erro) {
    console.error(`[sync-cliente] Falha na sincronização, cache local mantido intacto: ${erro.message}`);
    return { sucesso: false, clientesSincronizados: 0, erro: erro.message };
  } finally {
    if (pool) {
      await pool.close().catch(() => {});
    }
  }
}

const executadoDiretamente = process.argv[1] === fileURLToPath(import.meta.url);

if (executadoDiretamente) {
  const resultado = await syncClientePadrao();
  process.exit(resultado.sucesso ? 0 : 1);
}
