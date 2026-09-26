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

  login: (login: string, senha: string) => Promise<{ sucesso: boolean; prontoParaVender?: boolean; erro?: string }>;
  logout: () => Promise<void>;
  restaurarSessao: () => Promise<void>;
  definirConfiguracao: (loja: string, caixa: string) => void;
  atualizarUsuario: (usuario: Usuario) => void;
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
      loja: resultado.configuracao?.filial || '01',
      caixa: resultado.configuracao?.caixa || '001',
    });
    return { sucesso: true, prontoParaVender: resultado.usuario.prontoParaVender };
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
    const sessao = await usuarioService.me(token);
    if (!sessao) {
      localStorage.removeItem('@pdv:token');
      set({ restaurando: false });
      return;
    }
    set({
      usuario: sessao.usuario,
      token,
      isAuthenticated: true,
      vendedor: derivarVendedor(sessao.usuario),
      loja: sessao.configuracao?.filial || '01',
      caixa: sessao.configuracao?.caixa || '001',
      restaurando: false,
    });
  },

  definirConfiguracao: (loja, caixa) => set({ loja, caixa }),
  atualizarUsuario: (usuario) => set({ usuario, vendedor: derivarVendedor(usuario) }),
}));
