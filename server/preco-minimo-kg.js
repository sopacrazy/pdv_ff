// Centavos necessários para que o preço efetivo por KG não fique abaixo da tabela.
export function totalMinimoKg(quantidade, valorUnitarioCentavos, precoSegundaUnidadeReais = valorUnitarioCentavos / 100) {
  if (!Number.isFinite(quantidade) || quantidade <= 0 || !Number.isSafeInteger(valorUnitarioCentavos) || valorUnitarioCentavos <= 0 ||
    !Number.isFinite(precoSegundaUnidadeReais) || precoSegundaUnidadeReais <= 0) return null;
  return Math.max(Math.ceil(quantidade * valorUnitarioCentavos - 1e-9),
    Math.ceil(quantidade * precoSegundaUnidadeReais * 100 - 1e-9));
}
