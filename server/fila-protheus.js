import { getDb } from './db.js';
import { prepararVenda4Sales, enviarVenda4Sales } from './protheus-4sales-vendas.js';
import { pareceFalhaDeRede } from './protheus-4sales-test.js';

// Núcleo do envio de uma venda ao Protheus — usado tanto pela rota HTTP (envio manual/automático
// disparado pelo PDV ao finalizar a venda) quanto pelo processador de fila (retentativa em segundo
// plano). A reserva via UPDATE condicional (status_protheus = 'LOCAL' -> 'PREPARANDO') garante que
// chamadas concorrentes (ex: o PDV chamando na hora e a fila tentando no mesmo instante) nunca
// enviem a mesma venda duas vezes.
export async function enviarVendaAoProtheus(db, vendaId, opcoes) {
  const venda = db.prepare("SELECT * FROM vendas WHERE id = ? AND deletado = ''").get(vendaId);
  if (!venda) return { sucesso: false, http: 404, erro: 'Venda não encontrada.' };
  if (venda.status_protheus !== 'LOCAL') return { sucesso: false, http: 409, erro: 'Venda já enviada ou em conferência. Consulte o retorno registrado.' };
  const reservada = db.prepare("UPDATE vendas SET status_protheus = 'PREPARANDO', protheus_atualizado_em = ? WHERE id = ? AND status_protheus = 'LOCAL'").run(new Date().toISOString(), venda.id);
  if (!reservada.changes) return { sucesso: false, http: 409, erro: 'Envio já em andamento.' };
  let preparado;
  try {
    const itens = db.prepare('SELECT * FROM venda_itens WHERE venda_id = ?').all(venda.id);
    const vendedores = db.prepare('SELECT * FROM usuarios WHERE nome = ?').all(venda.operador);
    if (vendedores.length !== 1) throw new Error('Operador não identificado de forma única. Confira Usuários.');
    preparado = await prepararVenda4Sales(venda, itens, vendedores[0], opcoes);
  } catch (erro) {
    // Erro de negócio ou de rede: devolve pra fila ('LOCAL'). Se for falta de conexão, a fila
    // tenta de novo sozinha no próximo ciclo; se for erro de cadastro, fica pendente até alguém
    // corrigir o cadastro (a próxima tentativa automática também vai resolver, sem precisar reenviar à mão).
    db.prepare("UPDATE vendas SET status_protheus = 'LOCAL', protheus_atualizado_em = ? WHERE id = ? AND status_protheus = 'PREPARANDO'").run(new Date().toISOString(), venda.id);
    return { sucesso: false, http: 422, erro: erro.message, semInternet: pareceFalhaDeRede(erro) };
  }
  db.prepare("UPDATE vendas SET status_protheus = 'CONFERIR', payload_protheus = ?, resultado_protheus = ?, protheus_atualizado_em = ? WHERE id = ?").run(
    JSON.stringify(preparado),
    JSON.stringify({ sucesso: false, erro: 'Envio iniciado. Aguarde; se interrompido, confira no Protheus.' }),
    new Date().toISOString(),
    venda.id
  );
  try {
    const resultado = await enviarVenda4Sales(preparado, opcoes);
    db.prepare('UPDATE vendas SET status_protheus = ?, bilhete_protheus = ?, resultado_protheus = ?, protheus_atualizado_em = ? WHERE id = ?').run(
      resultado.sucesso ? 'INTEGRADO' : 'CONFERIR',
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

// Timeout curto pra fila não travar um ciclo inteiro numa única venda quando a conexão está ruim
// (a mesma venda tenta de novo no próximo ciclo do cron).
const TIMEOUT_FILA_MS = 20000;

// O PDV já dispara o envio sozinho ao finalizar (timeout de até 60s, ver server/api.js) — a fila
// só entra em ação pra vendas que esse envio direto não pegou (sem internet no momento, aba
// fechada, etc). Ignorar vendas criadas há menos tempo que isso evita a fila e o envio direto do
// PDV disputarem a mesma venda ao mesmo tempo (gerava "falha" só por perder a corrida — inofensivo
// graças à reserva atômica, mas sujava o log). 90s dá folga sobre o timeout de 60s do PDV.
const TEMPO_MINIMO_ANTES_DE_TENTAR_MS = 90000;

let processando = false;

// Varre as vendas ainda 'LOCAL' (nunca enviadas, ou devolvidas à fila após falha) e tenta reenviar
// cada uma. Chamado tanto na inicialização do servidor quanto periodicamente por cron — cobre o
// caso de a venda ter sido finalizada sem internet: ela fica 'LOCAL' e este processo entrega assim
// que a conexão com o Protheus voltar, sem precisar de ação manual.
// `db` é injetável pra testes (evita tocar no arquivo real do projeto); em produção usa getDb().
export async function processarFilaProtheus(origem = 'automático', db = getDb()) {
  if (processando) return { processadas: 0, ignorado: true };
  processando = true;
  try {
    const pendentes = db
      .prepare("SELECT id, criado_em FROM vendas WHERE deletado = '' AND status_protheus = 'LOCAL' ORDER BY criado_em")
      .all()
      .filter((venda) => Date.now() - new Date(venda.criado_em).getTime() > TEMPO_MINIMO_ANTES_DE_TENTAR_MS);
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
        // espera o próximo ciclo do cron pra tentar tudo de novo de uma vez.
        semInternet = true;
        break;
      } else if (resultado.http === 409) {
        // Não é falha de verdade: outra tentativa (envio direto do PDV, ou admin manual) já pegou
        // essa venda antes da fila conseguir. A reserva atômica garante que só uma vai pra frente.
        emAndamento += 1;
      } else {
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
