import { useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { usePdvStore } from '../../../store/pdvStore';
import { useToastStore } from '../../../store/toastStore';
import { formatMoney, parseMoney } from '../../../utils/formatters';
import { Banknote, QrCode, X, type LucideIcon } from 'lucide-react';

// O código escolhido aqui (033 ou 001) é a condição de pagamento gravada e enviada ao Protheus.
const CONDICOES: { id: 'PIX' | 'A_VISTA'; label: string; codigo: string; icon: LucideIcon; tecla: string }[] = [
  { id: 'PIX', label: 'PIX', codigo: '033', icon: QrCode, tecla: '1' },
  { id: 'A_VISTA', label: 'À Vista', codigo: '001', icon: Banknote, tecla: '2' },
];

export const ModalPagamento = ({ aoFinalizarImprimir }: { aoFinalizarImprimir: (id: string) => void }) => {
  const { itens, setModalAtivo, finalizarVenda } = usePdvStore();
  const { mostrarToast } = useToastStore();

  const total = itens.reduce((acc, i) => acc + i.valorTotal, 0);

  const [etapa, setEtapa] = useState<'ESCOLHA' | 'VALOR'>('ESCOLHA');
  const [condicaoIndex, setCondicaoIndex] = useState(0);
  const [valorInput, setValorInput] = useState('');
  const [finalizando, setFinalizando] = useState(false);
  const inputValorRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const valorRecebido = parseMoney(valorInput);
  const troco = valorRecebido - total;

  useEffect(() => {
    if (etapa === 'VALOR') {
      inputValorRef.current?.focus();
    } else {
      containerRef.current?.focus();
    }
  }, [etapa]);

  const finalizar = async (codigo: string, dados?: { valorRecebido?: number; troco?: number }) => {
    // Trava contra clique duplo/Enter repetido enquanto a primeira chamada ainda está em voo —
    // sem isso, duas invocações quase simultâneas criavam duas vendas distintas (cada requisição
    // ganha seu próprio número de cupom no servidor, então não há como o backend detectar sozinho
    // que é a mesma venda sendo enviada duas vezes).
    if (finalizando) return;
    setFinalizando(true);
    try {
      const resultado = await finalizarVenda([{ forma: codigo, valor: total, ...dados }]);
      if (!resultado.sucesso) {
        mostrarToast(`Falha ao finalizar venda: ${resultado.erro}`, 'erro');
        return;
      }
      mostrarToast(
        dados?.troco && dados.troco > 0
          ? `Venda finalizada com sucesso. Troco: ${formatMoney(dados.troco)}`
          : 'Venda finalizada com sucesso',
        'sucesso'
      );
      if (resultado.id) aoFinalizarImprimir(resultado.id);
    } finally {
      setFinalizando(false);
    }
  };

  const escolherCondicao = async (id: 'PIX' | 'A_VISTA') => {
    if (id === 'A_VISTA') {
      setValorInput('');
      setEtapa('VALOR');
    } else {
      // PIX é pagamento exato, sem troco — finaliza direto, sem tela de QR Code.
      await finalizar('033');
    }
  };

  const handleKeyDownEscolha = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setModalAtivo('NENHUM');
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      setCondicaoIndex((i) => (i + 1) % CONDICOES.length);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      setCondicaoIndex((i) => (i - 1 + CONDICOES.length) % CONDICOES.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      escolherCondicao(CONDICOES[condicaoIndex].id);
    } else {
      const encontrada = CONDICOES.find((c) => c.tecla === e.key);
      if (encontrada) {
        e.preventDefault();
        escolherCondicao(encontrada.id);
      }
    }
  };

  const handleChangeValor = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cents = parseMoney(e.target.value);
    setValorInput(cents === 0 ? '' : formatMoney(cents));
  };

  const handleKeyDownValor = async (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setEtapa('ESCOLHA');
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // Sem valor digitado: finaliza direto, sem calcular troco (pagamento exato).
      if (!valorInput) {
        await finalizar('001');
        return;
      }
      if (valorRecebido < total) {
        mostrarToast('Valor recebido é menor que o total', 'erro');
        return;
      }
      await finalizar('001', { valorRecebido, troco: Math.max(troco, 0) });
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div
        ref={containerRef}
        className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col border border-slate-200 outline-none"
        onKeyDown={etapa === 'ESCOLHA' ? handleKeyDownEscolha : handleKeyDownValor}
        tabIndex={-1}
      >
        <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-2xl">
          <h2 className="text-xl font-bold text-slate-800">
            {finalizando ? 'Finalizando...' : etapa === 'ESCOLHA' ? 'Finalizar Venda' : 'Pagamento à Vista'}
          </h2>
          <button
            onClick={() => setModalAtivo('NENHUM')}
            disabled={finalizando}
            className="text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 flex flex-col items-center">
          <div className="text-slate-500 uppercase text-sm font-bold tracking-widest mb-1">Total a Pagar</div>
          <div className="text-4xl font-black tabular-nums text-blue-600 mb-6">{formatMoney(total)}</div>

          {etapa === 'ESCOLHA' ? (
            <div className="w-full grid grid-cols-2 gap-4">
              {CONDICOES.map((c, idx) => {
                const Icon = c.icon;
                return (
                  <button
                    key={c.id}
                    onClick={() => escolherCondicao(c.id)}
                    onMouseEnter={() => setCondicaoIndex(idx)}
                    disabled={finalizando}
                    className={clsx(
                      'flex flex-col items-center gap-2 py-6 rounded-xl border-2 font-bold text-base text-center transition-all disabled:opacity-50 disabled:cursor-not-allowed',
                      condicaoIndex === idx
                        ? 'border-blue-500 bg-blue-50 text-blue-700 ring-4 ring-blue-500/20'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    )}
                  >
                    <Icon size={32} />
                    {c.label}
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-200 text-slate-600">
                      {c.tecla}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="w-full flex flex-col items-center">
              <label className="text-slate-500 text-sm font-bold uppercase mb-2 tracking-wider">
                Valor Recebido (opcional)
              </label>
              <input
                ref={inputValorRef}
                type="text"
                value={valorInput}
                onChange={handleChangeValor}
                placeholder="R$ 0,00"
                disabled={finalizando}
                className="w-full text-center bg-white border-2 border-blue-500 rounded-xl px-4 py-4 text-4xl font-bold tabular-nums text-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-500/30 disabled:opacity-50"
              />
              <div className="w-full flex justify-between items-center mt-6 px-2">
                <span className="text-slate-500 font-bold uppercase text-sm tracking-wider">Troco</span>
                <span
                  className={clsx(
                    'text-3xl font-black tabular-nums',
                    troco < 0 ? 'text-slate-400' : 'text-green-600'
                  )}
                >
                  {formatMoney(Math.max(troco, 0))}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-50 rounded-b-2xl border-t border-slate-200 text-center text-slate-500 text-sm">
          {etapa === 'ESCOLHA' ? (
            <>
              Use as setas e <strong className="text-slate-800">ENTER</strong>, ou pressione{' '}
              <strong className="text-slate-800">1</strong> ou <strong className="text-slate-800">2</strong>
            </>
          ) : (
            <>
              <strong className="text-slate-800">ENTER</strong> sem digitar nada finaliza sem troco &middot;{' '}
              <strong className="text-slate-800">ESC</strong> para voltar
            </>
          )}
        </div>
      </div>
    </div>
  );
};
