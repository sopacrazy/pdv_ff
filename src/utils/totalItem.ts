import type { Produto } from '../types/produto';

// KG vendido pelo preço mínimo da tabela não pode arredondar para baixo:
// isso deixaria o preço efetivo (total / peso) menor que o mínimo.
export function calcularTotalItem(produto: Produto, quantidade: number, valorUnitarioCentavos: number, desconto = 0): number {
  const bruto = quantidade * valorUnitarioCentavos;
  return (produto.unidade?.toUpperCase() === 'KG' ? Math.ceil(bruto - 1e-9) : Math.round(bruto)) - desconto;
}
