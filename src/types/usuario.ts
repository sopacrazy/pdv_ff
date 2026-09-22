export type Papel = 'ADMIN' | 'OPERADOR';

export interface Usuario {
  id: string;
  nome: string;
  login: string;
  papel: Papel;
  ativo: boolean;
  criadoEm: string;
  protheusCodigo: string | null;
  protheusNome: string | null;
  protheusVendFilial: string | null;
  protheusVendCodigo: string | null;
  protheusVendNome: string | null;
}

export interface UsuarioProtheus {
  codigo: string;
  nome: string;
  email: string | null;
}

export interface VendedorProtheus {
  codigo: string;
  nome: string;
}
