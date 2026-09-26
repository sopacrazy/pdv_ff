import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import { resolverDiretorioBanco } from './db.js';

const CACHE_DIR = resolverDiretorioBanco();
export const PROTHEUS_CACHE_PATH = path.join(CACHE_DIR, 'protheus-cache.db');

let instancia = null;

function garantirColunaCache(db, tabela, coluna, definicao) {
  const existe = db.prepare(`PRAGMA table_info(${tabela})`).all().some((item) => item.name === coluna);
  if (!existe) db.exec(`ALTER TABLE ${tabela} ADD COLUMN ${coluna} ${definicao}`);
}

export function getProtheusCacheDb() {
  if (instancia) return instancia;
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  instancia = new Database(PROTHEUS_CACHE_PATH);
  instancia.pragma('journal_mode = WAL');
  instancia.exec(`
    CREATE TABLE IF NOT EXISTS cache_metadata (
      chave TEXT PRIMARY KEY,
      valor TEXT,
      atualizado_em TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS clientes (
      filial TEXT NOT NULL,
      codigo TEXT NOT NULL,
      loja TEXT NOT NULL,
      nome TEXT,
      fantasia TEXT,
      cpf_cnpj TEXT,
      condicao_pagamento TEXT,
      tabela_preco TEXT,
      risco TEXT,
      limite_credito REAL,
      status TEXT,
      excluido INTEGER NOT NULL DEFAULT 0,
      dados_json TEXT,
      atualizado_em TEXT NOT NULL,
      PRIMARY KEY (filial, codigo, loja)
    );
    CREATE INDEX IF NOT EXISTS idx_cache_clientes_nome ON clientes(nome);
    CREATE INDEX IF NOT EXISTS idx_cache_clientes_fantasia ON clientes(fantasia);
    CREATE INDEX IF NOT EXISTS idx_cache_clientes_cpf ON clientes(cpf_cnpj);

    CREATE TABLE IF NOT EXISTS situacoes_financeiras (
      filial TEXT NOT NULL,
      codigo TEXT NOT NULL,
      loja TEXT NOT NULL,
      vencimento_mais_antigo TEXT,
      excluido INTEGER NOT NULL DEFAULT 0,
      atualizado_em TEXT NOT NULL,
      PRIMARY KEY (filial, codigo, loja)
    );

    CREATE TABLE IF NOT EXISTS situacoes_credito (
      filial TEXT NOT NULL,
      codigo TEXT NOT NULL,
      loja TEXT NOT NULL,
      saldo_credito REAL,
      inadimplencia REAL,
      atualizado_em TEXT NOT NULL,
      PRIMARY KEY (filial, codigo, loja)
    );
    CREATE INDEX IF NOT EXISTS idx_cache_credito_atualizado ON situacoes_credito(atualizado_em);

    CREATE TABLE IF NOT EXISTS condicoes_pagamento (
      filial TEXT NOT NULL,
      codigo TEXT NOT NULL,
      descricao TEXT,
      status TEXT,
      excluido INTEGER NOT NULL DEFAULT 0,
      atualizado_em TEXT NOT NULL,
      PRIMARY KEY (filial, codigo)
    );

    CREATE TABLE IF NOT EXISTS tabelas_preco (
      filial TEXT NOT NULL,
      codigo TEXT NOT NULL,
      descricao TEXT,
      inicio TEXT,
      fim TEXT,
      status TEXT,
      excluido INTEGER NOT NULL DEFAULT 0,
      atualizado_em TEXT NOT NULL,
      PRIMARY KEY (filial, codigo)
    );

    CREATE TABLE IF NOT EXISTS precos (
      tabela TEXT NOT NULL,
      produto TEXT NOT NULL,
      preco REAL,
      ativo INTEGER NOT NULL DEFAULT 1,
      validade TEXT,
      atualizado_em TEXT NOT NULL,
      PRIMARY KEY (tabela, produto)
    );
    CREATE INDEX IF NOT EXISTS idx_cache_precos_produto ON precos(produto);

    CREATE TABLE IF NOT EXISTS produtos_bilhete (
      codigo TEXT PRIMARY KEY,
      descricao TEXT,
      tipo TEXT,
      status TEXT,
      ativo TEXT,
      armazem_padrao TEXT,
      unidade TEXT,
      excluido INTEGER NOT NULL DEFAULT 0,
      atualizado_em TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_cache_produtos_bilhete_descricao ON produtos_bilhete(descricao);
  `);
  // Migração incremental: versões novas complementam o cache existente sem apagar produtos.
  garantirColunaCache(instancia, 'produtos_bilhete', 'codigo_barras', 'TEXT');
  garantirColunaCache(instancia, 'produtos_bilhete', 'segunda_unidade', 'TEXT');
  garantirColunaCache(instancia, 'produtos_bilhete', 'fator_conversao', 'REAL');
  garantirColunaCache(instancia, 'produtos_bilhete', 'tipo_conversao', 'TEXT');
  garantirColunaCache(instancia, 'produtos_bilhete', 'saldo_estoque', 'REAL');
  garantirColunaCache(instancia, 'produtos_bilhete', 'estoque_reservado', 'REAL');
  garantirColunaCache(instancia, 'produtos_bilhete', 'estoque_atualizado_em', 'TEXT');
  console.log(`[protheus-cache] Banco separado: ${PROTHEUS_CACHE_PATH}`);
  return instancia;
}

export function fecharProtheusCacheDbParaTeste() {
  instancia?.close();
  instancia = null;
}
