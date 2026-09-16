import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { clsx } from 'clsx';
import { ArrowLeft, Search, Trash2, ChevronDown } from 'lucide-react';
import { formatMoney } from '../../utils/formatters';
import { produtoService } from '../../services/produtoService';
import { Produto } from '../../types/produto';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';
import { useBilheteStore, CLIENTES_MOCK } from '../../store/bilheteStore';
import { Cliente, FormaPagamentoBilhete, ItemBilhete } from '../../types/bilhete';

const gerarId = () => Math.random().toString(36).substring(2, 9);

const FORMAS_PAGAMENTO: FormaPagamentoBilhete[] = ['A Vista', 'A Prazo', 'Boleto', 'PIX'];
const TRANSPORTADORAS = ['Frota Própria', 'Transp. Norte Ltda', 'Transp. Belém Express', 'Retirada pelo Cliente'];
const ROTAS = ['Rota Centro', 'Rota Sul', 'Rota Norte', 'Rota Ilha'];

// --- Estilo "TOTVS": denso, cantos retos, cinza claro nos campos travados ---
const campoCls =
  'w-full border border-slate-300 rounded-sm px-2 py-1.5 text-[13px] text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors';
const campoTravadoCls =
  'w-full border border-slate-300 rounded-sm px-2 py-1.5 text-[13px] text-slate-500 bg-slate-100 cursor-not-allowed';

function Campo({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <label className="block text-[11px] font-semibold text-slate-500 mb-0.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

export function BilheteFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { vendedor } = useAuthStore();
  const { mostrarToast } = useToastStore();
  const bilhetes = useBilheteStore((s) => s.bilhetes);
  const adicionarBilhete = useBilheteStore((s) => s.adicionarBilhete);
  const atualizarBilhete = useBilheteStore((s) => s.atualizarBilhete);

  const bilheteExistente = useMemo(() => bilhetes.find((b) => b.id === id), [bilhetes, id]);
  const modoEdicao = !!bilheteExistente;

  // --- Cliente ---
  const [clienteBusca, setClienteBusca] = useState('');
  const [clienteDropdownAberto, setClienteDropdownAberto] = useState(false);
  const [cliente, setCliente] = useState<Cliente | null>(null);

  // --- Dados do bilhete ---
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamentoBilhete>('A Vista');
  const [condicaoPagamento, setCondicaoPagamento] = useState('');

  // --- Entrega ---
  const [precisaEntrega, setPrecisaEntrega] = useState(false);
  const [transportadora, setTransportadora] = useState(TRANSPORTADORAS[0]);
  const [rota, setRota] = useState(ROTAS[0]);

  // --- Itens ---
  const [itens, setItens] = useState<ItemBilhete[]>([]);
  const [buscaProduto, setBuscaProduto] = useState('');
  const [sugestoes, setSugestoes] = useState<Produto[]>([]);
  const [desconto, setDesconto] = useState(0);

  // --- Campos só de composição visual (estilo Protheus), sem regra de negócio ainda ---
  const [nota, setNota] = useState('');
  const [serieNf, setSerieNf] = useState('');
  const [nOrcamento, setNOrcamento] = useState('');
  const horaInclusa = useMemo(() => new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), []);

  useEffect(() => {
    if (bilheteExistente) {
      setCliente(bilheteExistente.cliente);
      setData(bilheteExistente.data.slice(0, 10));
      setFormaPagamento(bilheteExistente.formaPagamento);
      setCondicaoPagamento(bilheteExistente.condicaoPagamento);
      setPrecisaEntrega(bilheteExistente.precisaEntrega);
      setTransportadora(bilheteExistente.transportadora || TRANSPORTADORAS[0]);
      setRota(bilheteExistente.rota || ROTAS[0]);
      setItens(bilheteExistente.itens);
      setDesconto(bilheteExistente.desconto);
    }
  }, [bilheteExistente]);

  useEffect(() => {
    if (buscaProduto.trim().length < 2) {
      setSugestoes([]);
      return;
    }
    const timer = setTimeout(async () => {
      const resultados = await produtoService.buscarPorDescricao(buscaProduto);
      setSugestoes(resultados);
    }, 250);
    return () => clearTimeout(timer);
  }, [buscaProduto]);

  const clientesFiltrados = clienteBusca.trim()
    ? CLIENTES_MOCK.filter(
        (c) => c.nome.toLowerCase().includes(clienteBusca.toLowerCase()) || c.codigo.includes(clienteBusca)
      )
    : CLIENTES_MOCK;

  const adicionarItem = (produto: Produto) => {
    setItens((atual) => {
      const existente = atual.find((i) => i.codigo === produto.codigo);
      if (existente) {
        return atual.map((i) =>
          i.codigo === produto.codigo
            ? { ...i, quantidade: i.quantidade + 1, total: Math.round((i.quantidade + 1) * i.precoUnitario) }
            : i
        );
      }
      const precoUnitario = Math.round(produto.preco * 100);
      const novoItem: ItemBilhete = {
        id: gerarId(),
        codigo: produto.codigo,
        descricao: produto.descricao,
        quantidade: 1,
        unidade: produto.unidade,
        precoUnitario,
        total: precoUnitario,
      };
      return [...atual, novoItem];
    });
    setBuscaProduto('');
    setSugestoes([]);
  };

  const alterarQuantidade = (itemId: string, quantidade: number) => {
    setItens((atual) =>
      atual.map((i) => (i.id === itemId ? { ...i, quantidade, total: Math.round(quantidade * i.precoUnitario) } : i))
    );
  };

  const removerItem = (itemId: string) => {
    setItens((atual) => atual.filter((i) => i.id !== itemId));
  };

  const subtotal = itens.reduce((acc, i) => acc + i.total, 0);
  const total = subtotal - desconto;
  const pesoTotal = itens.reduce((acc, i) => acc + (i.unidade === 'KG' ? i.quantidade : 0), 0);

  const podeSalvar = !!cliente && itens.length > 0;

  const salvar = (status: 'RASCUNHO' | 'CONFIRMADO') => {
    if (!cliente) {
      mostrarToast('Selecione um cliente', 'erro');
      return;
    }
    if (itens.length === 0) {
      mostrarToast('Adicione ao menos um item', 'erro');
      return;
    }

    const payload = {
      data: new Date(data).toISOString(),
      cliente,
      vendedor: vendedor?.nome || 'OPERADOR PADRÃO',
      formaPagamento,
      condicaoPagamento: condicaoPagamento || '-',
      transportadora: precisaEntrega ? transportadora : undefined,
      rota: precisaEntrega ? rota : undefined,
      precisaEntrega,
      itens,
      desconto,
      status,
    };

    if (modoEdicao && bilheteExistente) {
      atualizarBilhete(bilheteExistente.id, payload);
      mostrarToast('Bilhete atualizado', 'sucesso');
    } else {
      adicionarBilhete(payload);
      mostrarToast(status === 'RASCUNHO' ? 'Rascunho salvo' : 'Bilhete confirmado', 'sucesso');
    }
    navigate('/bilhetes');
  };

  const nomeOperador = vendedor?.nome || 'OPERADOR PADRÃO';

  return (
    <div className="min-h-screen bg-[#e4e4e4] text-slate-800 flex flex-col font-sans text-sm pb-16">
      {/* Barra superior estilo TOTVS */}
      <div className="bg-[#16233a] text-white px-4 py-2 flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/bilhetes')} className="hover:text-blue-300 transition-colors">
            <ArrowLeft size={16} />
          </button>
          <span className="font-bold tracking-wide">
            Bilhete [{modoEdicao ? bilheteExistente?.numero : '02.9.0003'}]
          </span>
        </div>
        <div className="text-slate-400">PDV Fort Fruit &middot; {nomeOperador}</div>
      </div>

      {/* Barra de título da rotina */}
      <div className="bg-[#005ca8] text-white px-4 py-2 flex items-center justify-between">
        <h1 className="text-[13px] font-bold uppercase tracking-wide">BILHETES - {modoEdicao ? 'ALTERA' : 'INCLUI'}</h1>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1 text-xs px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-sm border border-white/30 transition-colors">
            Outras Ações
            <ChevronDown size={12} />
          </button>
          <button
            onClick={() => navigate('/bilhetes')}
            className="text-xs px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-sm border border-white/30 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => salvar('RASCUNHO')}
            disabled={!podeSalvar}
            className="text-xs px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-sm border border-white/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Rascunho
          </button>
          <button
            onClick={() => salvar('CONFIRMADO')}
            disabled={!podeSalvar}
            className="text-xs px-4 py-1.5 bg-[#ffb020] hover:bg-[#ffc04d] text-[#16233a] rounded-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Salvar
          </button>
        </div>
      </div>

      <main className="flex-1 p-4 max-w-[1400px] mx-auto w-full">
        {/* PAINEL DE CAMPOS */}
        <div className="bg-white border border-slate-300 rounded-sm shadow-sm">
          <div className="px-4 py-2 bg-slate-100 border-b border-slate-300 text-xs font-bold text-slate-600 uppercase tracking-wide">
            Bilhetes &middot; {modoEdicao ? bilheteExistente?.numero : 'Novo'}
          </div>

          <div className="p-4 grid grid-cols-4 gap-x-4 gap-y-3">
            <Campo label="Bilhete" required>
              <input disabled value={modoEdicao ? bilheteExistente?.numero : '(novo)'} className={campoTravadoCls} />
            </Campo>
            <Campo label="Data" required>
              <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={campoCls} />
            </Campo>
            <Campo label="Cliente" required>
              <div className="relative">
                <div className="flex">
                  <input
                    value={cliente ? cliente.codigo : clienteBusca}
                    onChange={(e) => !cliente && setClienteBusca(e.target.value)}
                    onFocus={() => !cliente && setClienteDropdownAberto(true)}
                    onBlur={() => setTimeout(() => setClienteDropdownAberto(false), 150)}
                    readOnly={!!cliente}
                    placeholder="Código"
                    className={clsx(campoCls, 'rounded-r-none border-r-0', cliente && 'bg-slate-100 text-slate-600')}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (cliente) {
                        setCliente(null);
                      } else {
                        setClienteDropdownAberto((v) => !v);
                      }
                    }}
                    className="px-2 border border-slate-300 border-l-0 rounded-r-sm bg-slate-50 hover:bg-slate-100 text-slate-500 transition-colors"
                  >
                    <Search size={13} />
                  </button>
                </div>
                {clienteDropdownAberto && !cliente && clientesFiltrados.length > 0 && (
                  <ul className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-300 shadow-lg z-30 max-h-56 overflow-auto">
                    {clientesFiltrados.map((c) => (
                      <li
                        key={c.codigo}
                        onMouseDown={() => {
                          setCliente(c);
                          setClienteBusca('');
                        }}
                        className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-slate-100 last:border-0 text-xs"
                      >
                        <div className="font-bold text-slate-800">{c.nome}</div>
                        <div className="text-slate-400 font-mono">Cód: {c.codigo}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Campo>
            <Campo label="Loja" required>
              <input disabled value="01" className={campoTravadoCls} />
            </Campo>

            <Campo label="Nome Cliente" required className="col-span-2">
              <input disabled value={cliente?.nome || ''} className={campoTravadoCls} />
            </Campo>
            <Campo label="Forma Pgto" required>
              <select
                value={formaPagamento}
                onChange={(e) => setFormaPagamento(e.target.value as FormaPagamentoBilhete)}
                className={campoCls}
              >
                {FORMAS_PAGAMENTO.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo label="Cond.Pagto">
              <input
                value={condicaoPagamento}
                onChange={(e) => setCondicaoPagamento(e.target.value)}
                placeholder="30 DD"
                className={campoCls}
              />
            </Campo>

            <Campo label="Vendedor" required>
              <input disabled value={nomeOperador} className={campoTravadoCls} />
            </Campo>
            <Campo label="Nome Vend" required>
              <input disabled value={nomeOperador} className={campoTravadoCls} />
            </Campo>
            <Campo label="Naturez">
              <input disabled value="10101" className={campoTravadoCls} />
            </Campo>
            <Campo label="Transp">
              <select value={transportadora} onChange={(e) => setTransportadora(e.target.value)} className={campoCls}>
                {TRANSPORTADORAS.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Campo>

            <Campo label="Rota">
              <select value={rota} onChange={(e) => setRota(e.target.value)} className={campoCls}>
                {ROTAS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </Campo>
            <Campo label="Entrega">
              <select
                value={precisaEntrega ? 'S' : 'N'}
                onChange={(e) => setPrecisaEntrega(e.target.value === 'S')}
                className={campoCls}
              >
                <option value="S">Sim</option>
                <option value="N">Não</option>
              </select>
            </Campo>
            <Campo label="Local">
              <input disabled value="01" className={campoTravadoCls} />
            </Campo>
            <Campo label="Nota">
              <input value={nota} onChange={(e) => setNota(e.target.value)} className={campoCls} />
            </Campo>

            <Campo label="Serie NF">
              <input value={serieNf} onChange={(e) => setSerieNf(e.target.value)} className={campoCls} />
            </Campo>
            <Campo label="Usuario">
              <input disabled value={nomeOperador.split(' ')[0]} className={campoTravadoCls} />
            </Campo>
            <Campo label="Hora Inclusa">
              <input disabled value={horaInclusa} className={campoTravadoCls} />
            </Campo>
            <Campo label="N. Orçamento">
              <input value={nOrcamento} onChange={(e) => setNOrcamento(e.target.value)} className={campoCls} />
            </Campo>
          </div>
        </div>

        {/* GRADE DE ITENS */}
        <div className="bg-white border border-slate-300 rounded-sm shadow-sm mt-4">
          <div className="px-4 py-2 bg-slate-100 border-b border-slate-300 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Itens</span>
            <div className="relative w-80">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={buscaProduto}
                onChange={(e) => setBuscaProduto(e.target.value)}
                placeholder="Buscar produto por código ou descrição..."
                className="w-full border border-slate-300 rounded-sm pl-7 pr-2 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
              />
              {sugestoes.length > 0 && (
                <ul className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-300 shadow-lg z-30 max-h-56 overflow-auto">
                  {sugestoes.map((produto) => (
                    <li
                      key={produto.codigo}
                      onClick={() => adicionarItem(produto)}
                      className="flex justify-between items-center px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-slate-100 last:border-0 text-xs"
                    >
                      <div>
                        <div className="font-bold text-slate-800">{produto.descricao}</div>
                        <div className="text-slate-400 font-mono">Cód: {produto.codigo}</div>
                      </div>
                      <span className="font-bold tabular-nums text-slate-700">{formatMoney(Math.round(produto.preco * 100))}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {itens.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">Nenhum item incluso</div>
          ) : (
            <table className="w-full text-xs border-collapse table-fixed">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase">
                <tr className="divide-x divide-slate-200">
                  <th className="text-center py-2 px-2 w-12 border-b border-slate-300">Item</th>
                  <th className="text-left py-2 px-2 w-24 border-b border-slate-300">Cod Produto</th>
                  <th className="text-left py-2 px-2 border-b border-slate-300">Produto</th>
                  <th className="text-right py-2 px-2 w-20 border-b border-slate-300">Qtde</th>
                  <th className="text-center py-2 px-2 w-14 border-b border-slate-300">Un</th>
                  <th className="text-right py-2 px-2 w-24 border-b border-slate-300">Preco</th>
                  <th className="text-right py-2 px-2 w-24 border-b border-slate-300">Total</th>
                  <th className="w-8 border-b border-slate-300"></th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {itens.map((item, idx) => (
                  <tr key={item.id} className="divide-x divide-slate-200 border-b border-slate-200 even:bg-slate-50/60 hover:bg-blue-50/50">
                    <td className="text-center py-1.5 px-2 text-slate-400">{String(idx + 1).padStart(4, '0')}</td>
                    <td className="py-1.5 px-2 text-slate-500 truncate">{item.codigo}</td>
                    <td className="py-1.5 px-2 font-sans text-slate-800 truncate" title={item.descricao}>
                      {item.descricao}
                    </td>
                    <td className="py-1.5 px-2 text-right">
                      <input
                        type="number"
                        min={0.01}
                        step={0.01}
                        value={item.quantidade}
                        onChange={(e) => alterarQuantidade(item.id, Math.max(0.01, Number(e.target.value) || 0))}
                        className="w-16 text-right bg-white border border-slate-200 rounded-sm px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      />
                    </td>
                    <td className="py-1.5 px-2 text-center text-slate-400">{item.unidade}</td>
                    <td className="py-1.5 px-2 text-right">{formatMoney(item.precoUnitario)}</td>
                    <td className="py-1.5 px-2 text-right font-bold">{formatMoney(item.total)}</td>
                    <td className="py-1.5 px-2 text-center">
                      <button onClick={() => removerItem(item.id)} className="text-slate-300 hover:text-red-600 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* RODAPÉ ESTILO PROTHEUS */}
        <div className="bg-white border border-slate-300 rounded-sm shadow-sm mt-4 px-4 py-2.5 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Bilhetes</span>
          <div className="flex items-center gap-8 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-500">Desconto:</span>
              <input
                type="text"
                value={desconto === 0 ? '' : formatMoney(desconto)}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '');
                  setDesconto(digits ? parseInt(digits, 10) : 0);
                }}
                placeholder="R$ 0,00"
                className="w-24 text-right border border-slate-300 rounded-sm px-1.5 py-0.5 text-red-600 focus:outline-none focus:ring-1 focus:ring-red-400"
              />
            </div>
            <div className="text-slate-600">
              Peso: <strong className="tabular-nums">{pesoTotal.toFixed(2)}</strong>
            </div>
            {cliente && (
              <div className="text-slate-600">
                Lim. Cliente: <strong className="tabular-nums">{formatMoney(cliente.limiteCredito)}</strong>
              </div>
            )}
            <div className="text-slate-800">
              Total: <strong className="text-lg tabular-nums text-[#005ca8]">{formatMoney(Math.max(total, 0))}</strong>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
