import { useState } from 'react';
import { vendaService, VendaDetalhe } from '../services/vendaService';
import { useAuthStore } from '../store/authStore';
import { useToastStore } from '../store/toastStore';

// Compartilhado entre PDV (imprime sozinho ao finalizar) e Consultas (botão de imprimir). Manda
// direto pra impressora térmica em ESC/POS via RAW print (ver server/impressora-termica.js) —
// não depende mais do diálogo/motor de página do navegador (window.print()), que cortava as
// bordas do cupom por causa da área não-imprimível que o driver da impressora reporta ao Windows.
export function useImpressaoCupom() {
  const [vendaParaImprimir, setVendaParaImprimir] = useState<VendaDetalhe | null>(null);
  const { token } = useAuthStore();
  const { mostrarToast } = useToastStore();

  const imprimirPorId = async (id: string) => {
    const detalhe = await vendaService.buscarVenda(id);
    if (!detalhe) return null;
    setVendaParaImprimir(detalhe);
    if (token) {
      const resultado = await vendaService.imprimirVenda(id, token);
      if (!resultado.sucesso) {
        mostrarToast(resultado.erro || 'Não foi possível imprimir o cupom.', 'erro');
      }
    }
    return detalhe;
  };

  return { vendaParaImprimir, imprimirVenda: setVendaParaImprimir, imprimirPorId };
}
