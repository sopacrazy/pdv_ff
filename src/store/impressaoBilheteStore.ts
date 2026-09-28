import { create } from 'zustand';
import { VendaDetalhe } from '../services/vendaService';

// Global (não um useState dentro da tela de Bilhete) de propósito: o envio ao Protheus pode levar
// até 150s pra responder (ver server/api.js, opções.timeoutMs no modo "rápido"), tempo de sobra
// pro operador já ter navegado pra Consultas antes da resposta voltar. Um estado preso ao
// componente da tela de Bilhete desmontaria nesse meio tempo e a impressão nunca dispararia,
// mesmo com a integração dando certo — foi exatamente isso que aconteceu. Renderizado uma vez no
// App.tsx (ver useImpressaoBilheteProtheus.ts), então sobrevive a qualquer troca de rota.
interface ImpressaoBilheteState {
  vendaParaImprimir: VendaDetalhe | null;
  imprimirBilhete: (venda: VendaDetalhe) => void;
  limparImpressao: () => void;
}

export const useImpressaoBilheteStore = create<ImpressaoBilheteState>((set) => ({
  vendaParaImprimir: null,
  imprimirBilhete: (venda) => set({ vendaParaImprimir: venda }),
  limparImpressao: () => set({ vendaParaImprimir: null }),
}));
