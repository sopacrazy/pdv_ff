import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { usePdvStore } from '../../store/pdvStore';
import { useToastStore } from '../../store/toastStore';
import { useAtalhos } from '../../hooks/useAtalhos';
import { useFocoLeitor } from '../../hooks/useFocoLeitor';
import { useStatusConexao } from '../../hooks/useStatusConexao';
import { useUltimaSincronizacao } from '../../hooks/useUltimaSincronizacao';
import { produtoService } from '../../services/produtoService';
import { clienteService } from '../../services/clienteService';
import { vendaService } from '../../services/vendaService';
import { Produto } from '../../types/produto';
import { Wifi, WifiOff, Search, RefreshCw } from 'lucide-react';
import { formatMoney } from '../../utils/formatters';

import { ItensVenda } from './ItensVenda';
import { PainelTotais } from './PainelTotais';
import { Toast } from '../../components/Toast';
import { ReciboTermico } from '../../components/ReciboTermico';
import { useImpressaoCupom } from '../../hooks/useImpressaoCupom';

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
    selecionarAnterior, selecionarProximo, adicionarItem, definirClientePadrao, definirCupomNumero,
  } = usePdvStore();
  const { mostrarToast } = useToastStore();
  const navigate = useNavigate();
  const online = useStatusConexao();
  const ultimaSincronizacao = useUltimaSincronizacao();
  // Por enquanto isso abre o diálogo de impressão do navegador (salvar em PDF) a cada venda
  // finalizada — quando o agent de impressão térmica existir, só o hook precisa mudar.
  const { vendaParaImprimir, imprimirPorId } = useImpressaoCupom();

  const [horaAtual, setHoraAtual] = useState(new Date());
  const [leitorValue, setLeitorValue] = useState('');
  const [sugestoes, setSugestoes] = useState<Produto[]>([]);
  const [sugestaoIndex, setSugestaoIndex] = useState(0);
  const inputLeitorRef = useRef<HTMLInputElement>(null);
  const listaSugestoesRef = useRef<HTMLDivElement>(null);

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
  const extrairQtdECodigo = (valor: string) => {
    const match = valor.match(/^(\d+)[\*xX](.+)$/);
    return {
      qtd: match ? parseFloat(match[1]) || 1 : 1,
      termo: (match ? match[2] : valor).trim(),
    };
  };

  const processarLeitura = async () => {
    if (!leitorValue.trim()) return;

    const { qtd, termo: codigo } = extrairQtdECodigo(leitorValue);
    const produto = await produtoService.buscarPorCodigoOuBarras(codigo);

    if (produto) {
      adicionarItem(produto, qtd);
    } else {
      mostrarToast(`Produto não encontrado: ${codigo}`, 'erro');
    }

    setLeitorValue('');
    setSugestoes([]);
  };

  const selecionarSugestao = (produto: Produto) => {
    const { qtd } = extrairQtdECodigo(leitorValue);
    adicionarItem(produto, qtd);
    setLeitorValue('');
    setSugestoes([]);
  };

  // Código interno completo (padrão do catálogo: 3 dígitos, ponto, 3 dígitos, ex: 104.004) —
  // adiciona direto assim que fica completo, sem esperar Enter. Importante pro leitor de código de
  // barras: ele "digita" rápido e nem sempre manda Enter depois; e agiliza quando o operador digita
  // o código curto de cabeça (comum em hortifruti, produto sem etiqueta de barras).
  useEffect(() => {
    const { termo } = extrairQtdECodigo(leitorValue);
    if (/^\d{3}\.\d{3}$/.test(termo)) {
      processarLeitura();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leitorValue]);

  // Busca por descrição (like) enquanto digita, para achar produtos sem saber o código exato
  useEffect(() => {
    const { termo } = extrairQtdECodigo(leitorValue);

    if (termo.length < 2) {
      setSugestoes([]);
      return;
    }

    const timer = setTimeout(async () => {
      const resultados = await produtoService.buscarPorDescricao(termo);
      setSugestoes(resultados);
      setSugestaoIndex(0);
    }, 250);

    return () => clearTimeout(timer);
  }, [leitorValue]);

  // Mantém o item destacado do dropdown visível ao navegar com as setas
  useEffect(() => {
    const selecionado = listaSugestoesRef.current?.children[sugestaoIndex] as HTMLElement | undefined;
    selecionado?.scrollIntoView({ block: 'nearest' });
  }, [sugestaoIndex]);

  const handleLeitorKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (sugestoes.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSugestaoIndex((i) => Math.min(i + 1, sugestoes.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSugestaoIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setSugestoes([]);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        selecionarSugestao(sugestoes[sugestaoIndex]);
        return;
      }
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      processarLeitura();
    }
  };

  const itemSemPreco = itens.find((item) => !item.valorUnitario || item.valorUnitario <= 0);

  // Atalhos Globais
  const semModalAberto = isCaixaAberto && modalAtivo === 'NENHUM';
  useAtalhos({
    'F2': () => semModalAberto && setModalAtivo('BUSCA_PRODUTO'),
    'F3': () => {
      if (semModalAberto && itens.length > 0 && itemSelecionadoId) setModalAtivo('QUANTIDADE');
    },
    'F4': () => semModalAberto && mostrarToast('Desconto (Em desenvolvimento)', 'info'),
    'Delete': () => {
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
    'F1': () => {
      if (!semModalAberto || itens.length === 0) return;
      if (itemSemPreco) {
        mostrarToast(`Não é possível finalizar: ${itemSemPreco.produto.descricao} está sem preço`, 'erro');
        return;
      }
      setModalAtivo('PAGAMENTO');
    },
    'F12': () => {
      if (semModalAberto && itens.length > 0) setModalAtivo('CANCELAR_CUPOM');
    },
    'ArrowUp': () => semModalAberto && sugestoes.length === 0 && selecionarAnterior(),
    'ArrowDown': () => semModalAberto && sugestoes.length === 0 && selecionarProximo(),
    // Entra/percorre os campos de quantidade (1ª/2ª unidade) da linha selecionada, sem precisar de mouse.
    // Seta pra direita: de fora entra na Qtd; da Qtd vai pra Qtd 2ª (se o produto tiver 2ª unidade).
    'ArrowRight': () => {
      if (!semModalAberto || sugestoes.length > 0 || !itemSelecionadoId) return;
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
      if (!semModalAberto || sugestoes.length > 0 || !itemSelecionadoId) return;
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
      "flex items-center gap-1.5 px-2 py-1 rounded-md font-bold text-xs transition-opacity whitespace-nowrap",
      disabled ? "bg-slate-100 text-slate-400 opacity-70" : "bg-slate-100 text-slate-700"
    )}>
      <span className={clsx("px-1 py-0.5 rounded text-[10px]", disabled ? "bg-slate-200 text-slate-400" : "bg-slate-300 text-slate-800")}>{k}</span>
      {label}
    </div>
  );

  return (
    <>
    <div className="flex flex-col h-screen overflow-hidden bg-slate-100 text-slate-900 font-sans print:hidden">
      <Toast />

      {/* TOPO */}
      <header className="h-16 shrink-0 bg-white border-b border-slate-200 flex items-center justify-between px-6 z-20 shadow-sm">
        <div className="font-bold text-lg text-slate-500 tracking-wider">
          CAIXA <span className="text-slate-800">{caixa}</span> &middot; LOJA <span className="text-slate-800">{loja}</span>
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
              onChange={(e) => setLeitorValue(e.target.value)}
              onKeyDown={handleLeitorKeyDown}
              disabled={!isCaixaAberto}
              className="w-full h-18 text-2xl bg-slate-50 border-2 border-slate-300 focus:border-blue-500 rounded-xl px-6 text-slate-900 focus:outline-none focus:ring-4 focus:ring-blue-500/20 placeholder-slate-400 font-mono transition-all disabled:opacity-50"
              placeholder="Código de barras, código do produto ou descrição (Ex: 3*1234 ou Uva)"
              autoComplete="off"
            />

            {extrairQtdECodigo(leitorValue).termo.length >= 2 && (
              <div
                ref={listaSugestoesRef}
                className="absolute left-6 right-6 top-full mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl z-30 max-h-80 overflow-auto"
              >
                {sugestoes.length === 0 ? (
                  <div className="px-5 py-4 text-slate-400 text-sm flex items-center gap-2">
                    <Search size={16} />
                    Nenhum produto encontrado.
                  </div>
                ) : (
                  sugestoes.map((produto, idx) => (
                    <button
                      key={produto.codigo}
                      onClick={() => selecionarSugestao(produto)}
                      onMouseEnter={() => setSugestaoIndex(idx)}
                      className={clsx(
                        'w-full flex justify-between items-center px-5 py-3 text-left transition-colors border-b border-slate-100 last:border-0',
                        sugestaoIndex === idx ? 'bg-blue-600 text-white' : 'hover:bg-slate-50 text-slate-700'
                      )}
                    >
                      <div className="flex flex-col">
                        <span className="font-bold">{produto.descricao}</span>
                        <span className={clsx('text-xs font-mono', sugestaoIndex === idx ? 'text-blue-100' : 'text-slate-400')}>
                          Cód: {produto.codigo}
                        </span>
                      </div>
                      <span className="font-bold tabular-nums">{formatMoney(Math.round(produto.preco * 100))}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <div className="flex-1 overflow-hidden relative">
            <ItensVenda />
          </div>
        </div>

        {/* DIREITA */}
        <PainelTotais />
      </main>

      {/* RODAPÉ */}
      <footer className="min-h-12 shrink-0 bg-white flex flex-wrap items-center px-3 py-1.5 gap-1.5 border-t border-slate-200">
        <ShortcutChip k="F2" label="Buscar Produto" disabled={!isCaixaAberto} />
        <ShortcutChip k="F3" label="Quantidade" disabled={!isCaixaAberto || itens.length === 0 || !itemSelecionadoId} />
        <ShortcutChip k="F4" label="Desconto" disabled={!isCaixaAberto || itens.length === 0 || !itemSelecionadoId} />
        <ShortcutChip k="DEL" label="Cancelar Item" disabled={!isCaixaAberto || itens.length === 0 || !itemSelecionadoId} />
        <ShortcutChip k="F6" label="Cliente" disabled={!isCaixaAberto} />
        <ShortcutChip k="F1" label="Finalizar Venda" disabled={!isCaixaAberto || itens.length === 0 || !!itemSemPreco} />
        <ShortcutChip k="F12" label="Cancelar Cupom" disabled={!isCaixaAberto || itens.length === 0} />
        <ShortcutChip k="F8" label="Fechar Caixa" disabled={!isCaixaAberto || itens.length > 0} />
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
              'flex items-center gap-1.5 px-2 py-1 rounded-md font-bold text-xs whitespace-nowrap',
              online ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            )}
            title={online ? 'Conectado ao servidor local' : 'Trabalhando offline — usando cache local'}
          >
            {online ? <Wifi size={14} /> : <WifiOff size={14} />}
            {online ? 'Online' : 'Offline'}
          </div>
        </div>
      </footer>

      {/* MODAIS */}
      {!isCaixaAberto && <ModalAberturaCaixa />}
      {modalAtivo === 'BUSCA_PRODUTO' && <ModalBuscaProduto />}
      {modalAtivo === 'QUANTIDADE' && <ModalQuantidade />}
      {modalAtivo === 'CANCELAR_ITEM' && <ModalCancelamentoItem />}
      {modalAtivo === 'CANCELAR_CUPOM' && <ModalCancelamentoCupom />}
      {modalAtivo === 'PAGAMENTO' && <ModalPagamento aoFinalizarImprimir={imprimirPorId} />}
      {modalAtivo === 'FECHAR_CAIXA' && <ModalFechamentoCaixa />}
    </div>
    {/* Fora do wrapper print:hidden acima — só isto aparece quando a impressão dispara. */}
    {vendaParaImprimir && <ReciboTermico venda={vendaParaImprimir} />}
    </>
  );
};
