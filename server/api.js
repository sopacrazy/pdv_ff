import express from 'express';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { getDb } from './db.js';
import { autenticar, encerrarSessao, paraUsuarioFrontend, autenticarMiddleware, exigirAdminMiddleware } from './auth.js';
import { montarPayloadVenda, enviarVendaProtheus } from './protheus-rest.js';

const PORTA = process.env.API_PORT ? Number(process.env.API_PORT) : 3001;

function paraProdutoFrontend(linha) {
  return {
    codigo: linha.codigo,
    descricao: linha.descricao,
    unidade: linha.unidade || 'UN',
    segundaUnidade: linha.segunda_unidade || null,
    fatorConversao: linha.fator_conversao ?? null,
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
    valorRecebido: linha.valor_recebido,
    troco: linha.troco,
  };
}

export function iniciarApi() {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (req, res) => {
    res.json({ ok: true });
  });

  // --- Autenticação ---

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
    res.json({ sucesso: true, token: resultado.token, usuario: resultado.usuario });
  });

  app.post('/api/auth/logout', autenticarMiddleware, (req, res) => {
    encerrarSessao(req.token);
    res.json({ sucesso: true });
  });

  app.get('/api/auth/me', autenticarMiddleware, (req, res) => {
    res.json({ usuario: req.usuario });
  });

  // --- Usuários (somente admin) ---

  app.get('/api/usuarios', autenticarMiddleware, exigirAdminMiddleware, (req, res) => {
    const db = getDb();
    const linhas = db.prepare('SELECT * FROM usuarios ORDER BY nome').all();
    res.json(linhas.map(paraUsuarioFrontend));
  });

  app.post('/api/usuarios', autenticarMiddleware, exigirAdminMiddleware, (req, res) => {
    const { nome, login, senha, papel, protheusCodigo, protheusNome, protheusVendFilial, protheusVendCodigo, protheusVendNome } =
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
    const existente = db.prepare('SELECT id FROM usuarios WHERE login = ?').get(login);
    if (existente) {
      res.status(409).json({ erro: 'Já existe um usuário com esse login.' });
      return;
    }

    const id = randomUUID();
    db.prepare(
      `INSERT INTO usuarios (id, nome, login, senha_hash, papel, ativo, criado_em, protheus_usr_codigo, protheus_usr_nome, protheus_vend_filial, protheus_vend_codigo, protheus_vend_nome)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      nome,
      login,
      bcrypt.hashSync(senha, 10),
      papel === 'ADMIN' ? 'ADMIN' : 'OPERADOR',
      new Date().toISOString(),
      protheusCodigo || null,
      protheusNome || null,
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

    const { nome, papel, ativo, senha, protheusCodigo, protheusNome, protheusVendFilial, protheusVendCodigo, protheusVendNome } =
      req.body || {};

    if (typeof ativo === 'boolean' && !ativo && usuario.id === req.usuario.id) {
      res.status(400).json({ erro: 'Você não pode desativar o próprio usuário.' });
      return;
    }

    if (senha && senha.length > 0 && senha.length < 6) {
      res.status(400).json({ erro: 'A senha precisa ter pelo menos 6 caracteres.' });
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

  app.get('/api/protheus/usuarios', autenticarMiddleware, exigirAdminMiddleware, (req, res) => {
    const db = getDb();
    const linhas = db.prepare('SELECT codigo, nome, email FROM protheus_usuarios ORDER BY nome').all();
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
    const linhas = db.prepare('SELECT codigo, nome FROM protheus_vendedores WHERE filial = ? ORDER BY nome').all(filial);
    res.json(linhas);
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
    res.json(linha ? { nome: linha.nome, cpf: linha.cpf_cnpj } : null);
  });

  app.get('/api/caixa', (req, res) => {
    const db = getDb();
    const linha = db.prepare('SELECT aberto, fundo_de_troco FROM caixa_estado WHERE id = 1').get();
    res.json({ aberto: !!linha.aberto, fundoDeTroco: linha.fundo_de_troco });
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
    const dias = [];
    for (let i = 6; i >= 0; i -= 1) {
      const data = new Date();
      data.setDate(data.getDate() - i);
      dias.push(dataLocalYYYYMMDD(data));
    }

    const db = getDb();
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

  app.post('/api/vendas', (req, res) => {
    const venda = req.body;

    if (!venda || !Array.isArray(venda.itens) || venda.itens.length === 0) {
      res.status(400).json({ erro: 'Venda inválida: sem itens.' });
      return;
    }

    const db = getDb();
    const agora = new Date();
    const id = randomUUID();

    const inserirVenda = db.prepare(`
      INSERT INTO vendas (id, numero_cupom, loja, caixa, operador, cliente_nome, cliente_cpf, subtotal, desconto, total, forma_pagamento, criado_em, data_local, valor_recebido, troco)
      VALUES (@id, @numero_cupom, @loja, @caixa, @operador, @cliente_nome, @cliente_cpf, @subtotal, @desconto, @total, @forma_pagamento, @criado_em, @data_local, @valor_recebido, @troco)
    `);

    const inserirItem = db.prepare(`
      INSERT INTO venda_itens (id, venda_id, codigo_produto, descricao, quantidade, valor_unitario, desconto, valor_total)
      VALUES (@id, @venda_id, @codigo_produto, @descricao, @quantidade, @valor_unitario, @desconto, @valor_total)
    `);

    const salvar = db.transaction(() => {
      inserirVenda.run({
        id,
        numero_cupom: venda.numeroCupom || '',
        loja: venda.loja || '',
        caixa: venda.caixa || '',
        operador: venda.operador || '',
        cliente_nome: venda.cliente?.nome || null,
        cliente_cpf: venda.cliente?.cpf || null,
        subtotal: venda.subtotal || 0,
        desconto: venda.desconto || 0,
        total: venda.total || 0,
        forma_pagamento: venda.formaPagamento || '',
        criado_em: agora.toISOString(),
        data_local: dataLocalYYYYMMDD(agora),
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
        });
      }
    });

    try {
      salvar();
      res.json({ sucesso: true, id });
    } catch (erro) {
      console.error(`[api] Falha ao salvar venda: ${erro.message}`);
      res.status(500).json({ erro: erro.message });
    }
  });

  app.put('/api/vendas/:id', (req, res) => {
    const venda = req.body;

    if (!venda || !Array.isArray(venda.itens) || venda.itens.length === 0) {
      res.status(400).json({ erro: 'Venda inválida: sem itens.' });
      return;
    }

    const db = getDb();
    const existente = db.prepare('SELECT id FROM vendas WHERE id = ?').get(req.params.id);
    if (!existente) {
      res.status(404).json({ erro: 'Venda não encontrada.' });
      return;
    }

    const agora = new Date().toISOString();

    const atualizarVenda = db.prepare(`
      UPDATE vendas SET
        cliente_nome = @cliente_nome,
        cliente_cpf = @cliente_cpf,
        subtotal = @subtotal,
        desconto = @desconto,
        total = @total,
        forma_pagamento = @forma_pagamento,
        valor_recebido = @valor_recebido,
        troco = @troco,
        editado_em = @editado_em
      WHERE id = @id
    `);

    const apagarItens = db.prepare('DELETE FROM venda_itens WHERE venda_id = ?');
    const inserirItem = db.prepare(`
      INSERT INTO venda_itens (id, venda_id, codigo_produto, descricao, quantidade, valor_unitario, desconto, valor_total)
      VALUES (@id, @venda_id, @codigo_produto, @descricao, @quantidade, @valor_unitario, @desconto, @valor_total)
    `);

    const salvar = db.transaction(() => {
      atualizarVenda.run({
        id: req.params.id,
        cliente_nome: venda.cliente?.nome || null,
        cliente_cpf: venda.cliente?.cpf || null,
        subtotal: venda.subtotal || 0,
        desconto: venda.desconto || 0,
        total: venda.total || 0,
        forma_pagamento: venda.formaPagamento || '',
        valor_recebido: venda.valorRecebido ?? null,
        troco: venda.troco ?? null,
        editado_em: agora,
      });

      apagarItens.run(req.params.id);

      for (const item of venda.itens) {
        inserirItem.run({
          id: randomUUID(),
          venda_id: req.params.id,
          codigo_produto: item.produto?.codigo || '',
          descricao: item.produto?.descricao || '',
          quantidade: item.quantidade,
          valor_unitario: item.valorUnitario,
          desconto: item.desconto,
          valor_total: item.valorTotal,
        });
      }
    });

    try {
      salvar();
      res.json({ sucesso: true, id: req.params.id });
    } catch (erro) {
      console.error(`[api] Falha ao atualizar venda: ${erro.message}`);
      res.status(500).json({ erro: erro.message });
    }
  });

  app.get('/api/vendas', (req, res) => {
    const data = String(req.query.data || dataLocalYYYYMMDD());
    const db = getDb();
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
      })),
    });
  });

  app.delete('/api/vendas/:id', (req, res) => {
    const db = getDb();
    const venda = db.prepare('SELECT id FROM vendas WHERE id = ?').get(req.params.id);
    if (!venda) {
      res.status(404).json({ erro: 'Venda não encontrada.' });
      return;
    }
    db.prepare("UPDATE vendas SET deletado = '*' WHERE id = ?").run(req.params.id);
    res.json({ sucesso: true });
  });

  // Envio manual (experimental) da venda pro Protheus via API REST — formato do corpo ainda
  // não confirmado pelo Protheus, ver comentário em protheus-rest.js.
  app.post('/api/vendas/:id/enviar-protheus', autenticarMiddleware, exigirAdminMiddleware, async (req, res) => {
    const db = getDb();
    const venda = db.prepare('SELECT * FROM vendas WHERE id = ?').get(req.params.id);
    if (!venda) {
      res.status(404).json({ erro: 'Venda não encontrada.' });
      return;
    }

    const itens = db.prepare('SELECT * FROM venda_itens WHERE venda_id = ?').all(req.params.id);
    const cliente = db.prepare('SELECT * FROM clientes ORDER BY atualizado_em DESC LIMIT 1').get();
    const vendedorUsuario = db.prepare('SELECT * FROM usuarios WHERE nome = ?').get(venda.operador);

    const payload = montarPayloadVenda({ venda, itens, cliente, vendedorUsuario });
    const resultado = await enviarVendaProtheus(payload);

    if (resultado.sucesso) {
      db.prepare("UPDATE vendas SET status_protheus = 'INTEGRADO' WHERE id = ?").run(req.params.id);
    }

    res.json(resultado);
  });

  app.listen(PORTA, () => {
    console.log(`[api] Servindo produtos em http://localhost:${PORTA}`);
  });
}
