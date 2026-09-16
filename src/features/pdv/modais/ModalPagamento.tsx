import { useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { QRCodeSVG } from 'qrcode.react';
import { usePdvStore } from '../../../store/pdvStore';
import { useToastStore } from '../../../store/toastStore';
import { formatMoney, parseMoney } from '../../../utils/formatters';
import { gerarPayloadPix } from '../../../utils/pix';
import { Banknote, QrCode, CreditCard, Landmark, X, ArrowLeft, type LucideIcon } from 'lucide-react';

type Forma = 'Dinheiro' | 'PIX' | 'Credito' | 'Debito';

const FORMAS: { forma: Forma; label: string; icon: LucideIcon; tecla: string }[] = [
  { forma: 'Dinheiro', label: 'Dinheiro', icon: Banknote, tecla: '1' },
  { forma: 'PIX', label: 'PIX', icon: QrCode, tecla: '2' },
  { forma: 'Credito', label: 'Cartão de Crédito', icon: CreditCard, tecla: '3' },
  { forma: 'Debito', label: 'Cartão de Débito', icon: Landmark, tecla: '4' },
];

export const ModalPagamento = () => {
  const { itens, setModalAtivo, finalizarVenda, vendaEmEdicaoId } = usePdvStore();
  const { mostrarToast } = useToastStore();
  const mensagemSucesso = vendaEmEdicaoId ? 'Venda atualizada com sucesso' : 'Venda finalizada com sucesso';

  const total = itens.reduce((acc, i) => acc + i.valorTotal, 0);

  const [etapa, setEtapa] = useState<'FORMA' | 'DINHEIRO' | 'PIX'>('FORMA');
  const [formaIndex, setFormaIndex] = useState(0);
  const [valorInput, setValorInput] = useState('');
  const inputDinheiroRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const valorRecebido = parseMoney(valorInput);
  const troco = valorRecebido - total;

  const payloadPix = gerarPayloadPix({
    chave: 'pix@fortfruit.com.br',
    nome: 'FORT FRUIT',
    cidade: 'BELEM',
    valor: total / 100,
  });

  useEffect(() => {
    if (etapa === 'DINHEIRO') {
      inputDinheiroRef.current?.focus();
    } else {
      containerRef.current?.focus();
    }
  }, [etapa]);

  const escolherForma = async (forma: Forma) => {
    if (forma === 'Dinheiro') {
      setValorInput('');
      setEtapa('DINHEIRO');
    } else if (forma === 'PIX') {
      setEtapa('PIX');
    } else {
      const resultado = await finalizarVenda([{ forma, valor: total }]);
      mostrarToast(
        resultado.sucesso ? mensagemSucesso : `Falha ao salvar venda: ${resultado.erro}`,
        resultado.sucesso ? 'sucesso' : 'erro'
      );
    }
  };

  const handleKeyDownPix = async (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setEtapa('FORMA');
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const resultado = await finalizarVenda([{ forma: 'PIX', valor: total }]);
      mostrarToast(
        resultado.sucesso ? mensagemSucesso : `Falha ao salvar venda: ${resultado.erro}`,
        resultado.sucesso ? 'sucesso' : 'erro'
      );
    }
  };

  const handleKeyDownForma = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setModalAtivo('NENHUM');
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setFormaIndex((i) => (i + 1) % FORMAS.length);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setFormaIndex((i) => (i - 1 + FORMAS.length) % FORMAS.length);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFormaIndex((i) => (i + 2) % FORMAS.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFormaIndex((i) => (i - 2 + FORMAS.length) % FORMAS.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      escolherForma(FORMAS[formaIndex].forma);
    } else {
      const encontrada = FORMAS.find((f) => f.tecla === e.key);
      if (encontrada) {
        e.preventDefault();
        escolherForma(encontrada.forma);
      }
    }
  };

  const handleChangeValor = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cents = parseMoney(e.target.value);
    setValorInput(cents === 0 ? '' : formatMoney(cents));
  };

  const handleKeyDownDinheiro = async (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setEtapa('FORMA');
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (valorRecebido < total) {
        mostrarToast('Valor recebido é menor que o total', 'erro');
        return;
      }
      const resultado = await finalizarVenda([
        { forma: 'Dinheiro', valor: total, valorRecebido, troco: Math.max(troco, 0) },
      ]);
      if (!resultado.sucesso) {
        mostrarToast(`Falha ao salvar venda: ${resultado.erro}`, 'erro');
        return;
      }
      mostrarToast(
        troco > 0 ? `${mensagemSucesso}. Troco: ${formatMoney(troco)}` : mensagemSucesso,
        'sucesso'
      );
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div
        ref={containerRef}
        className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col border border-slate-200 outline-none"
        onKeyDown={etapa === 'FORMA' ? handleKeyDownForma : etapa === 'DINHEIRO' ? handleKeyDownDinheiro : handleKeyDownPix}
        tabIndex={-1}
      >
        <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-2xl">
          <div className="flex items-center gap-3">
            {etapa !== 'FORMA' && (
              <button
                onClick={() => setEtapa('FORMA')}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <ArrowLeft size={22} />
              </button>
            )}
            <h2 className="text-xl font-bold text-slate-800">
              {etapa === 'FORMA' ? 'Forma de Pagamento' : etapa === 'DINHEIRO' ? 'Pagamento em Dinheiro' : 'Pagamento em PIX'}
            </h2>
          </div>
          <button onClick={() => setModalAtivo('NENHUM')} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 flex flex-col items-center">
          <div className="text-slate-500 uppercase text-sm font-bold tracking-widest mb-1">Total a Pagar</div>
          <div className="text-4xl font-black tabular-nums text-blue-600 mb-6">{formatMoney(total)}</div>

          {etapa === 'FORMA' ? (
            <div className="w-full grid grid-cols-2 gap-4">
              {FORMAS.map((f, idx) => {
                const Icon = f.icon;
                return (
                  <button
                    key={f.forma}
                    onClick={() => escolherForma(f.forma)}
                    onMouseEnter={() => setFormaIndex(idx)}
                    className={clsx(
                      'flex flex-col items-center gap-2 py-6 rounded-xl border-2 font-bold text-base text-center transition-all',
                      formaIndex === idx
                        ? 'border-blue-500 bg-blue-50 text-blue-700 ring-4 ring-blue-500/20'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    )}
                  >
                    <Icon size={32} />
                    {f.label}
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-200 text-slate-600">
                      {f.tecla}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : etapa === 'DINHEIRO' ? (
            <div className="w-full flex flex-col items-center">
              <label className="text-slate-500 text-sm font-bold uppercase mb-2 tracking-wider">
                Valor Recebido
              </label>
              <input
                ref={inputDinheiroRef}
                type="text"
                value={valorInput}
                onChange={handleChangeValor}
                placeholder="R$ 0,00"
                className="w-full text-center bg-white border-2 border-blue-500 rounded-xl px-4 py-4 text-4xl font-bold tabular-nums text-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-500/30"
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
          ) : (
            <div className="w-full flex flex-col items-center">
              <div className="p-4 bg-white border-2 border-slate-200 rounded-xl">
                <QRCodeSVG value={payloadPix} size={220} />
              </div>
              <p className="text-slate-500 text-sm mt-4 text-center">
                Aponte a câmera do celular para o QR Code para pagar
              </p>
              <p className="text-xs text-slate-400 mt-1">QR Code de exemplo</p>
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-50 rounded-b-2xl border-t border-slate-200 text-center text-slate-500 text-sm">
          {etapa === 'FORMA' ? (
            <>
              Use as setas e <strong className="text-slate-800">ENTER</strong>, ou pressione{' '}
              <strong className="text-slate-800">1</strong> a <strong className="text-slate-800">4</strong>
            </>
          ) : (
            <>
              Pressione <strong className="text-slate-800">ENTER</strong> para finalizar &middot;{' '}
              <strong className="text-slate-800">ESC</strong> para voltar
            </>
          )}
        </div>
      </div>
    </div>
  );
};
