import { useEffect, useState } from 'react';
import { vendaService, VendaDetalhe } from '../services/vendaService';

// Compartilhado entre PDV (imprime sozinho ao finalizar) e Consultas (botão de imprimir) — os dois
// só precisam colocar <ReciboTermico venda={vendaParaImprimir} /> fora do wrapper print:hidden da
// página. Por enquanto isso é o diálogo de impressão do navegador (PDF/impressora normal); quando
// o agent de impressão térmica existir, só este hook precisa mudar pra falar com ele.
export function useImpressaoCupom() {
  const [vendaParaImprimir, setVendaParaImprimir] = useState<VendaDetalhe | null>(null);

  useEffect(() => {
    if (!vendaParaImprimir) return;
    const id = requestAnimationFrame(() => window.print());
    return () => cancelAnimationFrame(id);
  }, [vendaParaImprimir]);

  useEffect(() => {
    const aoTerminar = () => setVendaParaImprimir(null);
    window.addEventListener('afterprint', aoTerminar);
    return () => window.removeEventListener('afterprint', aoTerminar);
  }, []);

  const imprimirPorId = async (id: string) => {
    const detalhe = await vendaService.buscarVenda(id);
    if (detalhe) setVendaParaImprimir(detalhe);
    return detalhe;
  };

  return { vendaParaImprimir, imprimirVenda: setVendaParaImprimir, imprimirPorId };
}
