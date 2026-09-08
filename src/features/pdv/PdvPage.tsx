import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { usePdvStore } from '../../store/pdvStore';
import { useToastStore } from '../../store/toastStore';
import { useAtalhos } from '../../hooks/useAtalhos';
import { useFocoLeitor } from '../../hooks/useFocoLeitor';
import { produtoServiceMock } from '../../services/produtoService.mock';

import { ItensVenda } from './ItensVenda';
import { PainelTotais } from './PainelTotais';
import { Toast } from '../../components/Toast';

// Modais
import { ModalAberturaCaixa } from './modais/ModalAberturaCaixa';
import { ModalBuscaProduto } from './modais/ModalBuscaProduto';
import { ModalQuantidade } from './modais/ModalQuantidade';
import { ModalCancelamentoItem } from './modais/ModalCancelamentoItem';
import { ModalCancelamentoCupom } from './modais/ModalCancelamentoCupom';
import { ModalPagamento } from './modais/ModalPagamento';
import { ModalFechamentoCaixa } from './modais/ModalFechamentoCaixa';
import { clsx } from 'clsx';

export const PdvPage = () => {
  const { vendedor, loja, caixa } = useAuthStore();
  const {
    isCaixaAberto,
    cupomNumero, modalAtivo, setModalAtivo, itens, itemSelecionadoId,
    selecionarAnterior, selecionarProximo, adicionarItem
  } = usePdvStore();
  const { mostrarToast } = useToastStore();
  const navigate = useNavigate();

  const [horaAtual, setHoraAtual] = useState(new Date());
  const [leitorValue, setLeitorValue] = useState('');
  const inputLeitorRef = useRef<HTMLInputElement>(null);

  useFocoLeitor(inputLeitorRef);

  useEffect(() => {
    const timer = setInterval(() => setHoraAtual(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Handlers do Leitor
  const processarLeitura = async () => {
    if (!leitorValue.trim()) return;

    const regex = /^(\d+)[\*xX](.+)$/;
    const match = leitorValue.match(regex);
    let qtd = 1;
    let codigo = leitorValue.trim();

    if (match) {
      qtd = parseFloat(match[1]) || 1;
      codigo = match[2].trim();
    }

    const produto = await produtoServiceMock.buscarPorCodigoOuBarras(codigo);

    if (produto) {
      adicionarItem(produto, qtd);
    } else {
      mostrarToast(`Produto não encontrado: ${codigo}`, 'erro');
    }
    
    setLeitorValue('');
  };

  const handleLeitorKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      processarLeitura();
    }
  };

  // Atalhos Globais
  const semModalAberto = isCaixaAberto && modalAtivo === 'NENHUM';
  useAtalhos({
    'F2': () => semModalAberto && setModalAtivo('BUSCA_PRODUTO'),
    'F3': () => {
      if (semModalAberto && itens.length > 0 && itemSelecionadoId) setModalAtivo('QUANTIDADE');
    },
    'F4': () => semModalAberto && mostrarToast('Desconto (Em desenvolvimento)', 'info'),
    'F5': () => {
      if (semModalAberto && itens.length > 0 && itemSelecionadoId) setModalAtivo('CANCELAR_ITEM');
    },
    'F6': () => semModalAberto && mostrarToast('Cliente (Em desenvolvimento)', 'info'),
    'F8': () => {
      if (!semModalAberto) return;
      if (itens.length > 0) {
        mostrarToast('Finalize ou cancele a venda atual antes de fechar o caixa', 'erro');
      } else {
        setModalAtivo('FECHAR_CAIXA');
      }
    },
    'F9': () => {
      if (semModalAberto && itens.length > 0) setModalAtivo('PAGAMENTO');
    },
    'F12': () => {
      if (semModalAberto && itens.length > 0) setModalAtivo('CANCELAR_CUPOM');
    },
    'ArrowUp': () => semModalAberto && selecionarAnterior(),
    'ArrowDown': () => semModalAberto && selecionarProximo(),
    'Escape': () => semModalAberto && navigate('/home'),
  });

  const formatadorHora = new Intl.DateTimeFormat('pt-BR', { timeStyle: 'medium' });

  const ShortcutChip = ({ k, label, disabled }: { k: string; label: string; disabled?: boolean }) => (
    <div className={clsx(
      "flex items-center gap-2 px-3 py-1.5 rounded-md font-bold text-sm transition-opacity whitespace-nowrap",
      disabled ? "bg-slate-100 text-slate-400 opacity-70" : "bg-slate-100 text-slate-700"
    )}>
      <span className={clsx("px-1.5 py-0.5 rounded text-xs", disabled ? "bg-slate-200 text-slate-400" : "bg-slate-300 text-slate-800")}>{k}</span>
      {label}
    </div>
  );

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-100 text-slate-900 font-sans">
      <Toast />

      {/* TOPO */}
      <header className="h-16 shrink-0 bg-white border-b border-slate-200 flex items-center justify-between px-6 z-20 shadow-sm">
        <div className="font-bold text-lg text-slate-500 tracking-wider">
          CAIXA <span className="text-slate-800">{caixa}</span> &middot; LOJA <span className="text-slate-800">{loja}</span>
        </div>
        <div className="font-black text-2xl text-slate-800 tracking-widest bg-slate-100 px-6 py-1.5 rounded-lg border border-slate-200">
          CUPOM Nº <span className="text-blue-600">{cupomNumero}</span>
        </div>
        <div className="text-right flex flex-col justify-center">
          <div className="font-bold text-sm uppercase tracking-wide text-slate-800">{vendedor?.nome}</div>
          <div className="text-sm text-slate-500 font-mono">{formatadorHora.format(horaAtual)}</div>
        </div>
      </header>

      {/* CORPO */}
      <main className="flex-1 flex overflow-hidden">
        {/* ESQUERDA */}
        <div className="flex-[6.5] flex flex-col min-w-0 border-r border-slate-200 relative bg-white">
          <div className="p-6 bg-white shadow-sm z-10 border-b border-slate-200">
            <input
              id="input-leitor"
              ref={inputLeitorRef}
              value={leitorValue}
              onChange={(e) => setLeitorValue(e.target.value)}
              onKeyDown={handleLeitorKeyDown}
              disabled={!isCaixaAberto}
              className="w-full h-18 text-2xl bg-slate-50 border-2 border-slate-300 focus:border-blue-500 rounded-xl px-6 text-slate-900 focus:outline-none focus:ring-4 focus:ring-blue-500/20 placeholder-slate-400 font-mono transition-all disabled:opacity-50"
              placeholder="Código de barras ou código do produto (Ex: 3*1234)"
              autoComplete="off"
            />
          </div>
          <div className="flex-1 overflow-hidden relative">
            <ItensVenda />
          </div>
        </div>

        {/* DIREITA */}
        <PainelTotais />
      </main>

      {/* RODAPÉ */}
      <footer className="h-14 shrink-0 bg-white flex items-center px-4 gap-3 overflow-x-auto border-t border-slate-200">
        <ShortcutChip k="F2" label="Buscar Produto" disabled={!isCaixaAberto} />
        <ShortcutChip k="F3" label="Quantidade" disabled={!isCaixaAberto || itens.length === 0 || !itemSelecionadoId} />
        <ShortcutChip k="F4" label="Desconto" disabled={!isCaixaAberto || itens.length === 0 || !itemSelecionadoId} />
        <ShortcutChip k="F5" label="Cancelar Item" disabled={!isCaixaAberto || itens.length === 0 || !itemSelecionadoId} />
        <ShortcutChip k="F6" label="Cliente" disabled={!isCaixaAberto} />
        <ShortcutChip k="F9" label="Finalizar Venda" disabled={!isCaixaAberto || itens.length === 0} />
        <ShortcutChip k="F12" label="Cancelar Cupom" disabled={!isCaixaAberto || itens.length === 0} />
        <ShortcutChip k="F8" label="Fechar Caixa" disabled={!isCaixaAberto || itens.length > 0} />
        <ShortcutChip k="ESC" label="Sair do PDV" disabled={!isCaixaAberto} />
      </footer>

      {/* MODAIS */}
      {!isCaixaAberto && <ModalAberturaCaixa />}
      {modalAtivo === 'BUSCA_PRODUTO' && <ModalBuscaProduto />}
      {modalAtivo === 'QUANTIDADE' && <ModalQuantidade />}
      {modalAtivo === 'CANCELAR_ITEM' && <ModalCancelamentoItem />}
      {modalAtivo === 'CANCELAR_CUPOM' && <ModalCancelamentoCupom />}
      {modalAtivo === 'PAGAMENTO' && <ModalPagamento />}
      {modalAtivo === 'FECHAR_CAIXA' && <ModalFechamentoCaixa />}
    </div>
  );
};
