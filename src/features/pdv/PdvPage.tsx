import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { rotuloFilial } from '../../utils/filiais';
import { usePdvStore } from '../../store/pdvStore';
import { useToastStore } from '../../store/toastStore';
import { useAtalhos } from '../../hooks/useAtalhos';
import { useFocoLeitor } from '../../hooks/useFocoLeitor';
import { useStatusInternet } from '../../hooks/useStatusInternet';
import { useUltimaSincronizacao } from '../../hooks/useUltimaSincronizacao';
import { produtoService } from '../../services/produtoService';
import { clienteService } from '../../services/clienteService';
import { vendaService } from '../../services/vendaService';
import { Wifi, WifiOff, RefreshCw, Pencil } from 'lucide-react';

import { ItensVenda } from './ItensVenda';
import { PainelTotais } from './PainelTotais';
import { Toast } from '../../components/Toast';
import { ReciboTermico } from '../../components/ReciboTermico';
import { useImpressaoCupom } from '../../hooks/useImpressaoCupom';

// Modais
import { ModalAberturaCaixa } from './modais/ModalAberturaCaixa';
import { ModalBuscaProduto } from './modais/ModalBuscaProduto';
import { ModalCancelamentoItem } from './modais/ModalCancelamentoItem';
import { ModalCancelamentoCupom } from './modais/ModalCancelamentoCupom';
import { ModalPagamento } from './modais/ModalPagamento';
import { ModalDataOperacao } from './modais/ModalDataOperacao';
import { clsx } from 'clsx';

export const PdvPage = () => {
  const { vendedor, loja, caixa } = useAuthStore();
  const {
    isCaixaAberto, dataOperacao,
    cupomNumero, modalAtivo, setModalAtivo, itens, itemSelecionadoId,
    selecionarAnterior, selecionarProximo, adicionarItem, definirClientePadrao, definirCupomNumero,
  } = usePdvStore();
  const [modalDataOperacaoAberto, setModalDataOperacaoAberto] = useState(false);
  const { mostrarToast } = useToastStore();
  const navigate = useNavigate();
  const internetOnline = useStatusInternet();
  const ultimaSincronizacao = useUltimaSincronizacao();
  // Por enquanto isso abre o diálogo de impressão do navegador (salvar em PDF) a cada venda
  // finalizada — quando o agent de impressão térmica existir, só o hook precisa mudar.
  const { vendaParaImprimir, imprimirPorId } = useImpressaoCupom();

  const [horaAtual, setHoraAtual] = useState(new Date());
  const [leitorValue, setLeitorValue] = useState('');
  const inputLeitorRef = useRef<HTMLInputElement>(null);

  useFocoLeitor(inputLeitorRef);

  useEffect(() => {
    const timer = setInterval(() => setHoraAtual(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    clienteService.buscarClientePadrao().then((cliente) => {
      if (cliente) definirClientePadrao(cliente);
    });
    vendaService.buscarProximoCupom().then((numero) => {
      if (numero) definirCupomNumero(numero);
    });
  }, []);

  // Handlers do Leitor
  const processarLeitura = async () => {
    if (!leitorValue.trim()) return;

    const codigo = leitorValue.trim();
    const produto = await produtoService.buscarPorCodigoOuBarras(codigo);

    if (produto) {
      adicionarItem(produto, 1);
    } else {
      mostrarToast(`Produto não encontrado: ${codigo}`, 'erro');
    }

    setLeitorValue('');
  };

  // Código interno completo (padrão do catálogo: 3 dígitos, ponto, 3 dígitos, ex: 104.004) —
  // adiciona direto assim que fica completo, sem esperar Enter. Importante pro leitor de código de
  // barras: ele "digita" rápido e nem sempre manda Enter depois; e agiliza quando o operador digita
  // o código curto de cabeça (comum em hortifruti, produto sem etiqueta de barras).
  useEffect(() => {
    if (/^\d{3}\.\d{3}$/.test(leitorValue)) {
      processarLeitura();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leitorValue]);

  const handleLeitorKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      processarLeitura();
    }
  };

  const itemSemPreco = itens.find((item) => !item.valorUnitario || item.valorUnitario <= 0);

  // Atalhos Globais
  const semModalAberto = isCaixaAberto && modalAtivo === 'NENHUM';
  useAtalhos({
    'F1': () => {
      if (!semModalAberto || itens.length === 0) return;
      if (itemSemPreco) {
        mostrarToast(`Não é possível finalizar: ${itemSemPreco.produto.descricao} está sem preço`, 'erro');
        return;
      }
      setModalAtivo('PAGAMENTO');
    },
    'F2': () => semModalAberto && setModalAtivo('BUSCA_PRODUTO'),
    'Delete': () => {
      if (semModalAberto && itens.length > 0 && itemSelecionadoId) setModalAtivo('CANCELAR_ITEM');
    },
    'F12': () => {
      if (semModalAberto && itens.length > 0) setModalAtivo('CANCELAR_CUPOM');
    },
    'ArrowUp': () => semModalAberto && selecionarAnterior(),
    'ArrowDown': () => semModalAberto && selecionarProximo(),
    // Entra/percorre os campos de quantidade (1ª/2ª unidade) da linha selecionada, sem precisar de mouse.
    // Seta pra direita: de fora entra na Qtd; da Qtd vai pra Qtd 2ª (se o produto tiver 2ª unidade).
    'ArrowRight': () => {
      if (!semModalAberto || !itemSelecionadoId) return;
      const ativo = document.activeElement;
      const campo1 = document.getElementById(`qtd-1-${itemSelecionadoId}`);
      const campo2 = document.getElementById(`qtd-2-${itemSelecionadoId}`);
      if (ativo === campo1) {
        campo2?.focus();
      } else if (ativo !== campo2) {
        campo1?.focus();
      }
    },
    // Seta pra esquerda: da Qtd 2ª volta pra Qtd; da Qtd volta pro campo de leitura.
    'ArrowLeft': () => {
      if (!semModalAberto || !itemSelecionadoId) return;
      const ativo = document.activeElement;
      const campo1 = document.getElementById(`qtd-1-${itemSelecionadoId}`);
      const campo2 = document.getElementById(`qtd-2-${itemSelecionadoId}`);
      if (ativo === campo2) {
        campo1?.focus();
      } else if (ativo === campo1) {
        inputLeitorRef.current?.focus();
      }
    },
    'Escape': () => semModalAberto && navigate('/home'),
  });

  const formatadorHora = new Intl.DateTimeFormat('pt-BR', { timeStyle: 'medium' });
  const formatadorSync = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const formatadorSyncCompleto = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });

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
    <>
    <div className="flex flex-col h-screen overflow-hidden bg-slate-100 text-slate-900 font-sans print:hidden">
      <Toast />

      {/* TOPO */}
      <header className="h-16 shrink-0 bg-white border-b border-slate-200 flex items-center justify-between px-6 z-20 shadow-sm">
        <div>
          <div className="font-bold text-lg text-slate-500 tracking-wider">
            CAIXA <span className="text-slate-800">{caixa}</span> &middot; LOJA <span className="text-slate-800">{rotuloFilial(loja)}</span>
          </div>
          <button
            onClick={() => setModalDataOperacaoAberto(true)}
            className={clsx(
              'flex items-center gap-1.5 text-xs font-bold transition-colors',
              dataOperacao ? 'text-amber-600 hover:text-amber-700' : 'text-slate-400 hover:text-slate-600'
            )}
            title="Alterar a data de operação (fechamento/Protheus)"
          >
            <Pencil size={11} />
            {dataOperacao
              ? `Operação: ${dataOperacao.split('-').reverse().join('/')}`
              : 'Data de operação: automática'}
          </button>
        </div>
        <div className="font-black text-2xl text-slate-800 tracking-widest bg-slate-100 px-6 py-1.5 rounded-lg border border-slate-200">
          CUPOM Nº <span className="text-blue-600">{cupomNumero || '...'}</span>
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
          <div className="p-6 bg-white shadow-sm z-20 border-b border-slate-200 relative">
            <input
              id="input-leitor"
              ref={inputLeitorRef}
              value={leitorValue}
              onChange={(e) => setLeitorValue(e.target.value.replace(/[^0-9.]/g, ''))}
              onKeyDown={handleLeitorKeyDown}
              disabled={!isCaixaAberto}
              className="w-full h-18 text-2xl bg-slate-50 border-2 border-slate-300 focus:border-blue-500 rounded-xl px-6 text-slate-900 focus:outline-none focus:ring-4 focus:ring-blue-500/20 placeholder-slate-400 font-mono transition-all disabled:opacity-50"
              placeholder="Código de barras ou código do produto — somente números e ponto · F2 busca por nome"
              inputMode="decimal"
              pattern="[0-9.]*"
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
      <footer className="min-h-14 shrink-0 bg-white flex flex-wrap items-center px-3 py-2 gap-2 border-t border-slate-200">
        <ShortcutChip k="F1" label="Finalizar Venda" disabled={!isCaixaAberto || itens.length === 0 || !!itemSemPreco} />
        <ShortcutChip k="F2" label="Buscar Produto" disabled={!isCaixaAberto} />
        <ShortcutChip k="DEL" label="Cancelar Item" disabled={!isCaixaAberto || itens.length === 0 || !itemSelecionadoId} />
        <ShortcutChip k="F12" label="Cancelar Cupom" disabled={!isCaixaAberto || itens.length === 0} />
        <ShortcutChip k="ESC" label="Sair do PDV" disabled={!isCaixaAberto} />

        <div className="ml-auto flex items-center gap-1.5">
          <div
            className="flex items-center gap-1.5 px-2 py-1 rounded-md font-bold text-xs whitespace-nowrap bg-slate-100 text-slate-500"
            title={
              ultimaSincronizacao
                ? `Última sincronização com o Protheus: ${formatadorSyncCompleto.format(ultimaSincronizacao)}`
                : 'Ainda não sincronizou com o Protheus'
            }
          >
            <RefreshCw size={13} />
            {ultimaSincronizacao ? formatadorSync.format(ultimaSincronizacao) : 'Sem sincronização'}
          </div>

          <div
            className={clsx(
              'flex items-center p-1.5 rounded-md',
              internetOnline ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
            )}
            title={
              internetOnline
                ? 'Internet OK — envio ao Protheus deve funcionar'
                : 'Sem internet — vendas continuam salvando local e são enviadas ao Protheus quando a conexão voltar'
            }
          >
            {internetOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
          </div>
        </div>
      </footer>

      {/* MODAIS */}
      {!isCaixaAberto && <ModalAberturaCaixa />}
      {modalAtivo === 'BUSCA_PRODUTO' && <ModalBuscaProduto />}
      {modalAtivo === 'CANCELAR_ITEM' && <ModalCancelamentoItem />}
      {modalAtivo === 'CANCELAR_CUPOM' && <ModalCancelamentoCupom />}
      {modalAtivo === 'PAGAMENTO' && <ModalPagamento aoFinalizarImprimir={imprimirPorId} />}
      {modalDataOperacaoAberto && <ModalDataOperacao aoFechar={() => setModalDataOperacaoAberto(false)} />}
    </div>
    {/* Fora do wrapper print:hidden acima — só isto aparece quando a impressão dispara. */}
    {vendaParaImprimir && <ReciboTermico venda={vendaParaImprimir} />}
    </>
  );
};
