import { useEffect } from 'react';

type AtalhoMap = {
  [key: string]: (e: KeyboardEvent) => void;
};

export const useAtalhos = (atalhos: AtalhoMap) => {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignora atalhos se estiver em um input ou textarea (exceto F-keys que queremos globalmente, ou setas na tabela)
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
      
      if (atalhos[e.key]) {
        if (e.key.startsWith('F') || (e.key.startsWith('Arrow') && !isInput)) {
          e.preventDefault(); // Impede scroll natural ou refresh (F5)
        }
        
        // Se for Enter e estiver no input, não processa atalho global, a menos que especificado
        if (e.key === 'Enter' && isInput && target.id !== 'input-busca-produto' && target.id !== 'input-quantidade') {
          // Deixa o form lidar com o submit
          return;
        }

        atalhos[e.key](e);
      }
    };

    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true });
  }, [atalhos]);
};
