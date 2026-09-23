import './env.js';
import sql from 'mssql';
import { fileURLToPath } from 'url';
import { getDb } from './db.js';
import { getMssqlConfig } from './mssql-config.js';

const QUERY = `
SELECT
    RTRIM(USR_CODIGO) AS codigo,
    RTRIM(USR_NOME)   AS nome,
    RTRIM(USR_EMAIL)  AS email
FROM SYS_USR
`;

export async function syncUsuariosProtheus() {
  let pool;
  try {
    pool = await sql.connect(getMssqlConfig());
    const resultado = await pool.request().query(QUERY);
    const linhas = resultado.recordset;
    const agora = new Date().toISOString();

    const db = getDb();
    const upsert = db.prepare(`
      INSERT INTO protheus_usuarios (codigo, nome, email, atualizado_em)
      VALUES (@codigo, @nome, @email, @atualizado_em)
      ON CONFLICT(codigo) DO UPDATE SET
        nome = excluded.nome,
        email = excluded.email,
        atualizado_em = excluded.atualizado_em
    `);

    const removerOrfaos = db.prepare('DELETE FROM protheus_usuarios WHERE atualizado_em != ?');

    const aplicarLote = db.transaction((usuarios) => {
      for (const usuario of usuarios) {
        upsert.run({
          codigo: usuario.codigo,
          nome: usuario.nome,
          email: usuario.email || null,
          atualizado_em: agora,
        });
      }
      // Só remove órfãos se a consulta trouxe resultado, pra nunca zerar o cache por causa de um retorno vazio.
      if (usuarios.length === 0) return 0;
      return removerOrfaos.run(agora).changes;
    });

    const removidos = aplicarLote(linhas);

    console.log(
      `[sync-usuarios-protheus] ${agora} — ${linhas.length} usuário(s) sincronizado(s), ${removidos} órfão(s) removido(s).`
    );
    return { sucesso: true, usuariosSincronizados: linhas.length, usuariosRemovidos: removidos };
  } catch (erro) {
    console.error(`[sync-usuarios-protheus] Falha na sincronização, cache local mantido intacto: ${erro.message}`);
    return { sucesso: false, usuariosSincronizados: 0, erro: erro.message };
  } finally {
    if (pool) {
      await pool.close().catch(() => {});
    }
  }
}

const executadoDiretamente = process.argv[1] === fileURLToPath(import.meta.url);

if (executadoDiretamente) {
  const resultado = await syncUsuariosProtheus();
  process.exit(resultado.sucesso ? 0 : 1);
}
