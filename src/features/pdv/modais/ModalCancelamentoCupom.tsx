import { useEffect, useRef } from 'react';
import { usePdvStore } from '../../../store/pdvStore';
import { formatMoney } from '../../../utils/formatters';
import { AlertTriangle, X } from 'lucide-react';

export const ModalCancelamentoCupom = () => {
  const { itens, cancelarCupom, setModalAtivo } = usePdvStore();
  const btnRef = useRef<HTMLButtonElement>(null);

  const total = itens.reduce((acc, i) => acc + i.valorTotal, 0);

  useEffect(() => {
    btnRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setModalAtivo('NENHUM');
    }
  };

  const confirmar = () => {
    cancelarCupom();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onKeyDown={handleKeyDown}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl flex flex-col border border-red-200">
        <div className="p-5 border-b border-red-100 flex justify-between items-center bg-red-50 rounded-t-2xl">
          <div className="flex items-center gap-3 text-red-600">
            <AlertTriangle size={28} />
            <h2 className="text-2xl font-bold text-slate-800">Cancelar Cupom</h2>
          </div>
          <button onClick={() => setModalAtivo('NENHUM')} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={24} />
          </button>
        </div>
        
        <div className="p-8 flex flex-col items-center text-center">
          <p className="text-slate-800 text-xl mb-6 font-medium">
            ATENÇÃO: Toda a venda atual será perdida. Confirma o cancelamento?
          </p>
          
          <div className="text-slate-500 mb-1 uppercase text-sm font-bold tracking-widest">Valor do Cupom</div>
          <div className="text-4xl font-black tabular-nums text-red-600">
            {formatMoney(total)}
          </div>
        </div>
        
        <div className="p-6 bg-slate-50 rounded-b-2xl border-t border-slate-200 flex gap-4">
          <button 
            onClick={() => setModalAtivo('NENHUM')}
            className="flex-1 px-4 py-4 rounded-xl font-bold text-lg text-slate-600 bg-slate-200 hover:bg-slate-300 transition-colors"
          >
            NÃO (ESC)
          </button>
          <button 
            ref={btnRef}
            onClick={confirmar}
            className="flex-1 px-4 py-4 rounded-xl font-bold text-lg text-white bg-red-600 hover:bg-red-700 transition-colors focus:ring-4 focus:ring-red-500/30 outline-none"
          >
            SIM (ENTER)
          </button>
        </div>
      </div>
    </div>
  );
};
