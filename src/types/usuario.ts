export type Papel = 'ADMIN' | 'OPERADOR';

export interface ConfiguracaoSistema {
  filial: string;
  caixa: string;
  atualizadoEm: string | null;
}

export interface Usuario {
  id: string;
  nome: string;
  login: string;
  papel: Papel;
  ativo: boolean;
  criadoEm: string;
  protheusCodigo: string | null;
  protheusNome: string | null;
  protheusSenhaDefinida: boolean;
  protheusVendFilial: string | null;
  protheusVendCodigo: string | null;
  protheusVendNome: string | null;
  prontoParaVender: boolean;
}

export interface UsuarioProtheus {
  codigo: string;
  idProtheus: string;
  nome: string;
  email: string | null;
}

export interface VendedorProtheus {
  codigo: string;
  nome: string;
  usuarioCodigo: string | null;
}
