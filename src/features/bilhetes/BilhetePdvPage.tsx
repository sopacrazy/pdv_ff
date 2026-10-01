import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Menu, RefreshCw, ShoppingCart, Smartphone, User, Wifi, WifiOff, X, Zap } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';
import { useStatusInternet } from '../../hooks/useStatusInternet';
import { bilheteService, ClienteBilhete } from '../../services/bilheteService';
import { vendaService } from '../../services/vendaService';
import { Produto } from '../../types/produto';
import { ItemVenda } from '../../types/venda';
import { formatMoney, formatMoneySegundaUnidade } from '../../utils/formatters';
import { calcularTotalEmCentavos, reaisParaCentavos } from '../../utils/totalItem';
import { rotuloFilial } from '../../utils/filiais';
import { paraPrimeiraUnidade, paraSegundaUnidade, temSegundaUnidade } from '../../utils/unidades';
import { Toast } from '../../components/Toast';
import { Sidebar } from '../../components/Sidebar';
import { useImpressaoBilheteStore } from '../../store/impressaoBilheteStore';
import { estaNoAppNativo } from '../../services/apiBase';
import './bilhete-tablet.css';
import fortfruitLogo from '@/fortfruit-logo.png';

const gerarId = () => Math.random().toString(36).slice(2, 10);
const formatarQuantidade = (valor: number) => Number.isInteger(valor) ? String(valor) : String(valor).replace('.', ',');

const CampoQuantidade = ({ valor, onConfirmar, title, aoConfirmarComEnter }: { valor: number; onConfirmar: (valor: number) => void; title: string; aoConfirmarComEnter?: () => void }) => {
  const [texto, setTexto] = useState(formatarQuantidade(valor));
  const [focado, setFocado] = useState(false);

  useEffect(() => {
    if (!focado) setTexto(formatarQuantidade(valor));
  }, [focado, valor]);

  const confirmar = () => {
    const numero = Number(texto.replace(',', '.'));
    if (Number.isFinite(numero) && numero > 0) onConfirmar(numero);
    else setTexto(formatarQuantidade(valor));
  };

  return <input type="text" inputMode="decimal" title={title} aria-label={title} value={texto}
    onFocus={(evento) => { setFocado(true); evento.currentTarget.select(); }}
    onChange={(evento) => setTexto(evento.target.value)}
    onBlur={() => { setFocado(false); confirmar(); }}
    // Enter é o fluxo normal aqui: ajustou a quantidade de um item já no bilhete e quer voltar
    // direto pra escanear/digitar o próximo produto, sem precisar clicar no campo de busca.
    onKeyDown={(evento) => { if (evento.key === 'Enter') { evento.preventDefault(); confirmar(); aoConfirmarComEnter?.(); } }}
    className="w-full bg-transparent text-right tabular-nums font-bold outline-none rounded px-1.5 py-1 border border-transparent hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20" />;
};

const ShortcutChip = ({ tecla, label, disabled }: { tecla: string; label: string; disabled?: boolean }) => (
  <div className={clsx(
    'bilhete-shortcut flex items-center gap-2 px-3 py-1.5 rounded-md font-bold text-sm transition-opacity whitespace-nowrap',
    disabled ? 'bg-slate-100 text-slate-400 opacity-70' : 'bg-slate-100 text-slate-700'
  )}>
    <span className={clsx('px-1.5 py-0.5 rounded text-xs', disabled ? 'bg-slate-200 text-slate-400' : 'bg-slate-300 text-slate-800')}>{tecla}</span>
    {label}
  </div>
);

export function BilhetePdvPage() {
  const navigate = useNavigate();
  const { vendedor, loja, caixa, token } = useAuthStore();
  const { mostrarToast } = useToastStore();
  const internetOnline = useStatusInternet();
  // Só a ação (não o estado nem o efeito de impressão em si) — isso fica no App.tsx, no nível
  // raiz, pra sobreviver à troca de rota (ver src/hooks/useImpressaoBilheteProtheus.ts).
  const imprimirBilhete = useImpressaoBilheteStore((s) => s.imprimirBilhete);
  const [orientacaoMensagem, setOrientacaoMensagem] = useState('Para continuar a venda, gire o tablet para a posição vertical.');
  const [ativandoRetrato, setAtivandoRetrato] = useState(false);
  const [horaAtual, setHoraAtual] = useState(new Date());
  const [cliente, setCliente] = useState<ClienteBilhete | null>(null);
  const [buscaCliente, setBuscaCliente] = useState('');
  const [clientes, setClientes] = useState<ClienteBilhete[]>([]);
  const [clienteSelecionado, setClienteSelecionado] = useState(0);
  const [nomeClienteAVista, setNomeClienteAVista] = useState('');
  const [buscaProduto, setBuscaProduto] = useState('');
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [produtoSelecionado, setProdutoSelecionado] = useState(0);
  const [itens, setItens] = useState<ItemVenda[]>([]);
  const [itemSelecionadoId, setItemSelecionadoId] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [mensagemBusca, setMensagemBusca] = useState('');
  const [finalizando, setFinalizando] = useState(false);
  const [bloqueios, setBloqueios] = useState<string[]>([]);
  const [menuAberto, setMenuAberto] = useState(false);
  const inputProduto = useRef<HTMLInputElement>(null);
  const inputNomeClienteAVista = useRef<HTMLInputElement>(null);
  const listaProdutos = useRef<HTMLDivElement>(null);
  const listaClientes = useRef<HTMLDivElement>(null);
  const sequenciaBusca = useRef(0);

  const limparBilhete = useCallback((focarProduto = true) => {
    setItens([]);
    setItemSelecionadoId(null);
    setBuscaProduto('');
    setProdutos([]);
    if (focarProduto) inputProduto.current?.focus();
  }, []);

  const selecionarCliente = useCallback((resultado: ClienteBilhete) => {
    setCliente(resultado);
    setClientes([]);
    setClienteSelecionado(0);
    // Atualiza o snapshot calculado pela REST (saldo de crédito e inadimplência) assim que o
    // cliente entra no Bilhete. A confirmação continua usando exclusivamente o SQLite local.
    void bilheteService.sincronizarFinanceiroCliente(resultado, token).catch(() => undefined);
    setBuscaCliente('');
    setNomeClienteAVista('');
    limparBilhete(false);
  }, [limparBilhete, token]);

  // Atalho pro chip "À VISTA" — mesmo cliente padrão que já era selecionado automaticamente ao
  // digitar "0001" (ver efeito de busca abaixo), só que sem precisar digitar nada.
  const selecionarClienteAVista = useCallback(async () => {
    if (!token) return;
    const resultados = await bilheteService.buscarClientes('0001', token);
    const avista = resultados.find(
      (resultado) => (resultado.codigo.trim() === '0001' || resultado.codigo.trim() === '000001') && resultado.loja.trim() === '01'
    );
    if (avista) selecionarCliente(avista);
    else mostrarToast('Cliente à vista (0001) não encontrado no cache. Sincronize os clientes.', 'erro');
  }, [token, selecionarCliente, mostrarToast]);

  // O campo de nome só existe após o cliente ser renderizado. Um único efeito
  // define o foco, sem disputar com o foco da limpeza do bilhete.
  useEffect(() => {
    if (!cliente) return;
    const avista = cliente.codigo.trim() === '0001' || cliente.codigo.trim() === '000001';
    (avista ? inputNomeClienteAVista.current : inputProduto.current)?.focus();
  }, [cliente]);

  useEffect(() => {
    const timer = setInterval(() => setHoraAtual(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!token || buscaCliente.trim().length < 2 || cliente) {
      setClientes([]);
      return;
    }
    let cancelado = false;
    const termo = buscaCliente.trim();
    const timer = setTimeout(async () => {
      const resultados = await bilheteService.buscarClientes(termo, token);
      if (cancelado) return;
      // 0001 é o cliente padrão A VISTA da operação. Ao concluir o código, seleciona-o
      // diretamente e posiciona o operador no nome que será gravado em Z4_NOMCLI.
      if (termo === '0001' || termo === '000001') {
        const avista = resultados.find((resultado) =>
          (resultado.codigo.trim() === '0001' || resultado.codigo.trim() === '000001') && resultado.loja.trim() === '01'
        );
        if (avista) {
          selecionarCliente(avista);
          return;
        }
      }
      setClientes(resultados);
      setClienteSelecionado(0);
    }, 250);
    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [buscaCliente, cliente, selecionarCliente, token]);

  // null/undefined = saldo não sincronizado ainda pra esse produto — não bloqueia (falta de dado
  // não é o mesmo que falta de estoque). Só bloqueia quando o número existe e é insuficiente.
  const avisarSemEstoque = useCallback((produto: Produto, quantidadeDesejada: number) => {
    if (produto.saldoEstoque == null || quantidadeDesejada <= produto.saldoEstoque) return false;
    mostrarToast(`Estoque insuficiente: ${produto.descricao} tem só ${produto.saldoEstoque} ${produto.unidade} disponível.`, 'erro');
    return true;
  }, [mostrarToast]);

  const adicionarProduto = useCallback((produto: Produto) => {
    if (!cliente) {
      mostrarToast('Selecione o cliente para incluir o produto no Bilhete.', 'erro');
      return;
    }
    setItens((atuais) => {
      const existente = atuais.find((item) => item.produto.codigo === produto.codigo);
      const quantidadeAtual = existente?.quantidade ?? 0;
      if (avisarSemEstoque(produto, quantidadeAtual + 1)) return atuais;
      if (existente) {
        setItemSelecionadoId(existente.id);
        return atuais.map((item) => item.id === existente.id
          ? { ...item, quantidade: item.quantidade + 1, valorTotal: calcularTotalEmCentavos(item.quantidade + 1, item.valorUnitario) }
          : item);
      }
      const valorUnitario = reaisParaCentavos(produto.preco);
      const novo = { id: gerarId(), produto, quantidade: 1, valorUnitario, desconto: 0, valorTotal: valorUnitario };
      setItemSelecionadoId(novo.id);
      return [...atuais, novo];
    });
    setBuscaProduto('');
    setProdutos([]);
    setProdutoSelecionado(0);
    setTimeout(() => inputProduto.current?.focus(), 0);
  }, [cliente, mostrarToast, avisarSemEstoque]);

  const procurarProdutos = useCallback(async (termo: string, incluirSeUnico = false) => {
    const pesquisa = termo.trim();
    if (!token || !pesquisa) return;
    const requisicao = ++sequenciaBusca.current;
    setBuscando(true);
    setMensagemBusca('');
    const resultado = await bilheteService.buscarProdutos(cliente, pesquisa, token);
    if (requisicao !== sequenciaBusca.current) return;
    setBuscando(false);
    if (resultado.erro) {
      setProdutos([]);
      setMensagemBusca(resultado.erro);
      mostrarToast(resultado.erro, 'erro');
      return;
    }
    // A consulta por palavra-chave mostra todos os resultados com preço, inclusive sem estoque.
    // A inclusão continua validando o saldo em adicionarProduto.
    const encontrados = resultado.produtos;
    if (incluirSeUnico && encontrados.length === 1 && (encontrados[0].saldoEstoque == null || encontrados[0].saldoEstoque > 0)) {
      adicionarProduto(encontrados[0]);
      return;
    }
    setProdutos(encontrados);
    setProdutoSelecionado(0);
    if (!encontrados.length) {
      setMensagemBusca(`Nenhum produto com preço na tabela ${cliente?.tabelaPreco || '001'} encontrado para “${pesquisa}”.`);
    }
  }, [adicionarProduto, cliente, mostrarToast, token]);

  // A barra principal aceita código e descrição. Código interno completo entra direto;
  // texto ou código parcial abre a lista depois de uma breve pausa.
  useEffect(() => {
    const termo = buscaProduto.trim();
    // Invalida imediatamente a resposta anterior para nunca exibir resultados de outro termo
    // enquanto o operador já está digitando uma nova consulta.
    sequenciaBusca.current += 1;
    setBuscando(false);
    setMensagemBusca('');
    setProdutos([]);
    setProdutoSelecionado(0);
    if (!termo) {
      return;
    }
    if (/^\d{3}\.\d{3}$/.test(termo)) {
      void procurarProdutos(termo, !!cliente);
      return;
    }
    if (termo.length < 2) {
      return;
    }
    const timer = setTimeout(() => void procurarProdutos(termo), 150);
    return () => clearTimeout(timer);
  }, [buscaProduto, cliente, procurarProdutos]);

  useEffect(() => {
    const selecionado = listaProdutos.current?.children[produtoSelecionado] as HTMLElement | undefined;
    selecionado?.scrollIntoView({ block: 'nearest' });
  }, [produtoSelecionado]);

  useEffect(() => {
    const selecionado = listaClientes.current?.children[clienteSelecionado] as HTMLElement | undefined;
    selecionado?.scrollIntoView({ block: 'nearest' });
  }, [clienteSelecionado]);

  const total = useMemo(() => itens.reduce((soma, item) => soma + item.valorTotal, 0), [itens]);
  const quantidade = useMemo(() => itens.reduce((soma, item) => soma + item.quantidade, 0), [itens]);
  const clienteAVista = cliente?.codigo.trim() === '0001' || cliente?.codigo.trim() === '000001';

  const alterarQuantidade = (id: string, numero: number) => {
    setItens((atuais) => {
      const item = atuais.find((i) => i.id === id);
      if (item && avisarSemEstoque(item.produto, numero)) return atuais;
      return atuais.map((item) => item.id === id
        ? { ...item, quantidade: numero, valorTotal: calcularTotalEmCentavos(numero, item.valorUnitario) }
        : item);
    });
  };

  const alterarQuantidadeSegundaUnidade = (id: string, quantidadeSegunda: number) => {
    setItens((atuais) => {
      const item = atuais.find((i) => i.id === id);
      if (item) {
        const quantidadeConvertida = paraPrimeiraUnidade(item.produto, quantidadeSegunda);
        if (quantidadeConvertida != null && avisarSemEstoque(item.produto, quantidadeConvertida)) return atuais;
      }
      return atuais.map((item) => {
        if (item.id !== id) return item;
        const quantidadePrimeira = paraPrimeiraUnidade(item.produto, quantidadeSegunda);
        return quantidadePrimeira == null ? item : { ...item, quantidade: quantidadePrimeira, valorTotal: calcularTotalEmCentavos(quantidadePrimeira, item.valorUnitario) };
      });
    });
  };

  const removerSelecionado = useCallback(() => {
    if (!itemSelecionadoId) return;
    setItens((atuais) => atuais.filter((item) => item.id !== itemSelecionadoId));
    setItemSelecionadoId(null);
    setTimeout(() => inputProduto.current?.focus(), 0);
  }, [itemSelecionadoId]);

  const finalizar = useCallback(async () => {
    if (!token || finalizando) return;
    setFinalizando(true);
    const errosLocais = await bilheteService.validar(cliente, itens, total, nomeClienteAVista, token);
    if (errosLocais.length) {
      setBloqueios(errosLocais);
      setFinalizando(false);
      return;
    }
    if (!cliente) {
      setFinalizando(false);
      return;
    }
    const resultado = await vendaService.registrarVenda({
      numeroCupom: '', loja, caixa,
      cliente: { codigo: cliente.codigo, loja: cliente.loja, nome: cliente.nome, nomeAVista: nomeClienteAVista, cpf: cliente.cpfCnpj, tabelaPreco: cliente.tabelaPreco },
      itens, subtotal: total, desconto: 0, total,
      formaPagamento: cliente.condicaoPagamento,
      tipoOperacao: 'BILHETE',
    }, token);
    if (!resultado.sucesso || !resultado.id) {
      setBloqueios((resultado.erro || 'Não foi possível salvar o Bilhete.').split('\n').filter(Boolean));
      setFinalizando(false);
      return;
    }
    setFinalizando(false);
    setItens([]);
    setItemSelecionadoId(null);
    setCliente(null);
    setBuscaCliente('');
    setNomeClienteAVista('');
    mostrarToast(`Bilhete ${resultado.numeroCupom} validado e salvo. Enviando ao Protheus em segundo plano.`, 'sucesso');

    // A partir daqui a tela já está livre para o próximo Bilhete. A chamada continua no servidor;
    // a fila automática cobre falta de conexão ou encerramento do aplicativo durante o envio.
    //
    // Impressão: só quando integrar (número real do Protheus) OU quando a loja fica sem internet
    // (aí sai com o número local do PDV + marca d'água "PDV OFFLINE" — ver
    // BilheteImpressaoProtheus.tsx) — a loja não pode simplesmente parar de vender por falta de
    // rede. Rejeição de verdade (erro de negócio do Protheus, não de conexão) nunca imprime: o
    // bilhete foi recusado, não faz sentido entregar como se fosse válido.
    void vendaService.enviarProtheus(resultado.id, token, { rapido: true }).then((envio) => {
      if (envio.sucesso) {
        mostrarToast(`Bilhete ${envio.bilhete || resultado.numeroCupom} confirmado no Protheus`, 'sucesso');
      } else if (envio.semInternet) {
        mostrarToast(`Bilhete ${resultado.numeroCupom} sem internet — impresso com número local (PDV OFFLINE), será integrado quando a conexão voltar.`, 'erro');
      } else {
        mostrarToast(`Bilhete ${resultado.numeroCupom} rejeitado: ${envio.erro || 'consulte o retorno na tela Consultas.'}`, 'erro');
      }
      if (!estaNoAppNativo() && (envio.sucesso || envio.semInternet)) {
        void vendaService.buscarVenda(resultado.id).then((detalhe) => {
          if (detalhe) imprimirBilhete(detalhe);
        });
      }
    });
  }, [caixa, cliente, finalizando, imprimirBilhete, itens, loja, mostrarToast, nomeClienteAVista, token, total]);

  useEffect(() => {
    const atalhos = (evento: KeyboardEvent) => {
      if (finalizando || bloqueios.length || window.matchMedia('(pointer: coarse) and (orientation: landscape)').matches) return;
      if (evento.key === 'F1') {
        evento.preventDefault();
        void finalizar();
      } else if (evento.key === 'F2') {
        evento.preventDefault();
        inputProduto.current?.focus();
        inputProduto.current?.select();
      } else if (evento.key === 'Delete' && !(document.activeElement instanceof HTMLInputElement) && !(document.activeElement instanceof HTMLTextAreaElement)) {
        evento.preventDefault();
        removerSelecionado();
      } else if (evento.key === 'F12') {
        evento.preventDefault();
        limparBilhete();
      } else if (evento.key === 'Escape') {
        evento.preventDefault();
        if (produtos.length || mensagemBusca) {
          setProdutos([]);
          setMensagemBusca('');
        }
        else setMenuAberto(true);
      }
    };
    window.addEventListener('keydown', atalhos);
    return () => window.removeEventListener('keydown', atalhos);
  }, [bloqueios.length, finalizar, finalizando, limparBilhete, produtos.length, mensagemBusca, removerSelecionado]);

  const handleBuscaKeyDown = (evento: React.KeyboardEvent<HTMLInputElement>) => {
    if (evento.key === 'ArrowDown' && produtos.length) {
      evento.preventDefault();
      setProdutoSelecionado((atual) => Math.min(atual + 1, produtos.length - 1));
    } else if (evento.key === 'ArrowUp' && produtos.length) {
      evento.preventDefault();
      setProdutoSelecionado((atual) => Math.max(atual - 1, 0));
    } else if (evento.key === 'Enter') {
      evento.preventDefault();
      if (produtos[produtoSelecionado]) adicionarProduto(produtos[produtoSelecionado]);
      else void procurarProdutos(buscaProduto, !!cliente);
    } else if (evento.key === 'Escape' && (produtos.length || mensagemBusca)) {
      evento.preventDefault();
      evento.stopPropagation();
      setProdutos([]);
      setMensagemBusca('');
    }
  };

  const handleClienteKeyDown = (evento: React.KeyboardEvent<HTMLInputElement>) => {
    if (evento.key === 'ArrowDown' && clientes.length) {
      evento.preventDefault();
      setClienteSelecionado((atual) => Math.min(atual + 1, clientes.length - 1));
    } else if (evento.key === 'ArrowUp' && clientes.length) {
      evento.preventDefault();
      setClienteSelecionado((atual) => Math.max(atual - 1, 0));
    } else if (evento.key === 'Enter' && clientes[clienteSelecionado]) {
      evento.preventDefault();
      selecionarCliente(clientes[clienteSelecionado]);
    } else if (evento.key === 'Escape' && clientes.length) {
      evento.preventDefault();
      evento.stopPropagation();
      setClientes([]);
    }
  };

  const ativarModoRetrato = async () => {
    if (ativandoRetrato) return;
    setAtivandoRetrato(true);
    try {
      const orientacao = screen.orientation as ScreenOrientation & { lock?: (modo: string) => Promise<void> };
      if (!orientacao?.lock || !document.documentElement.requestFullscreen) {
        setOrientacaoMensagem('Gire o tablet para a posição vertical e ative o bloqueio de rotação nas configurações do aparelho.');
        return;
      }
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      await orientacao.lock('portrait');
    } catch {
      setOrientacaoMensagem('Este navegador não permitiu travar a orientação. Gire o tablet e ative o bloqueio de rotação nas configurações do aparelho.');
    } finally {
      setAtivandoRetrato(false);
    }
  };

  const formatadorHora = new Intl.DateTimeFormat('pt-BR', { timeStyle: 'medium' });

  return (
    <div className="bilhete-pdv flex flex-col h-screen overflow-hidden bg-slate-100 text-slate-900 font-sans">
      <Toast />
      <div className="bilhete-portrait-guard" role="dialog" aria-modal="true" aria-labelledby="bilhete-portrait-title">
        <div>
          <Smartphone size={64} className="mx-auto text-blue-600" aria-hidden="true" />
          <h2 id="bilhete-portrait-title" className="mt-5 text-2xl font-bold">Use o tablet em retrato</h2>
          <p className="mt-3 text-slate-600" role="status">{orientacaoMensagem}</p>
          <p className="mt-2 text-sm text-slate-500">Seu bilhete continua aqui ao girar a tela.</p>
          <button onClick={() => void ativarModoRetrato()} disabled={ativandoRetrato} className="mt-6 rounded-xl bg-blue-600 px-6 py-3 font-bold text-white">
            {ativandoRetrato ? 'Ativando...' : 'Ativar tela cheia em retrato'}
          </button>
          <button onClick={() => navigate('/home')} className="mt-3 block mx-auto px-6 py-3 text-sm font-bold text-slate-600">Voltar ao início</button>
        </div>
      </div>
      {bloqueios.length > 0 && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-6">
          <div role="alertdialog" aria-modal="true" aria-label="Bilhete não confirmado" className="w-full max-w-xl max-h-[85dvh] overflow-y-auto rounded-2xl bg-white shadow-2xl border border-red-200">
            <div className="bg-red-600 px-6 py-4 text-white">
              <h2 className="text-xl font-black">Bilhete não confirmado</h2>
              <p className="text-sm text-red-100">Corrija os problemas abaixo antes de tentar novamente.</p>
            </div>
            <ul className="space-y-3 p-6 text-slate-800">
              {bloqueios.map((erro, indice) => <li key={indice} className="flex gap-3 rounded-lg bg-red-50 p-3"><span className="font-black text-red-600">!</span><span>{erro}</span></li>)}
            </ul>
            <div className="flex justify-end border-t bg-slate-50 px-6 py-4">
              <button autoFocus onClick={() => setBloqueios([])} className="rounded-lg bg-slate-800 px-6 py-2.5 font-bold text-white">Entendi</button>
            </div>
          </div>
        </div>
      )}
      {finalizando && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-6" role="dialog" aria-modal="true" aria-label="Validando Bilhete">
          <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-2xl border border-slate-200">
            <RefreshCw size={48} className="mx-auto animate-spin text-blue-600" />
            <h2 className="mt-5 text-2xl font-black text-slate-900">Validando Bilhete...</h2>
            <p className="mt-2 text-slate-600">Aguarde a conferência das regras e o salvamento local.</p>
            <p className="mt-4 text-sm font-bold text-amber-700">Não feche nem interrompa esta operação.</p>
          </div>
        </div>
      )}

      <header className="bilhete-header h-16 shrink-0 bg-white border-b border-slate-200 grid grid-cols-3 items-center px-6 z-20 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => setMenuAberto(true)} className="shrink-0 p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors" title="Menu (ESC)">
            <Menu size={20} />
          </button>
          <div className="min-w-0">
            <div className="font-bold text-lg text-slate-500 tracking-wider truncate">CAIXA <span className="text-slate-800">{caixa}</span> · LOJA <span className="text-slate-800">{rotuloFilial(loja)}</span></div>
            <button onClick={() => setMenuAberto(true)} className="text-xs font-bold text-blue-600 hover:text-blue-700">ESC · Menu</button>
          </div>
        </div>
        <div className="justify-self-center font-black text-2xl text-slate-800 tracking-widest bg-slate-100 px-6 py-1.5 rounded-lg border border-slate-200">NOVO <span className="text-blue-600">BILHETE</span></div>
        <div className="justify-self-end text-right flex flex-col justify-center">
          <div className="font-bold text-sm uppercase tracking-wide text-slate-800">{vendedor?.nome}</div>
          <div className="text-sm text-slate-500 font-mono">{formatadorHora.format(horaAtual)}</div>
        </div>
      </header>

      <main className="bilhete-main flex-1 flex overflow-hidden">
        <section className="bilhete-workspace flex-[6.5] flex flex-col min-w-0 border-r border-slate-200 relative bg-white">

          <div className="bilhete-toolbar" data-cliente-avista={clienteAVista}>
          <div className="bilhete-client-section"><label htmlFor="input-cliente-bilhete" className="bilhete-field-label">1. Cliente do bilhete</label>
            <div className="bilhete-client shrink-0 bg-slate-200/50 rounded-lg p-3 relative">
              <div className="flex items-center gap-3 text-slate-700">
                <User size={20} className="text-slate-500" />
                {!cliente ? <input id="input-cliente-bilhete" aria-label="Buscar cliente por código, nome ou CPF/CNPJ" value={buscaCliente} onChange={(evento) => setBuscaCliente(evento.target.value)} onKeyDown={handleClienteKeyDown} placeholder="Código, nome ou CPF/CNPJ do cliente" className="w-full bg-transparent outline-none text-sm font-medium placeholder-slate-500" /> : <div className="min-w-0 flex-1"><strong className="block truncate text-xs">{cliente.nome}</strong><span className="block truncate text-[11px] text-slate-500">{cliente.codigo}/{cliente.loja} · {cliente.cpfCnpj}</span></div>}
                {/* Atalho pro cliente padrão 0001 — a maioria dos bilhetes sai à vista, sem precisar digitar o código. */}
                {!cliente && (
                  <button
                    type="button"
                    onClick={selecionarClienteAVista}
                    className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-100 text-amber-800 text-xs font-bold hover:bg-amber-200 transition-colors"
                  >
                    <Zap size={12} /> À VISTA
                  </button>
                )}
                {cliente && <button onClick={() => { setCliente(null); setNomeClienteAVista(''); limparBilhete(); }} className="text-xs font-bold text-blue-600">Trocar</button>}
              </div>
              {!cliente && clientes.length > 0 && <div ref={listaClientes} className="absolute left-0 right-0 top-[54px] bg-white border border-slate-200 rounded-lg shadow-2xl z-40 max-h-72 overflow-auto">{clientes.map((resultado, indice) => <button key={`${resultado.codigo}-${resultado.loja}`} onMouseEnter={() => setClienteSelecionado(indice)} onClick={() => selecionarCliente(resultado)} className={clsx('w-full text-left p-3 border-b transition-colors', clienteSelecionado === indice ? 'bg-blue-600 text-white' : 'bg-white hover:bg-blue-50')}><strong className="block">{resultado.nome}</strong><small className={clienteSelecionado === indice ? 'text-blue-100' : 'text-slate-500'}>{resultado.codigo}/{resultado.loja} · {resultado.cpfCnpj}</small></button>)}</div>}
            </div>
          </div>
          {clienteAVista && (
            <div className="bilhete-cash-name px-6 pb-4 bg-white border-b border-slate-200">
              <label htmlFor="nome-cliente-avista" className="bilhete-field-label">Nome do cliente à vista</label>
              <input
                id="nome-cliente-avista"
                ref={inputNomeClienteAVista}
                value={nomeClienteAVista}
                maxLength={40}
                onChange={(evento) => setNomeClienteAVista(evento.target.value.toUpperCase())}
                onKeyDown={(evento) => {
                  if (evento.key === 'Enter' && nomeClienteAVista.trim()) {
                    evento.preventDefault();
                    inputProduto.current?.focus();
                  }
                }}
                placeholder="Nome do cliente no bilhete"
                className="w-full h-14 rounded-xl border-2 border-amber-300 bg-amber-50 px-5 text-lg font-bold uppercase text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20"
                autoComplete="off"
              />
              <p className="mt-1 text-xs text-slate-500">Nome que aparecerá neste bilhete.</p>
            </div>
          )}
          <div className="bilhete-search p-6 bg-white shadow-sm z-20 border-b border-slate-200 relative">
            <label htmlFor="input-leitor-bilhete" className="bilhete-field-label">2. Adicione os produtos</label>
            <div className="relative">
              <input
                id="input-leitor-bilhete"
                aria-label="Buscar produto por código, código de barras ou descrição"
                ref={inputProduto}
                value={buscaProduto}
                onChange={(evento) => setBuscaProduto(evento.target.value)}
                onKeyDown={handleBuscaKeyDown}
                className="w-full h-18 text-2xl bg-slate-50 border-2 border-slate-300 focus:border-blue-500 rounded-xl px-6 text-slate-900 focus:outline-none focus:ring-4 focus:ring-blue-500/20 placeholder-slate-400 font-mono transition-all disabled:opacity-50"
                placeholder="Código, código de barras ou descrição"
                autoComplete="off"
              />
            </div>
            {buscando && <span className="bilhete-loading absolute right-10 top-12 text-sm text-slate-500">Buscando...</span>}
            {(produtos.length > 0 || mensagemBusca) && (
              <div ref={listaProdutos} className="bilhete-product-results absolute left-6 right-6 top-[86px] bg-white border border-slate-200 rounded-xl shadow-2xl z-30 max-h-80 overflow-auto">
                {mensagemBusca && <p role="status" className="px-4 py-3 text-sm text-slate-600">{mensagemBusca}</p>}
                {produtos.map((produto, indice) => (
                  <button key={produto.codigo} onMouseEnter={() => setProdutoSelecionado(indice)} onClick={() => adicionarProduto(produto)} className={clsx('w-full flex justify-between items-center px-4 py-3 border-b text-left transition-colors', produtoSelecionado === indice ? 'bg-blue-600 text-white' : 'bg-white hover:bg-blue-50 text-slate-800')}>
                    <span><strong className="text-lg">{produto.descricao}</strong><small className={clsx('block font-mono', produtoSelecionado === indice ? 'text-blue-100' : 'text-slate-500')}>Cód: {produto.codigo}{produto.codigoBarras ? ` · Barras: ${produto.codigoBarras}` : ''} · {produto.unidade}</small></span>
                    <span className="ml-auto flex shrink-0 items-center gap-5 text-right">
                      <span className={clsx('text-sm font-bold tabular-nums', produtoSelecionado === indice ? 'text-blue-100' : produto.saldoEstoque != null && produto.saldoEstoque <= 0 ? 'text-red-600' : 'text-emerald-700')}>
                        {produto.saldoEstoque != null && produto.saldoEstoque <= 0 ? 'Sem estoque · ' : 'Estoque: '}{produto.saldoEstoque == null ? '—' : `${formatarQuantidade(produto.saldoEstoque)} ${produto.unidade}`}
                      </span>
                      <strong className="min-w-28 text-xl tabular-nums">{formatMoney(reaisParaCentavos(produto.preco))}</strong>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          </div>

          <div className="bilhete-items flex-1 overflow-auto bg-white">
            {itens.length === 0 ? (
              <div className="bilhete-empty flex flex-col items-center justify-center h-full text-slate-500 gap-4">
                <ShoppingCart size={64} className="opacity-30 text-slate-400 mb-2" />
                <p className="text-xl text-slate-700 font-medium">Seu bilhete começa aqui</p>
                <p className="text-sm text-slate-500">{cliente ? 'Leia o primeiro produto ou digite sua descrição' : 'Selecione o cliente para iniciar o Bilhete'}</p>
              </div>
            ) : (
              <table className="bilhete-table w-full text-left border-collapse whitespace-nowrap">
                <thead className="sticky top-0 bg-slate-100 text-slate-600 text-base uppercase font-bold z-10 shadow-sm border-b border-slate-200">
                  <tr><th className="p-4 w-16 text-center">Item</th><th className="p-4 w-36">Código</th><th className="p-4">Descrição</th><th className="p-4 w-28 text-right">Qtd</th><th className="p-4 w-16 text-center">UN</th><th className="p-4 w-28 text-right">Qtd 2ª</th><th className="p-4 w-16 text-center">UN 2ª</th><th className="p-4 w-32 text-right">Vl. Unit</th><th className="p-4 w-32 text-right">Preço 2ª un.</th><th className="p-4 w-36 text-right pr-6">Total</th><th className="w-12" /></tr>
                </thead>
                <tbody className="font-mono text-2xl text-slate-800">
                  {itens.map((item, indice) => (
                    <tr key={item.id} data-segunda-unidade={temSegundaUnidade(item.produto)} onClick={() => setItemSelecionadoId(item.id)} className={clsx('border-b border-slate-100 cursor-pointer transition-all duration-200', itemSelecionadoId === item.id ? 'bg-blue-100 border-l-[6px] border-l-blue-600 ring-1 ring-inset ring-blue-200 text-blue-950' : 'hover:bg-slate-50 even:bg-slate-50/50')}>
                      <td className="p-4 text-center text-slate-400">{String(indice + 1).padStart(3, '0')}</td><td className="p-4 text-slate-500">{item.produto.codigo}</td><td className="p-4 truncate" title={item.produto.descricao}><strong className="bilhete-item-description">{item.produto.descricao}</strong><small className="bilhete-item-code">Cód. {item.produto.codigo}</small></td>
                      <td data-unidade={item.produto.unidade} className="p-1 text-right"><CampoQuantidade valor={item.quantidade} onConfirmar={(valor) => alterarQuantidade(item.id, valor)} title={`Quantidade em ${item.produto.unidade}`} aoConfirmarComEnter={() => inputProduto.current?.focus()} /></td>
                      <td className="p-4 text-center text-slate-400">{item.produto.unidade}</td>
                      <td data-unidade={item.produto.segundaUnidade} className="p-1 text-right">{temSegundaUnidade(item.produto) ? <CampoQuantidade valor={paraSegundaUnidade(item.produto, item.quantidade) ?? 0} onConfirmar={(valor) => alterarQuantidadeSegundaUnidade(item.id, valor)} title={`Quantidade em ${item.produto.segundaUnidade}`} aoConfirmarComEnter={() => inputProduto.current?.focus()} /> : <span title="Produto sem segunda unidade ou fator de conversão cadastrado">Sem 2ª un.</span>}</td>
                      <td className="p-4 text-center text-slate-400">{temSegundaUnidade(item.produto) ? item.produto.segundaUnidade : <span className="text-slate-300">—</span>}</td>
                      <td data-label="Valor unitário" className="p-4 text-right tabular-nums font-bold">{formatMoney(item.valorUnitario)}</td>
                      <td data-label={`Preço 2ª un.${temSegundaUnidade(item.produto) ? ` (${item.produto.segundaUnidade})` : ''}`} title={temSegundaUnidade(item.produto) ? `Preço por ${item.produto.segundaUnidade} na tabela ${cliente?.tabelaPreco}` : 'Produto sem segunda unidade'} className="p-4 text-right tabular-nums font-bold">{temSegundaUnidade(item.produto) && item.produto.precoSegundaUnidade != null ? formatMoneySegundaUnidade(item.produto.precoSegundaUnidade) : <span className="text-slate-400">—</span>}</td>
                      <td data-label="Total do item" className="p-4 text-right tabular-nums font-bold pr-6">{formatMoney(item.valorTotal)}</td>
                      <td className="pr-3"><button onClick={(evento) => { evento.stopPropagation(); setItens((atuais) => atuais.filter((atual) => atual.id !== item.id)); }} className="text-red-500 hover:text-red-700" aria-label={`Remover ${item.produto.descricao}`} title="Remover item"><X size={18} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <aside className="bilhete-summary w-[420px] shrink-0 bg-slate-50 flex flex-col border-l border-slate-200 h-full min-h-0">
          <div className="flex-1 min-h-0 overflow-y-auto flex flex-col p-4 gap-4">


            <div className="bilhete-brand shrink-0 bg-white p-8 rounded-xl border border-slate-200 shadow-sm flex items-center justify-center"><img src={fortfruitLogo} alt="Fort Fruit" className="max-h-24 object-contain" /></div>

            {cliente && <details className="bilhete-client-details shrink-0 bg-white border border-slate-200 rounded-xl p-4 text-sm space-y-3"><summary className="font-bold cursor-pointer">Condições do cliente</summary>
              <div className="flex justify-between gap-4"><span className="text-slate-500">Condição</span><strong className="text-right">{cliente.condicaoPagamento} {cliente.condicaoDescricao}</strong></div>
              <div className="flex justify-between gap-4"><span className="text-slate-500">Tabela</span><strong className="text-right">{cliente.tabelaPreco} {cliente.tabelaDescricao}</strong></div>
              <div className="flex justify-between gap-4"><span className="text-slate-500">Limite cadastrado</span><strong>{formatMoney(cliente.limiteCredito)}</strong></div>
              {cliente.vencimentoMaisAntigo && <div className="flex gap-2 text-amber-700 bg-amber-50 p-2 rounded"><AlertTriangle size={16} className="shrink-0" /><span>Há histórico financeiro com vencimento em {cliente.vencimentoMaisAntigo}.</span></div>}
            </details>}

            <div className="bilhete-counts shrink-0 flex flex-col gap-3 text-lg">
              <div className="flex justify-between items-center text-slate-600"><span>Itens no Bilhete</span><span className="font-mono font-bold text-slate-800">{formatarQuantidade(quantidade)}</span></div>
              <div className="flex justify-between items-center text-slate-600"><span>Subtotal</span><span className="font-mono font-bold tabular-nums text-slate-800">{formatMoney(total)}</span></div>
            </div>
          </div>
          <div className="bilhete-total shrink-0 p-4 pt-0"><div className="bg-green-600 text-white rounded-2xl p-5 flex flex-col justify-center shadow-[0_8px_30px_rgb(22,163,74,0.3)] border border-green-500"><div className="font-black uppercase tracking-widest text-sm opacity-90">Total do Bilhete</div><div className="text-[44px] leading-none font-black tracking-tighter mt-2 tabular-nums">{formatMoney(total)}</div></div></div>
        </aside>
      </main>

      <footer className="bilhete-footer min-h-14 shrink-0 bg-white flex flex-wrap items-center px-3 py-2 gap-2 border-t border-slate-200">
        <button onClick={() => void finalizar()} disabled={finalizando || !cliente || itens.length === 0} className="bilhete-confirm"><ShortcutChip tecla="F1" label={finalizando ? 'Validando no Protheus...' : 'Confirmar Bilhete'} disabled={finalizando || !cliente || itens.length === 0} /></button>
        <button onClick={() => { inputProduto.current?.focus(); inputProduto.current?.select(); }} className="bilhete-secondary"><ShortcutChip tecla="F2" label="Buscar Produto" /></button>
        <button onClick={removerSelecionado} disabled={!itemSelecionadoId} className="bilhete-remove-selected"><ShortcutChip tecla="DEL" label="Cancelar Item" disabled={!itemSelecionadoId} /></button>
        <button onClick={() => limparBilhete()} disabled={itens.length === 0} className="bilhete-cancel"><ShortcutChip tecla="F12" label="Cancelar Bilhete" disabled={itens.length === 0} /></button>
        <button onClick={() => setMenuAberto(true)} className="bilhete-secondary"><ShortcutChip tecla="ESC" label="Menu" /></button>
        <div className="bilhete-status ml-auto flex items-center gap-1.5">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md font-bold text-xs whitespace-nowrap bg-slate-100 text-slate-500" title="Dados do Bilhete sincronizados automaticamente a cada 5 minutos"><RefreshCw size={13} /> Cache a cada 5 min</div>
          <div className={clsx('flex items-center p-1.5 rounded-md', internetOnline ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700')} title={internetOnline ? 'Conexão com o Protheus disponível' : 'Sem conexão com o Protheus'}>{internetOnline ? <Wifi size={14} /> : <WifiOff size={14} />}</div>
        </div>
      </footer>

      <Sidebar rotaAtiva="/bilhetes" aberta={menuAberto} aoFechar={() => setMenuAberto(false)} />
    </div>
  );
}
