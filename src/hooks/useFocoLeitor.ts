import { useEffect, RefObject } from 'react';
import { usePdvStore } from '../store/pdvStore';

export const useFocoLeitor = (inputRef: RefObject<HTMLInputElement | null>) => {
  const modalAtivo = usePdvStore((state) => state.modalAtivo);
  const isCaixaAberto = usePdvStore((state) => state.isCaixaAberto);

  useEffect(() => {
    if (isCaixaAberto && modalAtivo === 'NENHUM' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [modalAtivo, isCaixaAberto, inputRef]);

  useEffect(() => {
    const handleGlobalClick = () => {
      if (isCaixaAberto && modalAtivo === 'NENHUM' && inputRef.current) {
        setTimeout(() => {
          const active = document.activeElement;
          if (active?.tagName !== 'BUTTON' && active?.tagName !== 'INPUT') {
            inputRef.current?.focus();
          }
        }, 50);
      }
    };

    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, [modalAtivo, isCaixaAberto, inputRef]);
};
