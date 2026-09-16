import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

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
  `);

  instancia.prepare('INSERT OR IGNORE INTO caixa_estado (id, aberto, fundo_de_troco) VALUES (1, 0, 0)').run();

  // Soft delete (padrão D_E_L_E_T_ do Protheus: '' = ativo, '*' = excluído) e status de integração.
  garantirColuna(instancia, 'vendas', 'deletado', "TEXT NOT NULL DEFAULT ''");
  garantirColuna(instancia, 'vendas', 'status_protheus', "TEXT NOT NULL DEFAULT 'LOCAL'");
  garantirColuna(instancia, 'vendas', 'valor_recebido', 'INTEGER');
  garantirColuna(instancia, 'vendas', 'troco', 'INTEGER');
  garantirColuna(instancia, 'produtos', 'segunda_unidade', 'TEXT');
  garantirColuna(instancia, 'produtos', 'fator_conversao', 'REAL');
  garantirColuna(instancia, 'vendas', 'editado_em', 'TEXT');

  return instancia;
}

export { DB_PATH };
