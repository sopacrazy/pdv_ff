import { useEffect, useRef, useState } from 'react';
import { usePdvStore } from '../../../store/pdvStore';
import { X } from 'lucide-react';

export const ModalQuantidade = () => {
  const { itens, itemSelecionadoId, alterarQuantidade, setModalAtivo } = usePdvStore();
  const item = itens.find(i => i.id === itemSelecionadoId);
  const [valor, setValor] = useState(item ? item.quantidade.toString() : '1');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setModalAtivo('NENHUM');
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const num = parseFloat(valor);
      if (!isNaN(num) && num > 0 && itemSelecionadoId) {
        alterarQuantidade(itemSelecionadoId, num);
        setModalAtivo('NENHUM');
      }
    }
  };

  if (!item) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl flex flex-col border border-slate-200">
        <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-2xl">
          <h2 className="text-xl font-bold text-slate-800">Alterar Quantidade</h2>
          <button onClick={() => setModalAtivo('NENHUM')} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={24} />
          </button>
        </div>
        
        <div className="p-6 flex flex-col items-center">
          <div className="text-slate-600 text-center mb-6 line-clamp-2 font-medium">
            {item.produto.descricao}
          </div>
          <input
            id="input-quantidade"
            ref={inputRef}
            type="number"
            step="any"
            min="0.01"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full text-center bg-white border-2 border-blue-500 rounded-xl px-4 py-4 text-4xl font-bold tabular-nums text-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-500/30"
          />
        </div>
        
        <div className="p-4 bg-slate-50 rounded-b-2xl border-t border-slate-200 text-center text-slate-500 text-sm">
          Pressione <strong className="text-slate-800">ENTER</strong> para confirmar
        </div>
      </div>
    </div>
  );
};
