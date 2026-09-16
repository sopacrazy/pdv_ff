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
  forma: 'Dinheiro' | 'Debito' | 'Credito' | 'PIX';
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
