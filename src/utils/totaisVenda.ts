import type { ItemVenda } from '../types/venda';

export function calcularTotaisVenda(itens: Pick<ItemVenda, 'valorTotal' | 'desconto'>[]) {
  const subtotal = itens.reduce((soma, item) => soma + item.valorTotal + item.desconto, 0);
  const desconto = itens.reduce((soma, item) => soma + item.desconto, 0);
  return { subtotal, desconto, total: subtotal - desconto };
}
