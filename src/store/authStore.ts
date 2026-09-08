import { create } from 'zustand';
import { AuthState } from '../types/auth';
import { authServiceMock } from '../services/authService.mock';

interface AuthStore extends AuthState {
  login: (usuario: string, senha: string) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  vendedor: { codigo: '999', nome: 'OPERADOR PADRÃO' },
  loja: '01',
  caixa: '001',
  isAuthenticated: true,

  login: async (usuario, senha) => {
    try {
      const response = await authServiceMock.login(usuario, senha);
      set({ 
        vendedor: response.vendedor,
        isAuthenticated: true 
      });
      localStorage.setItem('@pdv:token', response.token);
    } catch (error) {
      console.error('Erro no login', error);
      throw error;
    }
  },

  logout: () => {
    localStorage.removeItem('@pdv:token');
    set({ vendedor: null, isAuthenticated: false });
  }
}));
