// Corrige apenas vendas PDV legadas cujo total foi salvo como soma sem arredondar cada linha.
// Uma divergência por outro motivo continua bloqueada para revisão, sem alterar o histórico.
export function calcularAjusteArredondamento(venda, itens) {
  if (venda.tipo_operacao !== 'PDV' || venda.payload_protheus || !itens.length) return null;
  if (itens.some(item => !Number.isFinite(item.quantidade) || item.quantidade <= 0 ||
    !Number.isSafeInteger(item.valor_unitario) || !Number.isSafeInteger(item.valor_total) ||
    Number(item.desconto || 0) !== 0 ||
    Math.round(item.quantidade * item.valor_unitario) !== item.valor_total)) return null;
  const totalItens = itens.reduce((soma, item) => soma + item.valor_total, 0);
  if (venda.total === totalItens) return null;
  const totalLegado = itens.reduce((soma, item) => soma + item.quantidade * item.valor_unitario, 0);
  if (Math.abs(Number(venda.total) - totalLegado) > 0.001 && venda.total !== Math.round(totalLegado)) return null;
  return { total: totalItens, subtotal: totalItens + Number(venda.desconto || 0) };
}
