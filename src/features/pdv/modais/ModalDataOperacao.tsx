import { useRef, useState } from 'react';
import { usePdvStore } from '../../../store/pdvStore';
import { useToastStore } from '../../../store/toastStore';
import { X, RotateCcw } from 'lucide-react';

function hojeYYYYMMDD() {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

export const ModalDataOperacao = ({ aoFechar }: { aoFechar: () => void }) => {
  const { dataOperacao, definirDataOperacao } = usePdvStore();
  const { mostrarToast } = useToastStore();
  const [valor, setValor] = useState(dataOperacao || hojeYYYYMMDD());
  const inputRef = useRef<HTMLInputElement>(null);

  const salvar = async (data: string | null) => {
    const resultado = await definirDataOperacao(data);
    if (!resultado.sucesso) {
      mostrarToast(`Falha ao alterar data de operação: ${resultado.erro}`, 'erro');
      return;
    }
    mostrarToast(
      data ? `Vendas a partir de agora contam pro fechamento de ${data.split('-').reverse().join('/')}` : 'Voltou a usar a data automática',
      'sucesso'
    );
    aoFechar();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      aoFechar();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (valor) salvar(valor);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl flex flex-col border border-slate-200" onKeyDown={handleKeyDown}>
        <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-2xl">
          <h2 className="text-xl font-bold text-slate-800">Data de Operação</h2>
          <button onClick={aoFechar} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 flex flex-col items-center">
          <p className="text-sm text-slate-500 text-center mb-4">
            Define em qual dia as novas vendas contam pro fechamento e são enviadas ao Protheus
            (o horário mostrado no cupom continua sendo o real). Use quando a loja adiantar a data
            do Protheus antes da virada, no funcionamento de madrugada.
          </p>
          <input
            ref={inputRef}
            type="date"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            autoFocus
            className="w-full text-center bg-white border-2 border-blue-500 rounded-xl px-4 py-3 text-2xl font-bold tabular-nums text-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-500/30"
          />
          {dataOperacao && (
            <button
              onClick={() => salvar(null)}
              className="mt-3 flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors"
            >
              <RotateCcw size={14} />
              Voltar para data automática (hoje)
            </button>
          )}
        </div>

        <div className="p-4 bg-slate-50 rounded-b-2xl border-t border-slate-200 flex gap-3">
          <button
            onClick={aoFechar}
            className="flex-1 py-3 rounded-xl font-bold text-slate-600 bg-slate-200 hover:bg-slate-300 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => valor && salvar(valor)}
            className="flex-1 py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
};
