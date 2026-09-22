import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { getDb } from './db.js';

export function paraUsuarioFrontend(linha) {
  return {
    id: linha.id,
    nome: linha.nome,
    login: linha.login,
    papel: linha.papel,
    ativo: !!linha.ativo,
    criadoEm: linha.criado_em,
    protheusCodigo: linha.protheus_usr_codigo || null,
    protheusNome: linha.protheus_usr_nome || null,
    protheusVendFilial: linha.protheus_vend_filial || null,
    protheusVendCodigo: linha.protheus_vend_codigo || null,
    protheusVendNome: linha.protheus_vend_nome || null,
  };
}

export function autenticar(loginTentado, senha) {
  const db = getDb();
  const usuario = db.prepare('SELECT * FROM usuarios WHERE login = ?').get(loginTentado);

  if (!usuario || !usuario.ativo || !bcrypt.compareSync(senha, usuario.senha_hash)) {
    return null;
  }

  const token = randomUUID();
  db.prepare('INSERT INTO sessoes (token, usuario_id, criado_em) VALUES (?, ?, ?)').run(
    token,
    usuario.id,
    new Date().toISOString()
  );

  return { token, usuario: paraUsuarioFrontend(usuario) };
}

export function usuarioDoToken(token) {
  if (!token) return null;
  const db = getDb();
  const sessao = db.prepare('SELECT usuario_id FROM sessoes WHERE token = ?').get(token);
  if (!sessao) return null;

  const usuario = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(sessao.usuario_id);
  if (!usuario || !usuario.ativo) return null;

  return paraUsuarioFrontend(usuario);
}

export function encerrarSessao(token) {
  getDb().prepare('DELETE FROM sessoes WHERE token = ?').run(token);
}

// --- Middlewares Express ---

export function autenticarMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const usuario = usuarioDoToken(token);

  if (!usuario) {
    res.status(401).json({ erro: 'Sessão inválida ou expirada.' });
    return;
  }

  req.usuario = usuario;
  req.token = token;
  next();
}

export function exigirAdminMiddleware(req, res, next) {
  if (req.usuario?.papel !== 'ADMIN') {
    res.status(403).json({ erro: 'Acesso restrito a administradores.' });
    return;
  }
  next();
}
