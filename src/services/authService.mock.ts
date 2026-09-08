import { Vendedor } from '../types/auth';

export interface AuthService {
  login(usuario: string, senha: string): Promise<{ vendedor: Vendedor, token: string }>;
}

export const authServiceMock: AuthService = {
  login: async (usuario, senha) => {
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Aceita qualquer credencial no mock
    return {
      vendedor: {
        codigo: '999',
        nome: usuario.toUpperCase() || 'OPERADOR PADRÃO',
      },
      token: 'mock-jwt-token-12345',
    };
  }
};
