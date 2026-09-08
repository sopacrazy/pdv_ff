import { create } from 'zustand';

interface ToastState {
  mensagem: string | null;
  tipo: 'sucesso' | 'erro' | 'info';
  mostrarToast: (mensagem: string, tipo?: 'sucesso' | 'erro' | 'info') => void;
  esconderToast: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
  mensagem: null,
  tipo: 'info',
  mostrarToast: (mensagem, tipo = 'info') => {
    set({ mensagem, tipo });
    setTimeout(() => {
      set({ mensagem: null });
    }, 4000);
  },
  esconderToast: () => set({ mensagem: null }),
}));
