import { useEffect, useRef } from 'react';
import { usePdvStore } from '../../../store/pdvStore';
import { formatMoney } from '../../../utils/formatters';
import { AlertTriangle, X } from 'lucide-react';

export const ModalCancelamentoItem = () => {
  const { itens, itemSelecionadoId, removerItem, setModalAtivo } = usePdvStore();
  const item = itens.find(i => i.id === itemSelecionadoId);
  const btnRef = useRef<HTMLButtonElement>(null);

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
    if (itemSelecionadoId) {
      removerItem(itemSelecionadoId);
    }
    setModalAtivo('NENHUM');
  };

  if (!item) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onKeyDown={handleKeyDown}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl flex flex-col border border-red-200">
        <div className="p-5 border-b border-red-100 flex justify-between items-center bg-red-50 rounded-t-2xl">
          <div className="flex items-center gap-3 text-red-600">
            <AlertTriangle size={24} />
            <h2 className="text-xl font-bold text-slate-800">Cancelar Item</h2>
          </div>
          <button onClick={() => setModalAtivo('NENHUM')} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={24} />
          </button>
        </div>
        
        <div className="p-6 flex flex-col">
          <p className="text-slate-600 text-lg mb-4 text-center">
            Deseja realmente remover este item da venda?
          </p>
          
          <div className="bg-slate-50 p-4 rounded-lg text-center border border-slate-200">
            <div className="font-bold text-slate-800 mb-2">{item.produto.descricao}</div>
            <div className="text-slate-500 font-mono">
              {item.quantidade} x {formatMoney(item.valorUnitario)} = <strong className="text-red-600 text-xl">{formatMoney(item.valorTotal)}</strong>
            </div>
          </div>
        </div>
        
        <div className="p-6 pt-0 flex gap-4">
          <button 
            onClick={() => setModalAtivo('NENHUM')}
            className="flex-1 px-4 py-3 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            NÃO (ESC)
          </button>
          <button 
            ref={btnRef}
            onClick={confirmar}
            className="flex-1 px-4 py-3 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 transition-colors focus:ring-4 focus:ring-red-500/30"
          >
            SIM (ENTER)
          </button>
        </div>
      </div>
    </div>
  );
};
