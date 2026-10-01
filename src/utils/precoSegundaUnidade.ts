// O Protheus mostra o preço efetivo da segunda unidade: total da linha já
// arredondado dividido pela quantidade convertida. Não altera o preço vendido.
export function precoSegundaUnidade(valorTotalCentavos: number, quantidade2: number | null | undefined): string | null {
  if (!Number.isFinite(valorTotalCentavos) || !Number.isFinite(quantidade2) || !quantidade2 || quantidade2 <= 0) return null;
  return (valorTotalCentavos / 100 / quantidade2).toLocaleString('pt-BR', {
    minimumFractionDigits: 6,
    maximumFractionDigits: 6,
  });
}
