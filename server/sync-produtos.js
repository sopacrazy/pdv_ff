import './env.js';
import sql from 'mssql';
import { fileURLToPath } from 'url';
import { getDb } from './db.js';
import { getMssqlConfig } from './mssql-config.js';

const QUERY = `
SELECT
    RTRIM(DA1.DA1_CODPRO)   AS codigo,
    RTRIM(DA1.DA1_DESPRO)   AS descricao,
    DA1.DA1_PRCVEN          AS preco_venda,
    DA1.DA1_PRC2UM          AS preco_kg,
    RTRIM(B1.B1_UM)         AS unidade,
    RTRIM(B1.B1_SEGUM)      AS segunda_unidade,
    B1.B1_CONV              AS fator_conversao
FROM DA1140 DA1
LEFT JOIN SB1140 B1
    ON B1.B1_COD = DA1.DA1_CODPRO
    AND B1.D_E_L_E_T_ = ''
WHERE DA1.DA1_FILIAL = '01'
    AND DA1.DA1_CODTAB = '015'
    AND DA1.D_E_L_E_T_ = ''
`;

export async function syncProdutos() {
  let pool;
  try {
    pool = await sql.connect(getMssqlConfig());
    const resultado = await pool.request().query(QUERY);
    const linhas = resultado.recordset;
    const agora = new Date().toISOString();

    const db = getDb();
    const upsert = db.prepare(`
      INSERT INTO produtos (codigo, descricao, codigo_barras, preco, preco_kg, unidade, segunda_unidade, fator_conversao, local_estoque, atualizado_em)
      VALUES (@codigo, @descricao, @codigo_barras, @preco, @preco_kg, @unidade, @segunda_unidade, @fator_conversao, @local_estoque, @atualizado_em)
      ON CONFLICT(codigo) DO UPDATE SET
        descricao = excluded.descricao,
        codigo_barras = excluded.codigo_barras,
        preco = excluded.preco,
        preco_kg = excluded.preco_kg,
        unidade = excluded.unidade,
        segunda_unidade = excluded.segunda_unidade,
        fator_conversao = excluded.fator_conversao,
        local_estoque = excluded.local_estoque,
        atualizado_em = excluded.atualizado_em
    `);

    const removerOrfaos = db.prepare('DELETE FROM produtos WHERE atualizado_em != ?');

    const aplicarLote = db.transaction((produtos) => {
      for (const produto of produtos) {
        upsert.run({
          codigo: produto.codigo,
          descricao: produto.descricao,
          codigo_barras: null,
          preco: produto.preco_venda,
          preco_kg: produto.preco_kg,
          unidade: produto.unidade,
          segunda_unidade: produto.segunda_unidade,
          fator_conversao: produto.fator_conversao,
          local_estoque: null,
          atualizado_em: agora,
        });
      }
      // Remove do cache produtos que não vieram nesta sincronização (saíram da tabela de preço no Protheus).
      // Só roda se a consulta trouxe resultado, pra nunca zerar o catálogo por causa de um retorno vazio.
      if (produtos.length === 0) return 0;
      return removerOrfaos.run(agora).changes;
    });

    const removidos = aplicarLote(linhas);

    console.log(
      `[sync-produtos] ${agora} — ${linhas.length} produto(s) sincronizado(s), ${removidos} órfão(s) removido(s).`
    );
    return { sucesso: true, produtosSincronizados: linhas.length, produtosRemovidos: removidos };
  } catch (erro) {
    console.error(`[sync-produtos] Falha na sincronização, cache local mantido intacto: ${erro.message}`);
    return { sucesso: false, produtosSincronizados: 0, erro: erro.message };
  } finally {
    if (pool) {
      await pool.close().catch(() => {});
    }
  }
}

const executadoDiretamente = process.argv[1] === fileURLToPath(import.meta.url);

if (executadoDiretamente) {
  const resultado = await syncProdutos();
  process.exit(resultado.sucesso ? 0 : 1);
}
