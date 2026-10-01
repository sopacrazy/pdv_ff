import { dividirHalfUp, fracaoDecimal } from './totalItem';

// O Protheus mostra o preço efetivo da segunda unidade: total da linha já
// arredondado dividido pela quantidade convertida. Não altera o preço vendido.
export function precoSegundaUnidade(valorTotalCentavos: number, quantidade2: number | null | undefined): string | null {
  if (!Number.isSafeInteger(valorTotalCentavos) || !Number.isFinite(quantidade2) || !quantidade2 || quantidade2 <= 0) return null;
  const quantidade = fracaoDecimal(quantidade2);
  // centavos / 100 / quantidade, escalado para seis casas: centavos * 10.000 / quantidade.
  const precoEmMilionesimos = dividirHalfUp(
    BigInt(valorTotalCentavos) * 10_000n * quantidade.denominador,
    quantidade.numerador,
  );
  const absoluto = precoEmMilionesimos < 0n ? -precoEmMilionesimos : precoEmMilionesimos;
  const inteiros = (absoluto / 1_000_000n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const decimais = (absoluto % 1_000_000n).toString().padStart(6, '0');
  return `${precoEmMilionesimos < 0n ? '-' : ''}${inteiros},${decimais}`;
}
