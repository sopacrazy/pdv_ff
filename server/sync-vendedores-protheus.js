import './env.js';
import sql from 'mssql';
import { fileURLToPath } from 'url';
import { getDb } from './db.js';
import { getMssqlConfig } from './mssql-config.js';

const QUERY = `
SELECT
    RTRIM(A3_FILIAL) AS filial,
    RTRIM(A3_COD)    AS codigo,
    RTRIM(A3_NOME)   AS nome
FROM SA3140
WHERE D_E_L_E_T_ = ''
`;

export async function syncVendedoresProtheus() {
  let pool;
  try {
    pool = await sql.connect(getMssqlConfig());
    const resultado = await pool.request().query(QUERY);
    const linhas = resultado.recordset;
    const agora = new Date().toISOString();

    const db = getDb();
    const upsert = db.prepare(`
      INSERT INTO protheus_vendedores (filial, codigo, nome, atualizado_em)
      VALUES (@filial, @codigo, @nome, @atualizado_em)
      ON CONFLICT(filial, codigo) DO UPDATE SET
        nome = excluded.nome,
        atualizado_em = excluded.atualizado_em
    `);

    const removerOrfaos = db.prepare('DELETE FROM protheus_vendedores WHERE atualizado_em != ?');

    const aplicarLote = db.transaction((vendedores) => {
      for (const vendedor of vendedores) {
        upsert.run({
          filial: vendedor.filial,
          codigo: vendedor.codigo,
          nome: vendedor.nome,
          atualizado_em: agora,
        });
      }
      // Só remove órfãos se a consulta trouxe resultado, pra nunca zerar o cache por causa de um retorno vazio.
      if (vendedores.length === 0) return 0;
      return removerOrfaos.run(agora).changes;
    });

    const removidos = aplicarLote(linhas);

    console.log(
      `[sync-vendedores-protheus] ${agora} — ${linhas.length} vendedor(es) sincronizado(s), ${removidos} órfão(s) removido(s).`
    );
    return { sucesso: true, vendedoresSincronizados: linhas.length, vendedoresRemovidos: removidos };
  } catch (erro) {
    console.error(`[sync-vendedores-protheus] Falha na sincronização, cache local mantido intacto: ${erro.message}`);
    return { sucesso: false, vendedoresSincronizados: 0, erro: erro.message };
  } finally {
    if (pool) {
      await pool.close().catch(() => {});
    }
  }
}

const executadoDiretamente = process.argv[1] === fileURLToPath(import.meta.url);

if (executadoDiretamente) {
  const resultado = await syncVendedoresProtheus();
  process.exit(resultado.sucesso ? 0 : 1);
}
