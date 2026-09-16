export interface ItemBilhete {
  id: string;
  codigo: string;
  descricao: string;
  quantidade: number;
  unidade: string;
  precoUnitario: number; // centavos
  total: number; // centavos
  peso?: number; // kg, quando aplicável (2ª unidade)
}

export type StatusBilhete = 'RASCUNHO' | 'CONFIRMADO' | 'CANCELADO';
export type FormaPagamentoBilhete = 'A Vista' | 'A Prazo' | 'Boleto' | 'PIX';

export interface Cliente {
  codigo: string;
  loja: string;
  nome: string;
  condPagamentoPadrao: FormaPagamentoBilhete;
  limiteCredito: number; // centavos
}

export interface Bilhete {
  id: string;
  numero: string;
  data: string; // ISO
  cliente: Cliente;
  vendedor: string;
  formaPagamento: FormaPagamentoBilhete;
  condicaoPagamento: string;
  transportadora?: string;
  rota?: string;
  precisaEntrega: boolean;
  observacao?: string;
  itens: ItemBilhete[];
  desconto: number; // centavos
  status: StatusBilhete;
  criadoEm: string;
}
