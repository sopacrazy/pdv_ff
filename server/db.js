import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';

const ADMIN_LOGIN_PADRAO = process.env.ADMIN_LOGIN || 'admin';
const ADMIN_SENHA_PADRAO = process.env.ADMIN_SENHA || 'admin123';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DB_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DB_DIR, 'pdv.db');

let instancia = null;

function garantirColuna(db, tabela, coluna, definicao) {
  const colunas = db.prepare(`PRAGMA table_info(${tabela})`).all();
  const existe = colunas.some((c) => c.name === coluna);
  if (!existe) {
    db.exec(`ALTER TABLE ${tabela} ADD COLUMN ${coluna} ${definicao}`);
  }
}

export function getDb() {
  if (instancia) return instancia;

  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  instancia = new Database(DB_PATH);
  instancia.pragma('journal_mode = WAL');

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
      nome TEXT,
      email TEXT,
      atualizado_em TEXT
    );

    CREATE TABLE IF NOT EXISTS protheus_vendedores (
      filial TEXT NOT NULL,
      codigo TEXT NOT NULL,
      nome TEXT,
      atualizado_em TEXT,
      PRIMARY KEY (filial, codigo)
    );
  `);

  instancia.prepare('INSERT OR IGNORE INTO caixa_estado (id, aberto, fundo_de_troco) VALUES (1, 0, 0)').run();

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
  garantirColuna(instancia, 'usuarios', 'protheus_vend_filial', 'TEXT');
  garantirColuna(instancia, 'usuarios', 'protheus_vend_codigo', 'TEXT');
  garantirColuna(instancia, 'usuarios', 'protheus_vend_nome', 'TEXT');

  garantirColuna(instancia, 'vendas', 'bilhete_protheus', 'TEXT');
  garantirColuna(instancia, 'vendas', 'resultado_protheus', 'TEXT');
  garantirColuna(instancia, 'vendas', 'payload_protheus', 'TEXT');
  garantirColuna(instancia, 'vendas', 'protheus_atualizado_em', 'TEXT');
  garantirColuna(instancia, 'clientes', 'cond_pagamento', 'TEXT');
  return instancia;
}

export { DB_PATH };
