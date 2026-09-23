import { Produto } from '../types/produto';

// Mesma regra usada no lado Protheus (U_PDVFORTFRUIT.prw): B1_TIPCONV 'D' divide a quantidade da
// 1ª unidade pelo fator pra achar a 2ª; 'M' multiplica. Sem 2ª unidade ou fator configurado, não
// há conversão possível.
const arredondar = (valor: number) => Math.round(valor * 1000) / 1000;

export function temSegundaUnidade(produto: Produto): boolean {
  return !!produto.segundaUnidade && !!produto.fatorConversao && produto.fatorConversao > 0;
}

export function paraSegundaUnidade(produto: Produto, quantidadePrimeira: number): number | null {
  if (!temSegundaUnidade(produto)) return null;
  const fator = produto.fatorConversao as number;
  const valor = produto.tipoConversao === 'M' ? quantidadePrimeira * fator : quantidadePrimeira / fator;
  return arredondar(valor);
}

export function paraPrimeiraUnidade(produto: Produto, quantidadeSegunda: number): number | null {
  if (!temSegundaUnidade(produto)) return null;
  const fator = produto.fatorConversao as number;
  const valor = produto.tipoConversao === 'M' ? quantidadeSegunda / fator : quantidadeSegunda * fator;
  return arredondar(valor);
}
