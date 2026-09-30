import { getDb } from './db.js';
import { prepararVenda4Sales, enviarVenda4Sales } from './protheus-4sales-vendas.js';
import { pareceFalhaDeRede, descreverErro } from './protheus-4sales-test.js';
import { validarContaRestPrincipal, credenciaisContaRestPrincipal } from './conta-rest-principal.js';

// Reenviar a mesma venda (mesmo idVendaPdv) pro Protheus é seguro — confirmado que não duplica
// bilhete quando já existe um pra aquele id. Isso permite reprocessar automaticamente também
// vendas que ficaram em CONFERIR/PREPARANDO (resultado incerto por timeout, processo derrubado no
// meio, etc.), não só as que nunca chegaram a tentar (LOCAL). Só retoma depois de parada tempo
// suficiente (RETRY_STATUS_INCERTO_MS) pra nunca brigar com uma tentativa genuinamente em andamento.
const RETRY_STATUS_INCERTO_MS = 200000;

// Núcleo do envio de uma venda ao Protheus — usado tanto pela rota HTTP (envio manual pelo botão
// em Consultas) quanto pelo processador de fila (retentativa automática em segundo plano). A
// reserva via UPDATE condicional garante que chamadas concorrentes (ex: um admin clicando "Enviar"
// bem no instante em que a fila também tenta) nunca enviem a mesma venda duas vezes ao mesmo tempo.
let envioEmCurso = Promise.resolve();
const agendados = new Map();

export function enviarVendaAoProtheus(db, vendaId, opcoes) {
  let vendas = agendados.get(db);
  if (!vendas) { vendas = new Set(); agendados.set(db, vendas); }
  if (vendas.has(vendaId)) return Promise.resolve({ sucesso: false, http: 409, erro: 'Envio já em andamento ou aguardando na fila.' });
  vendas.add(vendaId);
  const tarefa = envioEmCurso.then(() => enviarVendaSerializada(db, vendaId, opcoes));
  envioEmCurso = tarefa.catch(() => undefined);
  return tarefa.finally(() => { vendas.delete(vendaId); if (!vendas.size) agendados.delete(db); });
}

async function enviarVendaSerializada(db, vendaId, opcoes) {
  const venda = db.prepare("SELECT * FROM vendas WHERE id = ? AND deletado = ''").get(vendaId);
  if (!venda) return { sucesso: false, http: 404, erro: 'Venda não encontrada.' };
  if (venda.status_protheus === 'INTEGRADO') return { sucesso: false, http: 409, erro: 'Venda já integrada ao Protheus.' };

  const agora = new Date();
  const limiteRetentativa = new Date(agora.getTime() - RETRY_STATUS_INCERTO_MS).toISOString();
  const permitirRejeitado = Boolean(opcoes?.permitirRejeitado);
  const reservada = db.prepare(`
    UPDATE vendas SET status_protheus = 'PREPARANDO', protheus_atualizado_em = ?
    WHERE id = ? AND (
      status_protheus = 'LOCAL'
      OR (status_protheus IN ('CONFERIR', 'PREPARANDO') AND protheus_atualizado_em IS NOT NULL AND protheus_atualizado_em < ?)
      OR (status_protheus = 'REJEITADO' AND ? = 1)
    )
  `).run(agora.toISOString(), venda.id, limiteRetentativa, permitirRejeitado ? 1 : 0);
  if (!reservada.changes) return { sucesso: false, http: 409, erro: 'Envio já em andamento ou tentado recentemente demais — aguarde antes de reenviar.' };
  let preparado;
  let credenciaisProtheus;
  try {
    const itens = db.prepare('SELECT * FROM venda_itens WHERE venda_id = ?').all(venda.id);
    // Vendas novas guardam a chave estável do usuário autenticado. A busca por nome existe apenas
    // para vendas antigas, criadas antes da coluna usuario_id; nomes podem mudar ou se repetir.
    let vendedor = venda.vendedor_codigo && venda.vendedor_filial
      ? {}
      : venda.usuario_id ? db.prepare(`SELECT u.*, COALESCE(pu.id_protheus, pv.usuario_codigo) AS protheus_usr_id
          FROM usuarios u LEFT JOIN protheus_usuarios pu ON pu.codigo=u.protheus_usr_codigo
          LEFT JOIN protheus_vendedores pv ON pv.filial=u.protheus_vend_filial AND pv.codigo=u.protheus_vend_codigo
          WHERE u.id=?`).get(venda.usuario_id)
      : null;
    if (!vendedor) {
      const vendedoresLegados = db.prepare('SELECT * FROM usuarios WHERE nome = ?').all(venda.operador);
      if (vendedoresLegados.length !== 1) throw new Error('Operador da venda não identificado de forma única. Confira Usuários.');
      vendedor = vendedoresLegados[0];
    }
    // Snapshot da emissão. A autenticação técnica nunca define o vendedor comercial.
    vendedor = {
      ...vendedor,
      protheus_usr_id: venda.protheus_usr_id || vendedor.protheus_usr_id,
      protheus_vend_filial: venda.vendedor_filial || vendedor.protheus_vend_filial,
      protheus_vend_codigo: venda.vendedor_codigo || vendedor.protheus_vend_codigo,
      protheus_vend_nome: venda.vendedor_nome ?? vendedor.protheus_vend_nome,
    };
    if (!vendedor.protheus_vend_codigo || vendedor.protheus_vend_filial !== '01') throw new Error('Vendedor da venda sem vínculo válido na filial 01. Confira Usuários.');
    await validarContaRestPrincipal({ timeoutMs: opcoes?.timeoutMs });
    credenciaisProtheus = credenciaisContaRestPrincipal();
    // Uma venda que já chegou a ser preparada deve repetir exatamente o mesmo `_id`. Isso mantém
    // os UUIDs das tentativas anteriores e impede duplicidade durante a transição para o novo
    // identificador legível (cupom-caixa-usuário-data).
    let idIntegracaoAnterior = venda.id_integracao || null;
    if (venda.payload_protheus) {
      try {
        const anterior = JSON.parse(venda.payload_protheus)?.body;
        idIntegracaoAnterior = anterior?._id || idIntegracaoAnterior;
        if (anterior?.seller?.id) {
          vendedor.protheus_vend_codigo = anterior.seller.id;
          vendedor.protheus_vend_nome = anterior.seller.name || '';
        }
      } catch {
        // Payload legado inválido não impede uma venda que nunca chegou a ser enviada.
      }
    }
    preparado = await prepararVenda4Sales(
      { ...venda, id_integracao: idIntegracaoAnterior },
      itens,
      vendedor,
      opcoes
    );
  } catch (erro) {
    // Erro de negócio ou de rede: devolve pra fila ('LOCAL'). Se for falta de conexão, a fila
    // tenta de novo sozinha no próximo ciclo; se for erro de cadastro, fica pendente até alguém
    // corrigir o cadastro (a próxima tentativa automática também vai resolver, sem precisar reenviar à mão).
    // Grava o erro em resultado_protheus mesmo voltando pra LOCAL, só pra dar pra consultar depois
    // o motivo da última tentativa sem precisar do log do servidor (ex: pelo SQLite direto).
    const mensagemErro = descreverErro(erro);
    db.prepare("UPDATE vendas SET status_protheus = 'LOCAL', resultado_protheus = ?, protheus_atualizado_em = ? WHERE id = ? AND status_protheus = 'PREPARANDO'").run(
      JSON.stringify({ sucesso: false, erro: mensagemErro, semInternet: pareceFalhaDeRede(erro) }),
      new Date().toISOString(),
      venda.id
    );
    return { sucesso: false, http: 422, erro: mensagemErro, semInternet: pareceFalhaDeRede(erro) };
  }
  db.prepare("UPDATE vendas SET status_protheus = 'CONFERIR', id_integracao = ?, payload_protheus = ?, resultado_protheus = ?, protheus_atualizado_em = ? WHERE id = ?").run(
    preparado.body._id,
    JSON.stringify(preparado),
    JSON.stringify({ sucesso: false, erro: 'Envio iniciado. Aguarde; se interrompido, confira no Protheus.' }),
    new Date().toISOString(),
    venda.id
  );
  try {
    const resultado = await enviarVenda4Sales(preparado, { ...opcoes, credenciaisProtheus });
    db.prepare('UPDATE vendas SET status_protheus = ?, bilhete_protheus = ?, resultado_protheus = ?, protheus_atualizado_em = ? WHERE id = ?').run(
      resultado.sucesso ? 'INTEGRADO' : resultado.resultadoDesconhecido ? 'CONFERIR' : 'REJEITADO',
      resultado.bilhete,
      JSON.stringify(resultado),
      new Date().toISOString(),
      venda.id
    );
    return { ...resultado, http: 200 };
  } catch (erro) {
    return { sucesso: false, http: 500, erro: 'Resultado não confirmado. Consulte o Protheus antes de novo envio.' };
  }
}

// O Protheus real observado leva de ~12s a ~38s pra responder um bilhete (ver resultado_protheus
// de vendas já integradas). Um timeout de 20s desistia antes da resposta chegar, mesmo quando o
// bilhete tinha sido criado com sucesso do lado de lá — a venda ficava presa em "Conferir Protheus"
// exigindo confirmação manual à toa. A fila roda em segundo plano sem ninguém esperando na tela,
// então pode dar bastante folga por tentativa.
const TIMEOUT_FILA_MS = 60000;

// Esta fila é a garantia de entrega para PDV e Bilhete. As telas disparam o primeiro envio em
// segundo plano logo após salvar; se faltar rede, o app fechar ou o servidor reiniciar, a fila
// retoma o registro LOCAL usando o mesmo ID de integração, sem duplicar no Protheus.
const TEMPO_MINIMO_ANTES_DE_TENTAR_MS = 90000;

let processando = false;

// Varre as vendas pendentes e tenta reenviar cada uma. Cobre dois casos: 'LOCAL' (nunca chegou a
// tentar, ex: sem internet no momento de finalizar) e 'CONFERIR'/'PREPARANDO' paradas há tempo
// suficiente (resultado ficou incerto por timeout ou o processo caiu no meio — reenviar o mesmo id
// é seguro, então não precisa mais esperar confirmação manual pra esses casos). Chamado tanto na
// inicialização do servidor quanto periodicamente por cron.
// `db` é injetável pra testes (evita tocar no arquivo real do projeto); em produção usa getDb().
export async function processarFilaProtheus(origem = 'automático', db = getDb()) {
  if (processando) return { processadas: 0, ignorado: true };
  processando = true;
  try {
    const limiteRetentativa = Date.now() - RETRY_STATUS_INCERTO_MS;
    const pendentes = db
      .prepare(`
        SELECT id, criado_em, status_protheus, protheus_atualizado_em FROM vendas
        WHERE deletado = '' AND status_protheus IN ('LOCAL', 'CONFERIR', 'PREPARANDO')
        ORDER BY criado_em
      `)
      .all()
      .filter((venda) =>
        venda.status_protheus === 'LOCAL'
          ? Date.now() - new Date(venda.criado_em).getTime() > TEMPO_MINIMO_ANTES_DE_TENTAR_MS
          : !!venda.protheus_atualizado_em && new Date(venda.protheus_atualizado_em).getTime() < limiteRetentativa
      );
    if (!pendentes.length) return { processadas: 0, enviadas: 0, falhas: 0, emAndamento: 0 };

    console.log(`[fila-protheus] ${pendentes.length} venda(s) pendente(s) — tentando envio (${origem})...`);
    let enviadas = 0;
    let falhas = 0;
    let emAndamento = 0;
    let semInternet = false;
    for (const { id } of pendentes) {
      const resultado = await enviarVendaAoProtheus(db, id, { timeoutMs: TIMEOUT_FILA_MS });
      if (resultado.sucesso) {
        enviadas += 1;
      } else if (resultado.semInternet) {
        // Sem conexão agora: as próximas da lista também vão falhar por rede. Não insiste —
        // espera o próximo ciclo do cron pra tentar tudo de novo de uma vez. Loga a causa real
        // (timeout de conexão, DNS, etc.) pra dar pra diagnosticar sem precisar reproduzir na mão.
        console.warn(`[fila-protheus] Venda ${id} sem internet/Protheus inalcançável agora: ${resultado.erro}`);
        semInternet = true;
        break;
      } else if (resultado.http === 409) {
        // Não é falha de verdade: outra tentativa (envio direto do PDV, ou admin manual) já pegou
        // essa venda antes da fila conseguir. A reserva atômica garante que só uma vai pra frente.
        emAndamento += 1;
      } else {
        console.error(`[fila-protheus] Venda ${id} falhou (HTTP ${resultado.http}): ${resultado.erro}`);
        falhas += 1;
      }
    }
    console.log(
      `[fila-protheus] Ciclo concluído — ${enviadas} enviada(s), ${falhas} falha(s)${emAndamento ? `, ${emAndamento} já em andamento por outra tentativa` : ''}${semInternet ? ', sem internet (retenta no próximo ciclo)' : ''}.`
    );
    return { processadas: pendentes.length, enviadas, falhas, emAndamento, semInternet };
  } finally {
    processando = false;
  }
}
