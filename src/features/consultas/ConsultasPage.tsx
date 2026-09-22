import { Fragment, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  ArrowLeft,
  RefreshCw,
  Receipt,
  ChevronDown,
  ChevronUp,
  Trash2,
  Pencil,
  Banknote,
  QrCode,
  CreditCard,
  Landmark,
  TrendingUp,
  ShoppingBag,
  Send,
  type LucideIcon,
} from 'lucide-react';
import { formatMoney } from '../../utils/formatters';
import { vendaService, VendaResumo, VendaDetalhe, StatusProtheus, ResultadoEnvioProtheus } from '../../services/vendaService';
import { useToastStore } from '../../store/toastStore';
import { usePdvStore } from '../../store/pdvStore';
import { useAuthStore } from '../../store/authStore';
import { Toast } from '../../components/Toast';
import { ConfirmDialog } from '../../components/ConfirmDialog';

const ICONE_FORMA: Record<string, LucideIcon> = {
  Dinheiro: Banknote,
  PIX: QrCode,
  Credito: CreditCard,
  Debito: Landmark,
};

const IconeForma = ({ forma, size = 16 }: { forma: string; size?: number }) => {
  const Icon = ICONE_FORMA[forma] || Receipt;
  return <Icon size={size} />;
};

const StatusBadge = ({ status }: { status: StatusProtheus }) => {
  const integrado = status === 'INTEGRADO';
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap',
        integrado ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
      )}
      title={integrado ? 'Já integrado ao Protheus' : 'Salvo somente local'}
    >
      <span className={clsx('w-1.5 h-1.5 rounded-full', integrado ? 'bg-red-500' : 'bg-green-500')} />
      {integrado ? 'Integrado' : 'Local'}
    </span>
  );
};

export function ConsultasPage() {
  const navigate = useNavigate();
  const { mostrarToast } = useToastStore();
  const iniciarEdicaoVenda = usePdvStore((s) => s.iniciarEdicaoVenda);
  const { usuario, token } = useAuthStore();
  const [vendas, setVendas] = useState<VendaResumo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [expandidoId, setExpandidoId] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<VendaDetalhe | null>(null);
  const [vendaParaExcluir, setVendaParaExcluir] = useState<VendaResumo | null>(null);
  const [enviandoProtheusId, setEnviandoProtheusId] = useState<string | null>(null);
  const [resultadosProtheus, setResultadosProtheus] = useState<Record<string, ResultadoEnvioProtheus>>({});

  const carregar = async () => {
    setCarregando(true);
    const lista = await vendaService.listarVendasDoDia();
    setVendas(lista);
    setCarregando(false);
  };

  useEffect(() => {
    carregar();
  }, []);

  const alternarExpandido = async (id: string) => {
    if (expandidoId === id) {
      setExpandidoId(null);
      setDetalhe(null);
      return;
    }
    setExpandidoId(id);
    setDetalhe(null);
    const venda = await vendaService.buscarVenda(id);
    setDetalhe(venda);
  };

  const pedirExclusao = (e: React.MouseEvent, venda: VendaResumo) => {
    e.stopPropagation();
    setVendaParaExcluir(venda);
  };

  const editarVenda = async (e: React.MouseEvent, venda: VendaResumo) => {
    e.stopPropagation();
    const detalhe = await vendaService.buscarVenda(venda.id);
    if (!detalhe) {
      mostrarToast('Não foi possível carregar a venda para edição', 'erro');
      return;
    }
    iniciarEdicaoVenda(detalhe);
    navigate('/pdv');
  };

  const enviarAoProtheus = async (e: React.MouseEvent, venda: VendaResumo) => {
    e.stopPropagation();
    if (!token) return;
    setEnviandoProtheusId(venda.id);
    const resultado = await vendaService.enviarProtheus(venda.id, token);
    setEnviandoProtheusId(null);
    setResultadosProtheus((atual) => ({ ...atual, [venda.id]: resultado }));
    if (resultado.sucesso) {
      mostrarToast('Venda integrada ao Protheus', 'sucesso');
      setVendas((atual) => atual.map((v) => (v.id === venda.id ? { ...v, statusProtheus: 'INTEGRADO' } : v)));
    } else {
      mostrarToast('Protheus recusou o envio — veja o detalhe da venda', 'erro');
    }
  };

  const confirmarExclusao = async () => {
    const venda = vendaParaExcluir;
    if (!venda) return;
    setVendaParaExcluir(null);

    const resultado = await vendaService.excluirVenda(venda.id);
    if (resultado.sucesso) {
      setVendas((atual) => atual.filter((v) => v.id !== venda.id));
      if (expandidoId === venda.id) {
        setExpandidoId(null);
        setDetalhe(null);
      }
      mostrarToast('Venda excluída', 'sucesso');
    } else {
      mostrarToast(`Falha ao excluir venda: ${resultado.erro}`, 'erro');
    }
  };

  const totalDoDia = vendas.reduce((acc, v) => acc + v.total, 0);
  const ticketMedio = vendas.length > 0 ? Math.round(totalDoDia / vendas.length) : 0;

  const resumoPorForma: Record<string, { qtd: number; total: number }> = {};
  for (const v of vendas) {
    const chave = v.formaPagamento || 'Outro';
    if (!resumoPorForma[chave]) resumoPorForma[chave] = { qtd: 0, total: 0 };
    resumoPorForma[chave].qtd += 1;
    resumoPorForma[chave].total += v.total;
  }

  const formatadorHora = new Intl.DateTimeFormat('pt-BR', { timeStyle: 'short' });
  const formatadorData = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full' });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <Toast />
      <header className="bg-white p-4 shadow-sm flex items-center justify-between border-b border-slate-200">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/home')}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Consultas &middot; Vendas do Dia</h1>
            <p className="text-sm text-slate-400 capitalize">{formatadorData.format(new Date())}</p>
          </div>
        </div>
        <button
          onClick={carregar}
          className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-lg transition-colors font-medium text-sm"
        >
          <RefreshCw size={16} className={carregando ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </header>

      <main className="flex-1 p-8 max-w-6xl mx-auto w-full">
        <div className="grid grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-blue-50 text-blue-600">
              <ShoppingBag size={24} />
            </div>
            <div>
              <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Vendas no dia</div>
              <div className="text-2xl font-black text-slate-800 tabular-nums">{vendas.length}</div>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-6 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-green-50 text-green-600">
              <Receipt size={24} />
            </div>
            <div>
              <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Total vendido</div>
              <div className="text-2xl font-black text-green-600 tabular-nums">{formatMoney(totalDoDia)}</div>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-6 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-amber-50 text-amber-600">
              <TrendingUp size={24} />
            </div>
            <div>
              <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Ticket médio</div>
              <div className="text-2xl font-black text-slate-800 tabular-nums">{formatMoney(ticketMedio)}</div>
            </div>
          </div>
        </div>

        {Object.keys(resumoPorForma).length > 0 && (
          <div className="flex flex-wrap gap-3 mb-6">
            {Object.entries(resumoPorForma).map(([forma, dados]) => (
              <div
                key={forma}
                className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3"
              >
                <div className="p-2 rounded-lg bg-slate-100 text-slate-600">
                  <IconeForma forma={forma} />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-800">{forma}</div>
                  <div className="text-xs text-slate-500">
                    {dados.qtd} venda{dados.qtd > 1 ? 's' : ''} &middot; {formatMoney(dados.total)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          {carregando ? (
            <div className="p-16 text-center text-slate-400">Carregando...</div>
          ) : vendas.length === 0 ? (
            <div className="p-16 flex flex-col items-center gap-3 text-slate-400">
              <Receipt size={40} className="opacity-40" />
              Nenhuma venda registrada hoje.
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-100 text-slate-600 text-xs uppercase font-bold border-b border-slate-200">
                <tr>
                  <th className="p-4 w-20">Hora</th>
                  <th className="p-4">Cupom</th>
                  <th className="p-4">Cliente</th>
                  <th className="p-4">Pagamento</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Total</th>
                  <th className="p-4 w-24"></th>
                </tr>
              </thead>
              <tbody>
                {vendas.map((venda) => {
                  const expandido = expandidoId === venda.id;
                  return (
                    <Fragment key={venda.id}>
                      <tr
                        onClick={() => alternarExpandido(venda.id)}
                        className={clsx(
                          'border-b border-slate-100 cursor-pointer transition-colors',
                          expandido ? 'bg-blue-50/60' : 'hover:bg-slate-50'
                        )}
                      >
                        <td className="p-4 font-mono text-sm text-slate-400">
                          {formatadorHora.format(new Date(venda.criadoEm))}
                        </td>
                        <td className="p-4 font-bold text-slate-800 whitespace-nowrap">
                          {venda.numeroCupom}
                          {venda.editadoEm && (
                            <span className="ml-2 text-xs font-normal text-amber-600" title={`Editado em ${new Date(venda.editadoEm).toLocaleString('pt-BR')}`}>
                              (editado)
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-slate-600 text-sm">{venda.clienteNome || 'Consumidor'}</td>
                        <td className="p-4 text-slate-600 text-sm">
                          <span className="inline-flex items-center gap-1.5">
                            <IconeForma forma={venda.formaPagamento} size={14} />
                            {venda.formaPagamento}
                          </span>
                        </td>
                        <td className="p-4">
                          <StatusBadge status={venda.statusProtheus} />
                        </td>
                        <td className="p-4 text-right font-bold tabular-nums text-slate-800">
                          {formatMoney(venda.total)}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center justify-end gap-1">
                            {usuario?.papel === 'ADMIN' && (
                              <button
                                onClick={(e) => enviarAoProtheus(e, venda)}
                                disabled={enviandoProtheusId === venda.id}
                                className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors disabled:opacity-40"
                                title="Enviar ao Protheus (experimental)"
                              >
                                <Send size={16} className={enviandoProtheusId === venda.id ? 'animate-pulse' : ''} />
                              </button>
                            )}
                            <button
                              onClick={(e) => editarVenda(e, venda)}
                              className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                              title="Editar venda"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              onClick={(e) => pedirExclusao(e, venda)}
                              className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              title="Excluir venda"
                            >
                              <Trash2 size={16} />
                            </button>
                            {expandido ? (
                              <ChevronUp size={16} className="text-slate-400" />
                            ) : (
                              <ChevronDown size={16} className="text-slate-400" />
                            )}
                          </div>
                        </td>
                      </tr>

                      {expandido && (
                        <tr className="bg-slate-50 border-b border-slate-100">
                          <td colSpan={7} className="p-0">
                            <div className="px-6 py-5">
                              {!detalhe ? (
                                <div className="text-slate-400 text-sm py-2">Carregando itens...</div>
                              ) : (
                                <>
                                  <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
                                    <table className="w-full text-sm border-collapse">
                                      <thead className="bg-slate-100 text-slate-500 text-xs uppercase font-bold">
                                        <tr>
                                          <th className="text-left py-2.5 px-4">Código</th>
                                          <th className="text-left py-2.5 px-4">Descrição</th>
                                          <th className="text-right py-2.5 px-4">Qtd</th>
                                          <th className="text-right py-2.5 px-4">Vl. Unit</th>
                                          <th className="text-right py-2.5 px-4">Total</th>
                                        </tr>
                                      </thead>
                                      <tbody className="font-mono text-slate-700">
                                        {detalhe.itens.map((item, idx) => (
                                          <tr key={idx} className="border-t border-slate-100 even:bg-slate-50/50">
                                            <td className="py-2.5 px-4 text-slate-400">{item.codigo}</td>
                                            <td className="py-2.5 px-4 font-sans text-slate-800">{item.descricao}</td>
                                            <td className="py-2.5 px-4 text-right">{item.quantidade}</td>
                                            <td className="py-2.5 px-4 text-right">{formatMoney(item.valorUnitario)}</td>
                                            <td className="py-2.5 px-4 text-right font-bold">{formatMoney(item.valorTotal)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>

                                  {resultadosProtheus[venda.id] && (
                                    <div
                                      className={clsx(
                                        'mt-4 rounded-xl border p-4 text-sm',
                                        resultadosProtheus[venda.id].sucesso
                                          ? 'bg-green-50 border-green-200 text-green-800'
                                          : 'bg-red-50 border-red-200 text-red-800'
                                      )}
                                    >
                                      <div className="font-bold mb-2">
                                        {resultadosProtheus[venda.id].sucesso
                                          ? 'Protheus aceitou o pedido'
                                          : `Protheus recusou${resultadosProtheus[venda.id].status ? ` (HTTP ${resultadosProtheus[venda.id].status})` : ''}`}
                                      </div>
                                      <pre className="text-xs font-mono whitespace-pre-wrap break-all bg-white/60 rounded-lg p-3 border border-black/5 max-h-48 overflow-auto">
                                        {JSON.stringify(
                                          resultadosProtheus[venda.id].resposta ?? resultadosProtheus[venda.id].erro,
                                          null,
                                          2
                                        )}
                                      </pre>
                                    </div>
                                  )}

                                  {detalhe.formaPagamento === 'Dinheiro' && detalhe.valorRecebido != null && (
                                    <div className="flex gap-6 mt-4 px-1">
                                      <div>
                                        <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-0.5">
                                          Valor Recebido
                                        </div>
                                        <div className="text-lg font-bold tabular-nums text-slate-800">
                                          {formatMoney(detalhe.valorRecebido)}
                                        </div>
                                      </div>
                                      <div>
                                        <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-0.5">
                                          Troco
                                        </div>
                                        <div className="text-lg font-bold tabular-nums text-green-600">
                                          {formatMoney(detalhe.troco || 0)}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {vendaParaExcluir && (
        <ConfirmDialog
          titulo="Excluir Venda"
          mensagem={`Confirma a exclusão do Cupom ${vendaParaExcluir.numeroCupom}? Ele deixará de aparecer nas consultas.`}
          labelDestaque="Valor do Cupom"
          valorDestaque={formatMoney(vendaParaExcluir.total)}
          confirmarLabel="EXCLUIR (ENTER)"
          onConfirmar={confirmarExclusao}
          onCancelar={() => setVendaParaExcluir(null)}
        />
      )}
    </div>
  );
}
