import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { montarIdIntegracao } from './id-integracao.js';

const ADMIN_LOGIN_PADRAO = process.env.ADMIN_LOGIN || 'admin';
const ADMIN_SENHA_PADRAO = process.env.ADMIN_SENHA || 'admin123';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function resolverDiretorioBanco({
  diretorioConfigurado = process.env.PDV_DB_DIR,
  plataforma = process.platform,
  appData = process.env.APPDATA,
  diretorioServidor = __dirname,
} = {}) {
  if (diretorioConfigurado) return path.resolve(diretorioConfigurado);
  // Electron e localhost usam a mesma pasta persistente, fora da instalação e do projeto.
  // `react-example` é o app.getName() histórico e já identifica o banco usado em produção.
  if (plataforma === 'win32' && appData) return path.join(appData, 'react-example', 'data');
  return path.join(diretorioServidor, 'data');
}

const DB_DIR = resolverDiretorioBanco();
const DB_PATH = path.join(DB_DIR, 'pdv.db');

let instancia = null;

function garantirColuna(db, tabela, coluna, definicao) {
  const colunas = db.prepare(`PRAGMA table_info(${tabela})`).all();
  const existe = colunas.some((c) => c.name === coluna);
  if (!existe) {
    db.exec(`ALTER TABLE ${tabela} ADD COLUMN ${coluna} ${definicao}`);
  }
}

function aplicarMigracao(db, versao, descricao, executar) {
  if (db.prepare('SELECT 1 FROM schema_migrations WHERE versao = ?').get(versao)) return;
  const migrar = db.transaction(() => {
    executar();
    db.prepare('INSERT INTO schema_migrations (versao, descricao, aplicada_em) VALUES (?, ?, ?)').run(
      versao,
      descricao,
      new Date().toISOString()
    );
  });
  migrar();
  console.log(`[db] Migração ${versao} aplicada: ${descricao}`);
}

export function getDb() {
  if (instancia) return instancia;

  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  instancia = new Database(DB_PATH);
  instancia.pragma('journal_mode = WAL');
  console.log(`[db] Banco SQLite persistente: ${DB_PATH}`);

  instancia.exec(`
    CREATE TABLE IF NOT EXISTS produtos (
      codigo TEXT PRIMARY KEY,
      descricao TEXT,
      codigo_barras TEXT,
      preco REAL,
      preco_kg REAL,
      unidade TEXT,
      local_estoque TEXT,
      atualizado_em TEXT
    );

    CREATE TABLE IF NOT EXISTS clientes (
      codigo TEXT NOT NULL,
      loja TEXT NOT NULL,
      nome TEXT,
      cpf_cnpj TEXT,
      atualizado_em TEXT,
      PRIMARY KEY (codigo, loja)
    );

    CREATE TABLE IF NOT EXISTS vendas (
      id TEXT PRIMARY KEY,
      numero_cupom TEXT,
      loja TEXT,
      caixa TEXT,
      operador TEXT,
      cliente_nome TEXT,
      cliente_cpf TEXT,
      subtotal INTEGER,
      desconto INTEGER,
      total INTEGER,
      forma_pagamento TEXT,
      criado_em TEXT,
      data_local TEXT
    );

    CREATE TABLE IF NOT EXISTS venda_itens (
      id TEXT PRIMARY KEY,
      venda_id TEXT NOT NULL REFERENCES vendas(id),
      codigo_produto TEXT,
      descricao TEXT,
      quantidade REAL,
      valor_unitario INTEGER,
      desconto INTEGER,
      valor_total INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_vendas_criado_em ON vendas(criado_em);
    CREATE INDEX IF NOT EXISTS idx_vendas_data_local ON vendas(data_local);
    CREATE INDEX IF NOT EXISTS idx_venda_itens_venda_id ON venda_itens(venda_id);

    CREATE TABLE IF NOT EXISTS caixa_estado (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      aberto INTEGER NOT NULL DEFAULT 0,
      fundo_de_troco INTEGER NOT NULL DEFAULT 0,
      aberto_em TEXT
    );

    CREATE TABLE IF NOT EXISTS configuracao_sistema (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      filial TEXT NOT NULL DEFAULT '01',
      caixa TEXT NOT NULL DEFAULT '001',
      atualizado_em TEXT
    );

    CREATE TABLE IF NOT EXISTS usuarios (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      login TEXT NOT NULL UNIQUE,
      senha_hash TEXT NOT NULL,
      papel TEXT NOT NULL DEFAULT 'OPERADOR',
      ativo INTEGER NOT NULL DEFAULT 1,
      criado_em TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessoes (
      token TEXT PRIMARY KEY,
      usuario_id TEXT NOT NULL REFERENCES usuarios(id),
      criado_em TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS protheus_usuarios (
      codigo TEXT PRIMARY KEY,
      id_protheus TEXT,
      nome TEXT,
      email TEXT,
      atualizado_em TEXT
    );

    CREATE TABLE IF NOT EXISTS protheus_vendedores (
      filial TEXT NOT NULL,
      codigo TEXT NOT NULL,
      nome TEXT,
      usuario_codigo TEXT,
      atualizado_em TEXT,
      PRIMARY KEY (filial, codigo)
    );

    CREATE TABLE IF NOT EXISTS schema_migrations (
      versao INTEGER PRIMARY KEY,
      descricao TEXT NOT NULL,
      aplicada_em TEXT NOT NULL
    );
  `);

  instancia.prepare('INSERT OR IGNORE INTO caixa_estado (id, aberto, fundo_de_troco) VALUES (1, 0, 0)').run();
  instancia.prepare("INSERT OR IGNORE INTO configuracao_sistema (id, filial, caixa) VALUES (1, '01', '001')").run();

  // Cria o admin inicial se ainda não existir nenhum usuário.
  const totalUsuarios = instancia.prepare('SELECT COUNT(*) AS n FROM usuarios').get().n;
  if (totalUsuarios === 0) {
    instancia
      .prepare(
        'INSERT INTO usuarios (id, nome, login, senha_hash, papel, ativo, criado_em) VALUES (?, ?, ?, ?, ?, 1, ?)'
      )
      .run(
        randomUUID(),
        'Administrador',
        ADMIN_LOGIN_PADRAO,
        bcrypt.hashSync(ADMIN_SENHA_PADRAO, 10),
        'ADMIN',
        new Date().toISOString()
      );
    console.log(`[db] Usuário admin inicial criado — login: "${ADMIN_LOGIN_PADRAO}" senha: "${ADMIN_SENHA_PADRAO}" (troque depois de logar).`);
  }

  aplicarMigracao(instancia, 1, 'Estrutura acumulada do PDV até a versão 0.1.7', () => {
  // Soft delete (padrão D_E_L_E_T_ do Protheus: '' = ativo, '*' = excluído) e status de integração.
  garantirColuna(instancia, 'vendas', 'deletado', "TEXT NOT NULL DEFAULT ''");
  garantirColuna(instancia, 'vendas', 'status_protheus', "TEXT NOT NULL DEFAULT 'LOCAL'");
  garantirColuna(instancia, 'vendas', 'valor_recebido', 'INTEGER');
  garantirColuna(instancia, 'vendas', 'troco', 'INTEGER');
  garantirColuna(instancia, 'produtos', 'segunda_unidade', 'TEXT');
  garantirColuna(instancia, 'produtos', 'fator_conversao', 'REAL');
  garantirColuna(instancia, 'produtos', 'tipo_conversao', 'TEXT');
  garantirColuna(instancia, 'vendas', 'editado_em', 'TEXT');
  // Unidade do produto no momento da venda (ex: UN, KG) — guardada no item pra não depender do
  // cadastro atual do produto ao imprimir/consultar uma venda antiga (se a unidade mudar depois no
  // Protheus, o recibo de uma venda já feita continua mostrando a unidade certa daquele dia).
  garantirColuna(instancia, 'venda_itens', 'unidade', 'TEXT');
  garantirColuna(instancia, 'usuarios', 'protheus_usr_codigo', 'TEXT');
  garantirColuna(instancia, 'usuarios', 'protheus_usr_nome', 'TEXT');
  // Senha do login Protheus (REST) do operador, cifrada (ver credenciais-protheus.js) — usada na
  // chamada ao 4Sales pra o bilhete sair com o vendedor certo (RFATA03.PRW deriva Z4_VEND de quem
  // está autenticado na chamada, não do campo "seller" do JSON).
  garantirColuna(instancia, 'usuarios', 'protheus_usr_senha_cifrada', 'TEXT');
  garantirColuna(instancia, 'usuarios', 'protheus_vend_filial', 'TEXT');
  garantirColuna(instancia, 'usuarios', 'protheus_vend_codigo', 'TEXT');
  garantirColuna(instancia, 'usuarios', 'protheus_vend_nome', 'TEXT');
  // A venda precisa guardar o usuário autenticado que a criou. O nome é apenas um texto de
  // impressão e pode mudar ou se repetir; usuario_id é a chave estável usada pela fila REST.
  garantirColuna(instancia, 'vendas', 'usuario_id', 'TEXT');
  // Espelha SA3.A3_CODUSR. É exatamente o vínculo consultado pelo RFATA03 (índice 7 da SA3)
  // para transformar o usuário autenticado (__cUserID) no vendedor do bilhete.
  garantirColuna(instancia, 'protheus_vendedores', 'usuario_codigo', 'TEXT');
  // SYS_USR.USR_CODIGO é o login do Basic Auth; SA3.A3_CODUSR, porém, aponta para SYS_USR.USR_ID.
  // Os dois valores precisam estar no cache para validar o vínculo sem confundir login com ID.
  garantirColuna(instancia, 'protheus_usuarios', 'id_protheus', 'TEXT');

  garantirColuna(instancia, 'vendas', 'bilhete_protheus', 'TEXT');
  garantirColuna(instancia, 'vendas', 'resultado_protheus', 'TEXT');
  garantirColuna(instancia, 'vendas', 'payload_protheus', 'TEXT');
  garantirColuna(instancia, 'vendas', 'protheus_atualizado_em', 'TEXT');
  garantirColuna(instancia, 'clientes', 'cond_pagamento', 'TEXT');
  // Data de operação (YYYY-MM-DD): quando setada, novas vendas gravam essa data em data_local (o
  // "dia" que conta pro fechamento e é enviado ao Protheus) em vez da data real do relógio — usado
  // pela loja que opera de madrugada e adianta a data no Protheus antes da virada. NULL = automático
  // (usa a data real). Nunca afeta criado_em, que continua sendo o horário real da venda.
  garantirColuna(instancia, 'caixa_estado', 'data_operacao', 'TEXT');
  });

  aplicarMigracao(instancia, 2, 'Identificador legível e persistente da integração 4Sales', () => {
    garantirColuna(instancia, 'vendas', 'id_integracao', 'TEXT');
  });

  aplicarMigracao(instancia, 3, 'Identificação de bilhetes e cliente Protheus escolhido', () => {
    garantirColuna(instancia, 'vendas', 'tipo_operacao', "TEXT NOT NULL DEFAULT 'PDV'");
    garantirColuna(instancia, 'vendas', 'cliente_codigo', 'TEXT');
    garantirColuna(instancia, 'vendas', 'cliente_loja', 'TEXT');
    garantirColuna(instancia, 'vendas', 'tabela_preco', 'TEXT');
  });

  aplicarMigracao(instancia, 4, 'Separar rejeição confirmada de resultado incerto no Protheus', () => {
    // Versões anteriores classificavam toda resposta HTTP de erro como CONFERIR. Quando existe
    // status HTTP e corpo de resposta gravados, o Protheus respondeu e rejeitou; não é timeout.
    instancia.prepare(`
      UPDATE vendas SET status_protheus = 'REJEITADO'
      WHERE status_protheus = 'CONFERIR'
        AND resultado_protheus LIKE '%"httpOk":false%'
        AND resultado_protheus LIKE '%"status":%'
        AND resultado_protheus LIKE '%"resposta":%'
    `).run();
  });

  // Recupera o `_id` exato de vendas que já tiveram tentativa de envio antes da criação da coluna.
  // Para vendas nunca enviadas, monta o formato novo a partir dos dados locais já persistidos.
  const vendasSemIdIntegracao = instancia.prepare(`
    SELECT v.*, COALESCE(pu.id_protheus, pv.usuario_codigo) AS usuario_protheus_id
    FROM vendas v
    LEFT JOIN usuarios u ON u.id = v.usuario_id
    LEFT JOIN protheus_usuarios pu ON pu.codigo = u.protheus_usr_codigo
    LEFT JOIN protheus_vendedores pv
      ON pv.filial = u.protheus_vend_filial AND pv.codigo = u.protheus_vend_codigo
    WHERE v.id_integracao IS NULL OR v.id_integracao = ''
  `).all();
  const gravarIdIntegracao = instancia.prepare('UPDATE vendas SET id_integracao = ? WHERE id = ?');
  const migrarIdsIntegracao = instancia.transaction((vendas) => {
    for (const venda of vendas) {
      let idAnterior = null;
      if (venda.payload_protheus) {
        try {
          idAnterior = JSON.parse(venda.payload_protheus)?.body?._id || null;
        } catch {
          // Payload inválido: tenta reconstruir somente quando houver todos os dados necessários.
        }
      }
      try {
        const idIntegracao = montarIdIntegracao(
          { ...venda, id_integracao: idAnterior },
          venda.usuario_protheus_id
        );
        gravarIdIntegracao.run(idIntegracao, venda.id);
      } catch {
        // Venda legada incompleta permanece sem ID até que seus vínculos possam ser corrigidos.
      }
    }
  });
  migrarIdsIntegracao(vendasSemIdIntegracao);
  return instancia;
}

export { DB_PATH };
