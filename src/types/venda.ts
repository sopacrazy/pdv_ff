import { Produto } from './produto';

export interface ItemVenda {
  id: string; // Identificador único na lista
  produto: Produto;
  quantidade: number;
  valorUnitario: number;
  desconto: number;
  valorTotal: number;
}

export interface Pagamento {
  // 'Dinheiro' | 'Debito' | 'Credito' | 'PIX' no pagamento manual,
  // ou o código da condição de pagamento do cadastro do cliente (ex: A1_COND) no fluxo automático.
  forma: string;
  valor: number;
  valorRecebido?: number;
  troco?: number;
}

export interface Venda {
  numeroCupom: string;
  itens: ItemVenda[];
  subtotal: number;
  totalDescontos: number;
  total: number;
  pagamentos: Pagamento[];
  status: 'EmAberto' | 'Finalizada' | 'Cancelada';
}
