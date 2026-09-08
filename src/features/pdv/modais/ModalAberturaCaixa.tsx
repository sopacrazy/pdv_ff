import { useState, useRef, useEffect } from 'react';
import { usePdvStore } from '../../../store/pdvStore';
import { formatMoney, parseMoney } from '../../../utils/formatters';
import { Wallet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const ModalAberturaCaixa = () => {
  const { abrirCaixa } = usePdvStore();
  const [valorInput, setValorInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      navigate('/home');
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const cents = parseMoney(valorInput);
      abrirCaixa(cents);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const cents = parseMoney(value);
    setValorInput(cents === 0 ? '' : formatMoney(cents));
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        <div className="p-6 bg-slate-50 flex flex-col items-center border-b border-slate-200">
          <div className="bg-blue-100 text-blue-600 p-4 rounded-full mb-4">
            <Wallet size={32} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">Abertura de Caixa</h2>
          <p className="text-slate-500 text-center mt-2">
            Informe o valor inicial (Fundo de Troco)
          </p>
        </div>
        
        <div className="p-6 flex flex-col">
          <input
            ref={inputRef}
            type="text"
            value={valorInput}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="R$ 0,00"
            className="w-full text-center bg-white border-2 border-slate-300 rounded-xl px-4 py-4 text-4xl font-bold text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all"
          />
        </div>
        
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex gap-3">
          <button
            onClick={() => navigate('/home')}
            className="flex-1 py-3 px-4 rounded-xl font-bold text-slate-600 bg-slate-200 hover:bg-slate-300 transition-colors"
          >
            Voltar (ESC)
          </button>
          <button
            onClick={() => abrirCaixa(parseMoney(valorInput))}
            className="flex-1 py-3 px-4 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors"
          >
            Abrir (ENTER)
          </button>
        </div>
      </div>
    </div>
  );
};
