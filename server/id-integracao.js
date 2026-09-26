export function montarIdIntegracao(venda, usuarioProtheusId) {
  // Se esta venda já teve uma tentativa de envio, o identificador usado naquela tentativa precisa
  // ser preservado. Trocar o ID num reenvio faria o 4Sales interpretar a mesma venda como nova.
  if (venda.id_integracao) return String(venda.id_integracao);

  const cupom = String(venda.numero_cupom || '').trim().padStart(6, '0');
  const caixa = String(venda.caixa || '').trim().padStart(4, '0');
  const usuario = String(usuarioProtheusId || '').trim().padStart(6, '0');
  const data = String(venda.data_local || '').replace(/\D/g, '');
  if (!venda.numero_cupom || !venda.caixa || !usuarioProtheusId || data.length !== 8) {
    throw new Error('Não foi possível montar o identificador da venda: confira cupom, caixa, usuário Protheus e data.');
  }
  return `${cupom}-${caixa}-${usuario}-${data}`;
}
