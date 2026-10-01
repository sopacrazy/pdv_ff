// Calcula valores monetários a partir da representação decimal da quantidade.
// O resultado só vira Number depois de arredondado a uma unidade inteira segura.
function quantidadeDecimal(quantidade) {
  if (typeof quantidade !== 'number' || !Number.isFinite(quantidade) || quantidade <= 0) return null;
  const partes = String(quantidade).match(/^(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i);
  if (!partes) return null;
  const coeficiente = BigInt(partes[1] + (partes[2] || ''));
  const escala = (partes[2]?.length || 0) - Number(partes[3] || 0);
  return escala >= 0
    ? { numerador: coeficiente, denominador: 10n ** BigInt(escala) }
    : { numerador: coeficiente * 10n ** BigInt(-escala), denominador: 1n };
}

function arredondarHalfUp(numerador, denominador) {
  const inteiro = numerador / denominador;
  return inteiro + (2n * (numerador % denominador) >= denominador ? 1n : 0n);
}

function numeroSeguro(valor) {
  return valor <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(valor) : null;
}

export function calcularTotalCentavos(quantidade, precoCentavos) {
  const decimal = quantidadeDecimal(quantidade);
  if (!decimal || !Number.isSafeInteger(precoCentavos) || precoCentavos < 0) return null;
  return numeroSeguro(arredondarHalfUp(decimal.numerador * BigInt(precoCentavos), decimal.denominador));
}

export function reaisParaCentavos(valorReais) {
  const decimal = quantidadeDecimal(valorReais);
  if (!decimal) return null;
  return numeroSeguro(arredondarHalfUp(decimal.numerador * 100n, decimal.denominador));
}

// Apenas para aceitar cupons KG antigos, gravados pela regra de subir qualquer fração de centavo.
export function calcularTotalLegadoKgCentavos(quantidade, precoCentavos) {
  const decimal = quantidadeDecimal(quantidade);
  if (!decimal || !Number.isSafeInteger(precoCentavos) || precoCentavos < 0) return null;
  const produto = decimal.numerador * BigInt(precoCentavos);
  return numeroSeguro((produto + decimal.denominador - 1n) / decimal.denominador);
}

// Total em centavos / quantidade, arredondado a seis casas em reais.
export function precoPorQuantidadeSeisCasas(totalCentavos, quantidade) {
  const decimal = quantidadeDecimal(quantidade);
  if (!decimal || !Number.isSafeInteger(totalCentavos) || totalCentavos < 0) return null;
  const micros = arredondarHalfUp(BigInt(totalCentavos) * 10000n * decimal.denominador, decimal.numerador);
  if (micros > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return `${micros / 1000000n}.${String(micros % 1000000n).padStart(6, '0')}`;
}
