export interface Vendedor {
  codigo: string;
  nome: string;
}

export interface AuthState {
  vendedor: Vendedor | null;
  loja: string | null;
  caixa: string | null;
  isAuthenticated: boolean;
}
