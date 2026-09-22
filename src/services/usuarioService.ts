import { Usuario, UsuarioProtheus, VendedorProtheus } from '../types/usuario';

function headersComToken(token: string | null): HeadersInit {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const usuarioService = {
  login: async (login: string, senha: string): Promise<{ sucesso: boolean; token?: string; usuario?: Usuario; erro?: string }> => {
    try {
      const resp = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, senha }),
      });
      const corpo = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        return { sucesso: false, erro: corpo.erro || `Erro HTTP ${resp.status}` };
      }
      return { sucesso: true, token: corpo.token, usuario: corpo.usuario };
    } catch (erro) {
      return { sucesso: false, erro: erro instanceof Error ? erro.message : 'Falha ao conectar com o servidor local' };
    }
  },

  logout: async (token: string): Promise<void> => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', headers: headersComToken(token) });
    } catch {
      // segue o logout local mesmo se a chamada falhar
    }
  },

  me: async (token: string): Promise<Usuario | null> => {
    try {
      const resp = await fetch('/api/auth/me', { headers: headersComToken(token) });
      if (!resp.ok) return null;
      const corpo = await resp.json();
      return corpo.usuario;
    } catch {
      return null;
    }
  },

  listar: async (token: string): Promise<Usuario[]> => {
    const resp = await fetch('/api/usuarios', { headers: headersComToken(token) });
    if (!resp.ok) return [];
    return resp.json();
  },

  listarProtheus: async (token: string): Promise<UsuarioProtheus[]> => {
    const resp = await fetch('/api/protheus/usuarios', { headers: headersComToken(token) });
    if (!resp.ok) return [];
    return resp.json();
  },

  listarFiliais: async (token: string): Promise<string[]> => {
    const resp = await fetch('/api/protheus/filiais', { headers: headersComToken(token) });
    if (!resp.ok) return [];
    return resp.json();
  },

  listarVendedores: async (token: string, filial: string): Promise<VendedorProtheus[]> => {
    const resp = await fetch(`/api/protheus/vendedores?filial=${encodeURIComponent(filial)}`, {
      headers: headersComToken(token),
    });
    if (!resp.ok) return [];
    return resp.json();
  },

  criar: async (
    token: string,
    dados: {
      nome: string;
      login: string;
      senha: string;
      papel: 'ADMIN' | 'OPERADOR';
      protheusCodigo?: string | null;
      protheusNome?: string | null;
      protheusVendFilial?: string | null;
      protheusVendCodigo?: string | null;
      protheusVendNome?: string | null;
    }
  ): Promise<{ sucesso: boolean; usuario?: Usuario; erro?: string }> => {
    try {
      const resp = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headersComToken(token) },
        body: JSON.stringify(dados),
      });
      const corpo = await resp.json().catch(() => ({}));
      if (!resp.ok) return { sucesso: false, erro: corpo.erro || `Erro HTTP ${resp.status}` };
      return { sucesso: true, usuario: corpo };
    } catch (erro) {
      return { sucesso: false, erro: erro instanceof Error ? erro.message : 'Falha ao conectar com o servidor local' };
    }
  },

  atualizar: async (
    token: string,
    id: string,
    dados: {
      nome?: string;
      papel?: 'ADMIN' | 'OPERADOR';
      ativo?: boolean;
      senha?: string;
      protheusCodigo?: string | null;
      protheusNome?: string | null;
      protheusVendFilial?: string | null;
      protheusVendCodigo?: string | null;
      protheusVendNome?: string | null;
    }
  ): Promise<{ sucesso: boolean; usuario?: Usuario; erro?: string }> => {
    try {
      const resp = await fetch(`/api/usuarios/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...headersComToken(token) },
        body: JSON.stringify(dados),
      });
      const corpo = await resp.json().catch(() => ({}));
      if (!resp.ok) return { sucesso: false, erro: corpo.erro || `Erro HTTP ${resp.status}` };
      return { sucesso: true, usuario: corpo };
    } catch (erro) {
      return { sucesso: false, erro: erro instanceof Error ? erro.message : 'Falha ao conectar com o servidor local' };
    }
  },
};
