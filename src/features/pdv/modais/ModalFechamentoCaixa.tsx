import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePdvStore } from '../../../store/pdvStore';
import { formatMoney } from '../../../utils/formatters';
import { Lock, X } from 'lucide-react';

export const ModalFechamentoCaixa = () => {
  const { fundoDeTroco, fecharCaixa, setModalAtivo } = usePdvStore();
  const btnRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();

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
    fecharCaixa();
    navigate('/home');
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onKeyDown={handleKeyDown}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl flex flex-col border border-slate-200">
        <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-2xl">
          <div className="flex items-center gap-3 text-slate-700">
            <Lock size={26} />
            <h2 className="text-xl font-bold text-slate-800">Fechar Caixa</h2>
          </div>
          <button onClick={() => setModalAtivo('NENHUM')} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-8 flex flex-col items-center text-center">
          <p className="text-slate-800 text-lg mb-6 font-medium">
            Confirma o fechamento do caixa? Nenhuma venda poderá ser registrada até a próxima abertura.
          </p>

          <div className="text-slate-500 mb-1 uppercase text-sm font-bold tracking-widest">Fundo de Troco (Abertura)</div>
          <div className="text-3xl font-black tabular-nums text-slate-800">
            {formatMoney(fundoDeTroco)}
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
            className="flex-1 px-4 py-4 rounded-xl font-bold text-lg text-white bg-slate-800 hover:bg-slate-900 transition-colors focus:ring-4 focus:ring-slate-500/30 outline-none"
          >
            SIM (ENTER)
          </button>
        </div>
      </div>
    </div>
  );
};
