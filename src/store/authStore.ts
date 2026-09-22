import { create } from 'zustand';
import { Usuario } from '../types/usuario';
import { usuarioService } from '../services/usuarioService';

interface AuthStore {
  usuario: Usuario | null;
  token: string | null;
  isAuthenticated: boolean;
  restaurando: boolean;

  // Derivados, mantidos pelo restante do app (PdvPage, pdvStore etc.)
  vendedor: { codigo: string; nome: string } | null;
  loja: string;
  caixa: string;

  login: (login: string, senha: string) => Promise<{ sucesso: boolean; erro?: string }>;
  logout: () => Promise<void>;
  restaurarSessao: () => Promise<void>;
}

function derivarVendedor(usuario: Usuario | null) {
  if (!usuario) return null;
  const codigo = usuario.protheusVendCodigo || usuario.protheusCodigo || usuario.id.slice(0, 8);
  return { codigo, nome: usuario.nome };
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  usuario: null,
  token: null,
  isAuthenticated: false,
  restaurando: true,
  vendedor: null,
  loja: '01',
  caixa: '001',

  login: async (login, senha) => {
    const resultado = await usuarioService.login(login, senha);
    if (!resultado.sucesso || !resultado.token || !resultado.usuario) {
      return { sucesso: false, erro: resultado.erro };
    }
    localStorage.setItem('@pdv:token', resultado.token);
    set({
      usuario: resultado.usuario,
      token: resultado.token,
      isAuthenticated: true,
      vendedor: derivarVendedor(resultado.usuario),
    });
    return { sucesso: true };
  },

  logout: async () => {
    const { token } = get();
    if (token) await usuarioService.logout(token);
    localStorage.removeItem('@pdv:token');
    set({ usuario: null, token: null, isAuthenticated: false, vendedor: null });
  },

  restaurarSessao: async () => {
    const token = localStorage.getItem('@pdv:token');
    if (!token) {
      set({ restaurando: false });
      return;
    }
    const usuario = await usuarioService.me(token);
    if (!usuario) {
      localStorage.removeItem('@pdv:token');
      set({ restaurando: false });
      return;
    }
    set({
      usuario,
      token,
      isAuthenticated: true,
      vendedor: derivarVendedor(usuario),
      restaurando: false,
    });
  },
}));
