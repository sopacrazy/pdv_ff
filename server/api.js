import express from 'express';
import { randomUUID } from 'crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { getDb } from './db.js';
import { autenticar, encerrarSessao, paraUsuarioFrontend, autenticarMiddleware, exigirAdminMiddleware } from './auth.js';
import { enviarVendaAoProtheus } from './fila-protheus.js';
import { prepararTeste4Sales, enviarTeste4Sales, URL_TESTE_4SALES, pareceFalhaDeRede } from './protheus-4sales-test.js';
import { cifrarSenhaProtheus, decifrarSenhaProtheus } from './credenciais-protheus.js';
import { consultarVendedorDoUsuario } from './protheus-usuario.js';
import { montarIdIntegracao } from './id-integracao.js';

const PORTA = process.env.API_PORT ? Number(process.env.API_PORT) : 3001;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// No app empacotado (Electron) e em qualquer execução standalone do servidor, o build do front
// (Vite) fica em dist/ ao lado de server/. Em dev, o Vite roda seu próprio servidor (porta 3000)
// e faz proxy de /api pra cá — normalmente não há dist/ nesse momento, então isso fica inativo.
const DIST_DIR = path.join(__dirname, '..', 'dist');

function paraProdutoFrontend(linha) {
  return {
    codigo: linha.codigo,
    descricao: linha.descricao,
    unidade: linha.unidade || 'UN',
    segundaUnidade: linha.segunda_unidade || null,
    fatorConversao: linha.fator_conversao ?? null,
    tipoConversao: linha.tipo_conversao || null,
    preco: linha.preco,
    codigoBarras: linha.codigo_barras || '',
    grupo: '',
  };
}

function dataLocalYYYYMMDD(data = new Date()) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function paraVendaResumo(linha) {
  return {
    id: linha.id,
    numeroCupom: linha.numero_cupom,
    loja: linha.loja,
    caixa: linha.caixa,
    operador: linha.operador,
    clienteNome: linha.cliente_nome,
    clienteCpf: linha.cliente_cpf,
    subtotal: linha.subtotal,
    desconto: linha.desconto,
    total: linha.total,
    formaPagamento: linha.forma_pagamento,
    criadoEm: linha.criado_em,
    editadoEm: linha.editado_em,
    statusProtheus: linha.status_protheus,
    protheusAtualizadoEm: linha.protheus_atualizado_em,
    bilheteProtheus: linha.bilhete_protheus,
    resultadoProtheus: linha.resultado_protheus ? JSON.parse(linha.resultado_protheus) : null,
    valorRecebido: linha.valor_recebido,
    troco: linha.troco,
  };
}

function buscarConfiguracaoSistema(db) {
  const linha = db.prepare('SELECT filial, caixa, atualizado_em FROM configuracao_sistema WHERE id = 1').get();
  return {
    filial: linha?.filial || '01',
    caixa: linha?.caixa || '001',
    atualizadoEm: linha?.atualizado_em || null,
  };
}

function validarVinculoProtheus(db, { protheusCodigo, protheusVendFilial, protheusVendCodigo }) {
  const codigo = String(protheusCodigo || '').trim();
  const filial = String(protheusVendFilial || '').trim();
  const vendedor = String(protheusVendCodigo || '').trim();
  const temAlgumDado = !!(codigo || filial || vendedor);
  if (!temAlgumDado) return null;
  if (!codigo || !filial || !vendedor) {
    return 'Para enviar vendas, selecione o usuário Protheus, a filial e o vendedor vinculado a ele.';
  }
  const usuarioProtheus = db.prepare('SELECT id_protheus FROM protheus_usuarios WHERE codigo = ?').get(codigo);
  if (!usuarioProtheus) {
    return 'Usuário Protheus não encontrado no cache. Sincronize os cadastros e selecione-o novamente.';
  }
  if (!usuarioProtheus.id_protheus) return 'O cache do usuário Protheus não possui USR_ID. Sincronize os cadastros novamente.';
  const vinculo = db
    .prepare('SELECT usuario_codigo FROM protheus_vendedores WHERE filial = ? AND codigo = ?')
    .get(filial, vendedor);
  if (!vinculo) return 'Vendedor não encontrado nessa filial do Protheus.';
  if (!vinculo.usuario_codigo) {
    return 'Esse vendedor não possui A3_CODUSR preenchido no Protheus. Faça o vínculo no SA3 e sincronize novamente.';
  }
  if (vinculo.usuario_codigo !== usuarioProtheus.id_protheus) {
    return 'O vendedor escolhido não está vinculado a esse usuário no Protheus (SA3.A3_CODUSR).';
  }
  return null;
}

export function iniciarApi() {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (req, res) => {
    res.json({ ok: true });
  });

  // /api/health só confirma que o servidor local do PDV está de pé — continua "online" mesmo com
  // a internet do prédio caída, porque o PDV é local-first e não depende da rede pra vender.
  // Este endpoint testa a internet de verdade, tentando alcançar o host do Protheus; qualquer
  // resposta HTTP (mesmo erro/401) conta como "online" — só falha de rede/timeout conta como offline.
  app.get('/api/protheus/conexao', async (req, res) => {
    try {
      await fetch(URL_TESTE_4SALES, { method: 'HEAD', signal: AbortSignal.timeout(4000) });
      res.json({ online: true });
    } catch (erro) {
      res.json({ online: !pareceFalhaDeRede(erro) });
    }
  });

  // --- Autenticação ---

  // Teste isolado do contrato recebido do fornecedor; nunca altera status de vendas locais.
  const carregarTeste = () => JSON.parse(fs.readFileSync(new URL('./data/4sales-teste.json', import.meta.url), 'utf8'));
  const bancoTeste = () => {
    const db = getDb();
    db.exec(`CREATE TABLE IF NOT EXISTS testes_4sales (
      chave TEXT PRIMARY KEY, iniciado_em TEXT NOT NULL, resultado TEXT
    )`);
    return db;
  };
  app.get('/api/protheus/4sales-teste', autenticarMiddleware, exigirAdminMiddleware, (req, res) => {
    try {
      const documento = carregarTeste();
      const preparado = prepararTeste4Sales(documento);
      const chave = `${preparado.resumo.tenant}:${preparado.resumo.id}`;
      const anterior = bancoTeste().prepare('SELECT iniciado_em, resultado FROM testes_4sales WHERE chave = ?').get(chave);
      res.json({ documento, resumo: preparado.resumo, url: URL_TESTE_4SALES, enviado: !!anterior,
        resultado: anterior?.resultado ? JSON.parse(anterior.resultado) : null });
    } catch (erro) { res.status(422).json({ erro: erro.code === 'ENOENT' ? 'Arquivo de teste não carregado no servidor.' : erro.message }); }
  });
  app.post('/api/protheus/4sales-teste', autenticarMiddleware, exigirAdminMiddleware, async (req, res) => {
    let preparado, db, chave;
    try {
      const documento = carregarTeste();
      // A prévia aprovada na tela deve corresponder exatamente ao arquivo atual.
      if (JSON.stringify(req.body.documento) !== JSON.stringify(documento)) throw new Error('O arquivo mudou. Recarregue a prévia antes de enviar.');
      preparado = prepararTeste4Sales(documento);
      if (!process.env.PROTHEUS_REST_USER || !process.env.PROTHEUS_REST_PASSWORD) throw new Error('Credenciais REST não configuradas.');
      db = bancoTeste();
      chave = `${preparado.resumo.tenant}:${preparado.resumo.id}`;
      const gravado = db.prepare('INSERT OR IGNORE INTO testes_4sales (chave, iniciado_em) VALUES (?, ?)').run(chave, new Date().toISOString());
      if (!gravado.changes) {
        res.status(409).json({ erro: 'Este pedido já teve uma tentativa. Confira o resultado e o Protheus antes de repetir.' });
        return;
      }
    } catch (erro) { res.status(422).json({ erro: erro.message }); return; }
    try {
      const resultado = await enviarTeste4Sales(preparado);
      db.prepare('UPDATE testes_4sales SET resultado = ? WHERE chave = ?').run(JSON.stringify(resultado), chave);
      res.json(resultado);
    } catch (erro) {
      res.status(500).json({ erro: erro.message, resultadoDesconhecido: true });
    }
  });

  app.post('/api/auth/login', (req, res) => {
    const { login, senha } = req.body || {};
    if (!login || !senha) {
      res.status(400).json({ erro: 'Informe login e senha.' });
      return;
    }
    const resultado = autenticar(login, senha);
    if (!resultado) {
      res.status(401).json({ erro: 'Login ou senha inválidos.' });
      return;
    }
    res.json({
      sucesso: true,
      token: resultado.token,
      usuario: resultado.usuario,
      configuracao: buscarConfiguracaoSistema(getDb()),
    });
  });

  app.post('/api/auth/logout', autenticarMiddleware, (req, res) => {
    encerrarSessao(req.token);
    res.json({ sucesso: true });
  });

  app.get('/api/auth/me', autenticarMiddleware, (req, res) => {
    res.json({ usuario: req.usuario, configuracao: buscarConfiguracaoSistema(getDb()) });
  });

  // --- Configuração desta instalação (somente admin) ---

  app.get('/api/configuracoes', autenticarMiddleware, exigirAdminMiddleware, (req, res) => {
    res.json(buscarConfiguracaoSistema(getDb()));
  });

  app.put('/api/configuracoes', autenticarMiddleware, exigirAdminMiddleware, (req, res) => {
    const filial = String(req.body?.filial || '').trim();
    const caixa = String(req.body?.caixa || '').trim();
    const caixasPermitidos = ['001', '002', '003', '004'];

    if (filial !== '01') {
      return res.status(422).json({ erro: 'Somente a filial 01 — Belém está habilitada nesta versão.' });
    }
    if (!caixasPermitidos.includes(caixa)) {
      return res.status(422).json({ erro: 'Selecione um caixa válido entre 001 e 004.' });
    }

    const db = getDb();
    db.prepare('UPDATE configuracao_sistema SET filial = ?, caixa = ?, atualizado_em = ? WHERE id = 1').run(
      filial,
      caixa,
      new Date().toISOString()
    );
    res.json({ sucesso: true, configuracao: buscarConfiguracaoSistema(db) });
  });

  // --- Usuários (somente admin) ---

  app.get('/api/usuarios', autenticarMiddleware, exigirAdminMiddleware, (req, res) => {
    const db = getDb();
    const linhas = db.prepare('SELECT * FROM usuarios ORDER BY nome').all();
    res.json(linhas.map(paraUsuarioFrontend));
  });

  app.post('/api/usuarios', autenticarMiddleware, exigirAdminMiddleware, (req, res) => {
    const { nome, login, senha, papel, protheusCodigo, protheusNome, protheusSenha, protheusVendFilial, protheusVendCodigo, protheusVendNome } =
      req.body || {};
    if (!nome || !login || !senha) {
      res.status(400).json({ erro: 'Nome, login e senha são obrigatórios.' });
      return;
    }
    if (senha.length < 6) {
      res.status(400).json({ erro: 'A senha precisa ter pelo menos 6 caracteres.' });
      return;
    }

    const db = getDb();
    const erroVinculo = validarVinculoProtheus(db, {
      protheusCodigo,
      protheusVendFilial,
      protheusVendCodigo,
    });
    if (erroVinculo) {
      res.status(422).json({ erro: erroVinculo });
      return;
    }
    const existente = db.prepare('SELECT id FROM usuarios WHERE login = ?').get(login);
    if (existente) {
      res.status(409).json({ erro: 'Já existe um usuário com esse login.' });
      return;
    }

    const id = randomUUID();
    db.prepare(
      `INSERT INTO usuarios (id, nome, login, senha_hash, papel, ativo, criado_em, protheus_usr_codigo, protheus_usr_nome, protheus_usr_senha_cifrada, protheus_vend_filial, protheus_vend_codigo, protheus_vend_nome)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      nome,
      login,
      bcrypt.hashSync(senha, 10),
      papel === 'ADMIN' ? 'ADMIN' : 'OPERADOR',
      new Date().toISOString(),
      protheusCodigo || null,
      protheusNome || null,
      protheusSenha ? cifrarSenhaProtheus(protheusSenha) : null,
      protheusVendFilial || null,
      protheusVendCodigo || null,
      protheusVendNome || null
    );

    const criado = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(id);
    res.json(paraUsuarioFrontend(criado));
  });

  app.put('/api/usuarios/:id', autenticarMiddleware, exigirAdminMiddleware, (req, res) => {
    const db = getDb();
    const usuario = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.params.id);
    if (!usuario) {
      res.status(404).json({ erro: 'Usuário não encontrado.' });
      return;
    }

    const { nome, papel, ativo, senha, protheusCodigo, protheusNome, protheusSenha, protheusVendFilial, protheusVendCodigo, protheusVendNome } =
      req.body || {};

    if (typeof ativo === 'boolean' && !ativo && usuario.id === req.usuario.id) {
      res.status(400).json({ erro: 'Você não pode desativar o próprio usuário.' });
      return;
    }

    if (senha && senha.length > 0 && senha.length < 6) {
      res.status(400).json({ erro: 'A senha precisa ter pelo menos 6 caracteres.' });
      return;
    }

    const protheusCodigoFinal = protheusCodigo !== undefined ? protheusCodigo || null : usuario.protheus_usr_codigo;
    const filialFinal = protheusVendFilial !== undefined ? protheusVendFilial || null : usuario.protheus_vend_filial;
    const vendedorFinal = protheusVendCodigo !== undefined ? protheusVendCodigo || null : usuario.protheus_vend_codigo;
    const manteveMesmoUsuarioProtheus = protheusCodigoFinal === usuario.protheus_usr_codigo;
    const senhaProtheusFinal = protheusSenha !== undefined
      ? (protheusSenha ? cifrarSenhaProtheus(protheusSenha) : null)
      : manteveMesmoUsuarioProtheus
        ? usuario.protheus_usr_senha_cifrada
        : null;
    const alterouVinculo = [protheusCodigo, protheusNome, protheusSenha, protheusVendFilial, protheusVendCodigo, protheusVendNome]
      .some((valor) => valor !== undefined);
    const erroVinculo = alterouVinculo ? validarVinculoProtheus(db, {
      protheusCodigo: protheusCodigoFinal,
      protheusVendFilial: filialFinal,
      protheusVendCodigo: vendedorFinal,
    }) : null;
    if (erroVinculo) {
      res.status(422).json({ erro: erroVinculo });
      return;
    }

    db.prepare(
      `UPDATE usuarios SET
        nome = ?,
        papel = ?,
        ativo = ?,
        senha_hash = ?,
        protheus_usr_codigo = ?,
        protheus_usr_nome = ?,
        protheus_usr_senha_cifrada = ?,
        protheus_vend_filial = ?,
        protheus_vend_codigo = ?,
        protheus_vend_nome = ?
      WHERE id = ?`
    ).run(
      nome || usuario.nome,
      papel === 'ADMIN' ? 'ADMIN' : papel === 'OPERADOR' ? 'OPERADOR' : usuario.papel,
      typeof ativo === 'boolean' ? (ativo ? 1 : 0) : usuario.ativo,
      senha ? bcrypt.hashSync(senha, 10) : usuario.senha_hash,
      protheusCodigo !== undefined ? protheusCodigo || null : usuario.protheus_usr_codigo,
      protheusNome !== undefined ? protheusNome || null : usuario.protheus_usr_nome,
      senhaProtheusFinal,
      protheusVendFilial !== undefined ? protheusVendFilial || null : usuario.protheus_vend_filial,
      protheusVendCodigo !== undefined ? protheusVendCodigo || null : usuario.protheus_vend_codigo,
      protheusVendNome !== undefined ? protheusVendNome || null : usuario.protheus_vend_nome,
      req.params.id
    );

    if (typeof ativo === 'boolean' && !ativo) {
      db.prepare('DELETE FROM sessoes WHERE usuario_id = ?').run(req.params.id);
    }

    const atualizado = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.params.id);
    res.json(paraUsuarioFrontend(atualizado));
  });

  app.delete('/api/usuarios/:id', autenticarMiddleware, exigirAdminMiddleware, (req, res) => {
    const db = getDb();
    const usuario = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.params.id);
    if (!usuario) {
      res.status(404).json({ erro: 'Usuário não encontrado.' });
      return;
    }

    if (usuario.id === req.usuario.id) {
      res.status(400).json({ erro: 'Você não pode excluir o próprio usuário.' });
      return;
    }

    const quantidadeVendas = db.prepare(`
      SELECT COUNT(*) AS total
      FROM vendas
      WHERE usuario_id = ?
         OR ((usuario_id IS NULL OR usuario_id = '') AND operador = ?)
    `).get(usuario.id, usuario.nome).total;
    if (quantidadeVendas > 0) {
      res.status(409).json({
        erro: `Este usuário possui ${quantidadeVendas} venda(s). Desative-o para preservar o histórico.`,
      });
      return;
    }

    if (usuario.papel === 'ADMIN' && Boolean(usuario.ativo)) {
      const administradoresAtivos = db.prepare("SELECT COUNT(*) AS total FROM usuarios WHERE papel = 'ADMIN' AND ativo = 1").get().total;
      if (administradoresAtivos <= 1) {
        res.status(409).json({ erro: 'Não é possível excluir o último administrador ativo.' });
        return;
      }
    }

    const excluirUsuario = db.transaction(() => {
      db.prepare('DELETE FROM sessoes WHERE usuario_id = ?').run(usuario.id);
      db.prepare('DELETE FROM usuarios WHERE id = ?').run(usuario.id);
    });
    excluirUsuario();

    res.json({ sucesso: true });
  });

  app.get('/api/protheus/usuarios', autenticarMiddleware, exigirAdminMiddleware, (req, res) => {
    const db = getDb();
    const linhas = db.prepare('SELECT codigo, id_protheus AS idProtheus, nome, email FROM protheus_usuarios ORDER BY nome').all();
    res.json(linhas);
  });

  app.get('/api/protheus/filiais', autenticarMiddleware, exigirAdminMiddleware, (req, res) => {
    const db = getDb();
    const linhas = db.prepare('SELECT DISTINCT filial FROM protheus_vendedores ORDER BY filial').all();
    res.json(linhas.map((linha) => linha.filial));
  });

  app.get('/api/protheus/vendedores', autenticarMiddleware, exigirAdminMiddleware, (req, res) => {
    const filial = String(req.query.filial || '').trim();
    if (!filial) {
      res.status(400).json({ erro: 'Informe a filial.' });
      return;
    }
    const db = getDb();
    const usuarioCodigo = String(req.query.usuarioCodigo || '').trim();
    const linhas = usuarioCodigo
      ? db.prepare(`
          SELECT pv.codigo, pv.nome, pv.usuario_codigo AS usuarioCodigo
          FROM protheus_vendedores pv
          JOIN protheus_usuarios pu ON pu.id_protheus = pv.usuario_codigo
          WHERE pv.filial = ? AND pu.codigo = ?
          ORDER BY pv.nome
        `).all(filial, usuarioCodigo)
      : db.prepare('SELECT codigo, nome, usuario_codigo AS usuarioCodigo FROM protheus_vendedores WHERE filial = ? ORDER BY nome').all(filial);
    res.json(linhas);
  });

  // --- Minha conta ---

  app.post('/api/minha-conta/senha', autenticarMiddleware, (req, res) => {
    const senhaAtual = String(req.body?.senhaAtual || '');
    const novaSenha = String(req.body?.novaSenha || '');
    if (novaSenha.length < 6) {
      return res.status(400).json({ erro: 'A nova senha precisa ter pelo menos 6 caracteres.' });
    }

    const db = getDb();
    const usuario = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.usuario.id);
    if (!usuario || !bcrypt.compareSync(senhaAtual, usuario.senha_hash)) {
      return res.status(422).json({ erro: 'A senha atual do PDV está incorreta.' });
    }
    if (bcrypt.compareSync(novaSenha, usuario.senha_hash)) {
      return res.status(422).json({ erro: 'A nova senha deve ser diferente da senha atual.' });
    }

    db.prepare('UPDATE usuarios SET senha_hash = ? WHERE id = ?').run(bcrypt.hashSync(novaSenha, 10), usuario.id);
    // Mantém a sessão usada na troca e encerra eventuais sessões antigas abertas em outros locais.
    db.prepare('DELETE FROM sessoes WHERE usuario_id = ? AND token <> ?').run(usuario.id, req.token);
    res.json({ sucesso: true });
  });

  app.post('/api/minha-conta/protheus', autenticarMiddleware, async (req, res) => {
    const protheusSenha = String(req.body?.protheusSenha || '');
    if (!protheusSenha) return res.status(400).json({ erro: 'Informe sua senha do Protheus.' });

    const db = getDb();
    const usuario = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.usuario.id);
    if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });
    if (!usuario.protheus_usr_codigo || !usuario.protheus_vend_filial || !usuario.protheus_vend_codigo) {
      return res.status(422).json({ erro: 'O administrador ainda não vinculou seu usuário e vendedor do Protheus.' });
    }

    try {
      const vendedor = await consultarVendedorDoUsuario({
        usuario: usuario.protheus_usr_codigo,
        senha: protheusSenha,
        filial: usuario.protheus_vend_filial,
      });
      if (vendedor.codigo !== usuario.protheus_vend_codigo || vendedor.filial !== usuario.protheus_vend_filial) {
        return res.status(422).json({
          erro: `O Protheus vinculou esta conta ao vendedor ${vendedor.codigo} — ${vendedor.nome}, diferente do vendedor cadastrado no PDV. Procure o administrador.`,
        });
      }

      db.prepare(
        'UPDATE usuarios SET protheus_usr_senha_cifrada = ?, protheus_vend_nome = ? WHERE id = ?'
      ).run(cifrarSenhaProtheus(protheusSenha), vendedor.nome || usuario.protheus_vend_nome, usuario.id);
      const atualizado = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(usuario.id);
      res.json({ sucesso: true, usuario: paraUsuarioFrontend(atualizado) });
    } catch (erro) {
      res.status(422).json({
        erro: erro instanceof Error ? erro.message : 'Não foi possível validar sua conta no Protheus.',
      });
    }
  });

  // Confirma o vínculo usando a fonte oficial do próprio REST. No cadastro novo recebe a senha
  // digitada; na edição pode reutilizar a credencial cifrada já salva sem devolvê-la ao navegador.
  app.post('/api/protheus/vendedor-do-usuario', autenticarMiddleware, exigirAdminMiddleware, async (req, res) => {
    try {
      const db = getDb();
      const usuarioPdvId = String(req.body?.usuarioPdvId || '').trim();
      const usuarioSalvo = usuarioPdvId ? db.prepare('SELECT * FROM usuarios WHERE id = ?').get(usuarioPdvId) : null;
      if (usuarioPdvId && !usuarioSalvo) return res.status(404).json({ erro: 'Usuário do PDV não encontrado.' });

      const usuario = String(req.body?.protheusCodigo || usuarioSalvo?.protheus_usr_codigo || '').trim();
      const senhaInformada = typeof req.body?.protheusSenha === 'string' ? req.body.protheusSenha : '';
      const podeUsarSenhaSalva = usuarioSalvo && usuario === usuarioSalvo.protheus_usr_codigo;
      const senha = senhaInformada || (podeUsarSenhaSalva && usuarioSalvo.protheus_usr_senha_cifrada
        ? decifrarSenhaProtheus(usuarioSalvo.protheus_usr_senha_cifrada)
        : '');
      if (!usuario || !senha) return res.status(400).json({ erro: 'Selecione o usuário Protheus e informe a senha REST.' });

      const vendedor = await consultarVendedorDoUsuario({ usuario, senha, filial: '01' });
      res.json({ sucesso: true, vendedor });
    } catch (erro) {
      res.status(422).json({ erro: erro instanceof Error ? erro.message : 'Não foi possível consultar o vínculo no Protheus.' });
    }
  });

  app.get('/api/sync/status', (req, res) => {
    const db = getDb();
    const linha = db
      .prepare(
        `SELECT MAX(atualizado_em) AS ultima FROM (
           SELECT atualizado_em FROM produtos
           UNION ALL
           SELECT atualizado_em FROM clientes
         )`
      )
      .get();
    res.json({ ultimaSincronizacao: linha.ultima || null });
  });

  app.get('/api/produtos/busca', (req, res) => {
    const codigo = String(req.query.codigo || '').trim();
    if (!codigo) {
      res.json(null);
      return;
    }
    const db = getDb();
    const linha = db
      .prepare('SELECT * FROM produtos WHERE codigo = ? OR codigo_barras = ?')
      .get(codigo, codigo);
    res.json(linha ? paraProdutoFrontend(linha) : null);
  });

  app.get('/api/produtos/buscar', (req, res) => {
    const termo = String(req.query.q || '').trim();
    if (termo.length < 2) {
      res.json([]);
      return;
    }
    const db = getDb();
    const linhas = db
      .prepare('SELECT * FROM produtos WHERE descricao LIKE ? OR codigo LIKE ? ORDER BY descricao LIMIT 50')
      .all(`%${termo}%`, `%${termo}%`);
    res.json(linhas.map(paraProdutoFrontend));
  });

  app.get('/api/cliente-padrao', (req, res) => {
    const db = getDb();
    const linha = db.prepare('SELECT * FROM clientes ORDER BY atualizado_em DESC LIMIT 1').get();
    res.json(linha ? { nome: linha.nome, cpf: linha.cpf_cnpj, condicaoPagamento: linha.cond_pagamento || null } : null);
  });

  app.get('/api/caixa', (req, res) => {
    const db = getDb();
    const linha = db.prepare('SELECT aberto, fundo_de_troco, data_operacao FROM caixa_estado WHERE id = 1').get();
    res.json({ aberto: !!linha.aberto, fundoDeTroco: linha.fundo_de_troco, dataOperacao: linha.data_operacao || null });
  });

  // Data de operação: loja que funciona de madrugada adianta a data no Protheus antes da virada
  // (ex: 22h do dia 24 já vira dia 25 lá) — as vendas feitas aqui a partir daí precisam contar pro
  // fechamento do dia 25, não do 24 real. Qualquer operador logado pode ajustar (é operacional,
  // preciso todo turno de madrugada); null volta a usar a data real automaticamente.
  app.post('/api/caixa/data-operacao', (req, res) => {
    const { data } = req.body || {};
    if (data !== null && !/^\d{4}-\d{2}-\d{2}$/.test(data || '')) {
      return res.status(400).json({ sucesso: false, erro: 'Data inválida. Use o formato AAAA-MM-DD ou null.' });
    }
    const db = getDb();
    db.prepare('UPDATE caixa_estado SET data_operacao = ? WHERE id = 1').run(data);
    res.json({ sucesso: true });
  });

  app.post('/api/caixa/abrir', (req, res) => {
    const fundoDeTroco = Number(req.body?.fundoDeTroco) || 0;
    const db = getDb();
    db.prepare('UPDATE caixa_estado SET aberto = 1, fundo_de_troco = ?, aberto_em = ? WHERE id = 1').run(
      fundoDeTroco,
      new Date().toISOString()
    );
    res.json({ sucesso: true });
  });

  app.post('/api/caixa/fechar', (req, res) => {
    const db = getDb();
    db.prepare('UPDATE caixa_estado SET aberto = 0, fundo_de_troco = 0, aberto_em = NULL WHERE id = 1').run();
    res.json({ sucesso: true });
  });

  app.get('/api/vendas/proximo-cupom', (req, res) => {
    const db = getDb();
    const linha = db.prepare('SELECT MAX(CAST(numero_cupom AS INTEGER)) AS max FROM vendas').get();
    const proximo = (linha.max || 0) + 1;
    res.json({ proximoCupom: String(proximo).padStart(6, '0') });
  });

  // Totais por dia dos últimos 7 dias (inclui os dias sem venda, pro gráfico não ter buracos).
  app.get('/api/vendas/resumo-semana', (req, res) => {
    const db = getDb();
    // Ancora a janela de 7 dias na data de operação (se adiantada) em vez do calendário real, senão
    // o dia corrente sumiria do gráfico até o relógio real alcançar a data adiantada.
    const dataOperacao = db.prepare('SELECT data_operacao FROM caixa_estado WHERE id = 1').get()?.data_operacao;
    const hoje = dataOperacao ? new Date(`${dataOperacao}T12:00:00`) : new Date();
    const dias = [];
    for (let i = 6; i >= 0; i -= 1) {
      const data = new Date(hoje);
      data.setDate(data.getDate() - i);
      dias.push(dataLocalYYYYMMDD(data));
    }

    const linhas = db
      .prepare(
        `SELECT data_local AS data, COUNT(*) AS quantidade, SUM(total) AS total
         FROM vendas
         WHERE deletado = '' AND data_local >= ?
         GROUP BY data_local`
      )
      .all(dias[0]);

    const porData = new Map(linhas.map((linha) => [linha.data, linha]));
    res.json(
      dias.map((data) => ({
        data,
        quantidade: porData.get(data)?.quantidade || 0,
        total: porData.get(data)?.total || 0,
      }))
    );
  });

  app.post('/api/vendas', autenticarMiddleware, (req, res) => {
    if (!req.usuario.prontoParaVender) {
      return res.status(403).json({
        erro: 'Sua conta ainda não está pronta para vender. Acesse Minha conta e valide sua senha do Protheus.',
      });
    }
    const venda = req.body;

    if (!venda || !Array.isArray(venda.itens) || venda.itens.length === 0) {
      res.status(400).json({ erro: 'Venda inválida: sem itens.' });
      return;
    }
    const itemSemPreco = venda.itens.find((item) => !item.valorUnitario || item.valorUnitario <= 0);
    if (itemSemPreco) {
      res.status(400).json({ erro: `Produto sem preço: ${itemSemPreco.produto?.descricao || itemSemPreco.produto?.codigo || 'item da venda'}.` });
      return;
    }

    const db = getDb();
    const agora = new Date();
    const id = randomUUID();
    // Se a loja adiantou a "data de operação" (funcionamento de madrugada, ver /api/caixa/data-operacao),
    // usa ela pro fechamento/Protheus — criado_em abaixo continua com o horário real da venda.
    const dataOperacao = db.prepare('SELECT data_operacao FROM caixa_estado WHERE id = 1').get()?.data_operacao;
    const dataLocal = dataOperacao || dataLocalYYYYMMDD(agora);

    const inserirVenda = db.prepare(`
      INSERT INTO vendas (id, id_integracao, numero_cupom, loja, caixa, operador, usuario_id, cliente_nome, cliente_cpf, subtotal, desconto, total, forma_pagamento, criado_em, data_local, valor_recebido, troco)
      VALUES (@id, @id_integracao, @numero_cupom, @loja, @caixa, @operador, @usuario_id, @cliente_nome, @cliente_cpf, @subtotal, @desconto, @total, @forma_pagamento, @criado_em, @data_local, @valor_recebido, @troco)
    `);

    const inserirItem = db.prepare(`
      INSERT INTO venda_itens (id, venda_id, codigo_produto, descricao, quantidade, valor_unitario, desconto, valor_total, unidade)
      VALUES (@id, @venda_id, @codigo_produto, @descricao, @quantidade, @valor_unitario, @desconto, @valor_total, @unidade)
    `);

    // O número do cupom é decidido aqui, dentro da transação — nunca confiar no que o cliente
    // mandou. Se a tela ficasse sem internet/backend por um instante (ex: reinício do servidor) e
    // caísse num valor de fallback desatualizado, aceitar o número do cliente gravaria cupons
    // fora de sequência (já aconteceu). Calculado e gravado atomicamente: nenhuma outra transação
    // roda no meio, então não corre risco de dois caixas pegarem o mesmo número.
    const usuarioProtheus = db.prepare(`
      SELECT COALESCE(pu.id_protheus, pv.usuario_codigo) AS id_protheus
      FROM usuarios u
      LEFT JOIN protheus_usuarios pu ON pu.codigo = u.protheus_usr_codigo
      LEFT JOIN protheus_vendedores pv
        ON pv.filial = u.protheus_vend_filial AND pv.codigo = u.protheus_vend_codigo
      WHERE u.id = ?
    `).get(req.usuario.id);
    let numeroCupom;
    let idIntegracao;
    const salvar = db.transaction(() => {
      const max = db.prepare('SELECT MAX(CAST(numero_cupom AS INTEGER)) AS max FROM vendas').get().max || 0;
      numeroCupom = String(max + 1).padStart(6, '0');
      idIntegracao = montarIdIntegracao(
        { numero_cupom: numeroCupom, caixa: venda.caixa, data_local: dataLocal },
        usuarioProtheus?.id_protheus
      );
      inserirVenda.run({
        id,
        id_integracao: idIntegracao,
        numero_cupom: numeroCupom,
        loja: venda.loja || '',
        caixa: venda.caixa || '',
        operador: req.usuario.nome,
        usuario_id: req.usuario.id,
        cliente_nome: venda.cliente?.nome || null,
        cliente_cpf: venda.cliente?.cpf || null,
        subtotal: venda.subtotal || 0,
        desconto: venda.desconto || 0,
        total: venda.total || 0,
        forma_pagamento: venda.formaPagamento || '',
        criado_em: agora.toISOString(),
        data_local: dataLocal,
        valor_recebido: venda.valorRecebido ?? null,
        troco: venda.troco ?? null,
      });

      for (const item of venda.itens) {
        inserirItem.run({
          id: randomUUID(),
          venda_id: id,
          codigo_produto: item.produto?.codigo || '',
          descricao: item.produto?.descricao || '',
          quantidade: item.quantidade,
          valor_unitario: item.valorUnitario,
          desconto: item.desconto,
          valor_total: item.valorTotal,
          unidade: item.produto?.unidade || null,
        });
      }
    });

    try {
      salvar();
      res.json({ sucesso: true, id, idIntegracao, numeroCupom });
    } catch (erro) {
      console.error(`[api] Falha ao salvar venda: ${erro.message}`);
      res.status(500).json({ erro: erro.message });
    }
  });

  app.get('/api/vendas', (req, res) => {
    const db = getDb();
    // Sem data explícita na query, mostra o dia "de operação" atual — se a loja adiantou a data
    // (funcionamento de madrugada), é nele que as vendas recentes estão, não necessariamente na
    // data real do calendário.
    const dataOperacao = db.prepare('SELECT data_operacao FROM caixa_estado WHERE id = 1').get()?.data_operacao;
    const data = String(req.query.data || dataOperacao || dataLocalYYYYMMDD());
    const linhas = db
      .prepare("SELECT * FROM vendas WHERE data_local = ? AND deletado = '' ORDER BY criado_em DESC")
      .all(data);
    res.json(linhas.map(paraVendaResumo));
  });

  app.get('/api/vendas/:id', (req, res) => {
    const db = getDb();
    const venda = db.prepare('SELECT * FROM vendas WHERE id = ?').get(req.params.id);
    if (!venda) {
      res.status(404).json({ erro: 'Venda não encontrada.' });
      return;
    }
    const itens = db.prepare('SELECT * FROM venda_itens WHERE venda_id = ?').all(req.params.id);
    res.json({
      ...paraVendaResumo(venda),
      itens: itens.map((item) => ({
        codigo: item.codigo_produto,
        descricao: item.descricao,
        quantidade: item.quantidade,
        valorUnitario: item.valor_unitario,
        desconto: item.desconto,
        valorTotal: item.valor_total,
        unidade: item.unidade,
      })),
    });
  });

  app.delete('/api/vendas/:id', (req, res) => {
    const db = getDb();
    const venda = db.prepare('SELECT * FROM vendas WHERE id = ?').get(req.params.id);
    if (venda && venda.status_protheus !== 'LOCAL') return res.status(409).json({ erro: 'Venda enviada ou em conferência não pode ser excluída.' });
    if (!venda) {
      res.status(404).json({ erro: 'Venda não encontrada.' });
      return;
    }
    db.prepare("UPDATE vendas SET deletado = '*' WHERE id = ?").run(req.params.id);
    res.json({ sucesso: true });
  });

  // Reserva persistente: uma venda que falha (rede ou negócio) volta pra 'LOCAL' e fica na fila —
  // o processarFilaProtheus (server.js, em segundo plano) retenta sozinho até conseguir.
  // Qualquer usuário autenticado (operador de caixa ou admin) pode disparar o envio manualmente —
  // o PDV também chama isso automaticamente ao finalizar a venda, não é mais uma ação exclusiva de admin.
  app.post('/api/vendas/:id/enviar-protheus', autenticarMiddleware, async (req, res) => {
    const db = getDb();
    // Modo "rápido": usado pelo PDV ao finalizar a venda. O disparo em si não trava o caixa (o
    // front chama sem esperar a resposta), mas um timeout curto aqui ainda é ruim: a venda fica em
    // CONFERIR (resultado desconhecido) até alguém checar o Protheus na mão — por segurança contra
    // bilhete duplicado, isso nunca é reenviado sozinho (ver protheus-source/TESTE-4SALES-PDV.md).
    // Já aconteceu de a Protheus levar mais de 60s pra responder mesmo tendo processado certinho —
    // sem motivo pra esse prazo ser mais curto que o do envio manual, já que não trava ninguém.
    const rapido = req.query.rapido === '1';
    const opcoes = rapido ? { timeoutMs: 150000 } : undefined;
    const { http, ...corpo } = await enviarVendaAoProtheus(db, req.params.id, opcoes);
    res.status(http).json(corpo);
  });

  // Não existe consulta automática pra confirmar se um envio "CONFERIR" (resultado desconhecido,
  // ex: timeout) realmente chegou no Protheus — quem confirma isso olhando o ERP é o admin.
  // Exige o número do bilhete como prova de que a conferência manual foi feita de verdade.
  app.post('/api/vendas/:id/marcar-integrado', autenticarMiddleware, exigirAdminMiddleware, (req, res) => {
    const db = getDb();
    const venda = db.prepare("SELECT * FROM vendas WHERE id = ? AND deletado = ''").get(req.params.id);
    if (!venda) return res.status(404).json({ sucesso: false, erro: 'Venda não encontrada.' });
    if (venda.status_protheus === 'LOCAL') return res.status(409).json({ sucesso: false, erro: 'Esta venda ainda não foi enviada ao Protheus.' });
    if (venda.status_protheus === 'INTEGRADO') return res.status(409).json({ sucesso: false, erro: 'Esta venda já está marcada como integrada.' });
    const bilhete = typeof req.body?.bilhete === 'string' ? req.body.bilhete.trim() : '';
    if (!bilhete) return res.status(400).json({ sucesso: false, erro: 'Informe o número do bilhete confirmado no Protheus.' });
    db.prepare("UPDATE vendas SET status_protheus = 'INTEGRADO', bilhete_protheus = ? WHERE id = ?").run(bilhete, venda.id);
    res.json({ sucesso: true });
  });

  // Serve o build do front (Vite) quando ele existir — caso do app empacotado no Electron, onde
  // não há um servidor de dev separado. Fica depois de todas as rotas /api pra nunca competir com
  // elas, e só é ativado se dist/index.html existir (em dev, sem build, isso simplesmente não roda).
  const indexHtml = path.join(DIST_DIR, 'index.html');
  if (fs.existsSync(indexHtml)) {
    app.use(express.static(DIST_DIR));
    app.get('*', (req, res) => {
      res.sendFile(indexHtml);
    });
  }

  return new Promise((resolve, reject) => {
    const servidor = app.listen(PORTA, () => {
      console.log(`[api] Servindo produtos em http://localhost:${PORTA}`);
      resolve(servidor);
    });
    // Sem isso, um erro aqui (ex: EADDRINUSE — porta já em uso por outra instância) nunca resolve
    // nem rejeita essa Promise: o Node trata como "Unhandled 'error' event" e derruba o processo
    // com uma stacktrace crua, em vez de deixar quem chamou iniciarApi() tratar o erro.
    servidor.on('error', reject);
  });
}
