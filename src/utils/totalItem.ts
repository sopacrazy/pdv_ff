import type { Produto } from '../types/produto';

// Converte a representação decimal do número recebido em uma fração exata.
// A entrada da tela ainda é number, mas nenhuma multiplicação ou divisão
// monetária passa pelo ponto flutuante binário.
export function fracaoDecimal(valor: number): { numerador: bigint; denominador: bigint } {
  if (!Number.isFinite(valor)) throw new RangeError('Valor decimal inválido.');
  const partes = /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(valor.toString());
  if (!partes) throw new RangeError('Valor decimal inválido.');
  const [, sinal, inteiros, decimais = '', expoenteTexto = '0'] = partes;
  const casas = decimais.length - Number(expoenteTexto);
  const numerador = BigInt(`${sinal}${inteiros}${decimais}`);
  return casas > 0
    ? { numerador, denominador: 10n ** BigInt(casas) }
    : { numerador: numerador * 10n ** BigInt(-casas), denominador: 1n };
}

// Round do Protheus: em empate exato, afasta de zero.
export function dividirHalfUp(numerador: bigint, denominador: bigint): bigint {
  if (denominador <= 0n) throw new RangeError('Divisor inválido.');
  const quociente = numerador / denominador;
  const resto = numerador % denominador;
  if (resto === 0n || (resto < 0n ? -resto : resto) * 2n < denominador) return quociente;
  return quociente + (numerador < 0n ? -1n : 1n);
}

export function reaisParaCentavos(valor: number): number {
  const { numerador, denominador } = fracaoDecimal(valor);
  const centavos = dividirHalfUp(numerador * 100n, denominador);
  if (centavos > BigInt(Number.MAX_SAFE_INTEGER) || centavos < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new RangeError('Preço fora do intervalo seguro.');
  }
  return Number(centavos);
}

// Mesmo para KG, o Protheus arredonda o total da linha para centavos.
// O preço efetivo da segunda unidade é calculado depois: total / quantidade.
export function calcularTotalEmCentavos(quantidade: number, valorUnitarioCentavos: number, desconto = 0): number {
  if (!Number.isSafeInteger(valorUnitarioCentavos) || !Number.isSafeInteger(desconto)) {
    throw new RangeError('Preço ou desconto em centavos inválido.');
  }
  const { numerador, denominador } = fracaoDecimal(quantidade);
  const total = dividirHalfUp(numerador * BigInt(valorUnitarioCentavos), denominador) - BigInt(desconto);
  if (total > BigInt(Number.MAX_SAFE_INTEGER) || total < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new RangeError('Total do item fora do intervalo seguro.');
  }
  return Number(total);
}

export function calcularTotalItem(_produto: Produto, quantidade: number, valorUnitarioCentavos: number, desconto = 0): number {
  return calcularTotalEmCentavos(quantidade, valorUnitarioCentavos, desconto);
}

// Reconhece somente totais KG já gravados pela regra antiga. Não é usada em novas vendas.
export function calcularTetoLegadoKg(quantidade: number, valorUnitarioCentavos: number): number | null {
  if (!Number.isFinite(quantidade) || quantidade <= 0 || !Number.isSafeInteger(valorUnitarioCentavos) || valorUnitarioCentavos < 0) return null;
  const { numerador, denominador } = fracaoDecimal(quantidade);
  const produto = numerador * BigInt(valorUnitarioCentavos);
  const teto = (produto + denominador - 1n) / denominador;
  return teto <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(teto) : null;
}
