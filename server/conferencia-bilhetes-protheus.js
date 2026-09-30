import './env.js';
import sql from 'mssql';
import { getMssqlConfig } from './mssql-config.js';
import { getDb } from './db.js';

function contexto(venda) {
  let payload;
  try { payload = JSON.parse(venda.payload_protheus || 'null'); } catch { /* legado */ }
  const tenant = payload?.headers?.TenantId || '14,01';
  return { tenant, bilhete: String(venda.bilhete_protheus || '').trim(),
    integracao: String(payload?.body?._id || venda.id_integracao || '').trim() };
}

export function situacaoBilhete(venda, registros) {
  const { tenant, bilhete, integracao } = contexto(venda);
  if (tenant !== '14,01' || !integracao) return { situacao: 'DIVERGENTE' };
  const candidatos = registros.filter(r => String(r.filial).trim() === '01'
    && (!bilhete || String(r.bilhete).trim() === bilhete)
    && String(r.idIntegracao || '').trim() === integracao.slice(0, 30));
  if (candidatos.length !== 1) return { situacao: candidatos.length ? 'DIVERGENTE' : 'NAO_LOCALIZADO' };
  const registro = candidatos[0];
  if (registro.excluido == null) return { situacao: 'DIVERGENTE' };
  const marca = String(registro.excluido).trim();
  if (!String(registro.bilhete || '').trim() || !['', '*'].includes(marca)) return { situacao: 'DIVERGENTE' };
  return { situacao: marca === '*' ? 'EXCLUIDO' : 'ATIVO', bilhete: String(registro.bilhete).trim() };
}

// Inclui deliberadamente D_E_L_E_T_='*'. Nenhuma escrita é feita no Protheus.
export async function consultarSituacaoBilhetes(vendas) {
  if (!vendas.length) return [];
  const pool = new sql.ConnectionPool(getMssqlConfig());
  const registros = [];
  try {
    await pool.connect();
    for (let inicio = 0; inicio < vendas.length; inicio += 100) {
      const lote = vendas.slice(inicio, inicio + 100).map(contexto).filter(v => v.tenant === '14,01' && v.integracao);
      if (!lote.length) continue;
      const request = pool.request();
      const condicoes = lote.map((v, i) => {
        request.input(`id${i}`, sql.VarChar(30), v.integracao.slice(0, 30));
        if (v.bilhete) {
          request.input(`bilhete${i}`, sql.VarChar(10), v.bilhete);
          return `(Z4_BILHETE=@bilhete${i} AND Z4_XPED4SA=@id${i})`;
        }
        return `Z4_XPED4SA=@id${i}`;
      });
      const resultado = await request.query(`SELECT RTRIM(Z4_FILIAL) AS filial, RTRIM(Z4_BILHETE) AS bilhete,
        RTRIM(Z4_XPED4SA) AS idIntegracao, D_E_L_E_T_ AS excluido
        FROM SZ4140 WHERE Z4_FILIAL='01' AND (${condicoes.join(' OR ')})`);
      registros.push(...resultado.recordset);
    }
    return registros;
  } finally { await pool.close().catch(() => {}); }
}

export function registrarExclusao(db, venda, situacao, agora = new Date().toISOString(), statusReservado = venda.status_protheus) {
  return db.prepare(`UPDATE vendas SET status_protheus='EXCLUIDO_PROTHEUS',
    protheus_status_antes_exclusao=COALESCE(protheus_status_antes_exclusao,?),
    protheus_excluido_em=COALESCE(protheus_excluido_em,?), protheus_conferido_em=?, bilhete_protheus=?
    WHERE id=? AND status_protheus=? AND deletado='' AND COALESCE(id_integracao,'')=?`)
    .run(venda.status_protheus, agora, agora, situacao.bilhete, venda.id, statusReservado, venda.id_integracao || '').changes;
}

const emCurso = new WeakMap();
export function conferirBilhetesProtheus({ db = getDb(), consultar = consultarSituacaoBilhetes, agora = new Date().toISOString() } = {}) {
  if (emCurso.has(db)) return emCurso.get(db);
  const tarefa = (async () => {
    // Rodízio de todo o histórico: as vendas menos recentemente conferidas têm prioridade.
    const vendas = db.prepare(`SELECT * FROM vendas WHERE deletado='' AND status_protheus IN ('INTEGRADO','EXCLUIDO_PROTHEUS')
      AND COALESCE(bilhete_protheus,'')<>'' ORDER BY COALESCE(protheus_conferido_em,''), criado_em LIMIT 1000`).all();
    const registros = await consultar(vendas);
    const resumo = { conferidas: 0, excluidas: 0, restauradas: 0, naoLocalizadas: 0 };
    db.transaction(() => {
      for (const venda of vendas) {
        const situacao = situacaoBilhete(venda, registros);
        resumo.conferidas++;
        if (situacao.situacao === 'EXCLUIDO' && venda.status_protheus === 'INTEGRADO') {
          resumo.excluidas += registrarExclusao(db, venda, situacao, agora);
        } else if (situacao.situacao === 'ATIVO' && venda.status_protheus === 'EXCLUIDO_PROTHEUS') {
          const status = venda.protheus_status_antes_exclusao === 'INTEGRADO' ? 'INTEGRADO' : 'CONFERIR';
          resumo.restauradas += db.prepare(`UPDATE vendas SET status_protheus=?,protheus_conferido_em=?,
            protheus_excluido_em=NULL,protheus_status_antes_exclusao=NULL WHERE id=? AND status_protheus='EXCLUIDO_PROTHEUS'
            AND COALESCE(id_integracao,'')=? AND deletado=''`).run(status, agora, venda.id, venda.id_integracao || '').changes;
        } else {
          if (!['ATIVO', 'EXCLUIDO'].includes(situacao.situacao)) resumo.naoLocalizadas++;
          db.prepare(`UPDATE vendas SET protheus_conferido_em=? WHERE id=? AND status_protheus=?
            AND COALESCE(id_integracao,'')=?`).run(agora, venda.id, venda.status_protheus, venda.id_integracao || '');
        }
      }
    })();
    return resumo;
  })();
  emCurso.set(db, tarefa);
  return tarefa.finally(() => emCurso.delete(db));
}
