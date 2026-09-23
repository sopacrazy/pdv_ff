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
  Banknote,
  QrCode,
  CreditCard,
  Landmark,
  TrendingUp,
  ShoppingBag,
  CheckCheck,
  Printer,
  type LucideIcon,
} from 'lucide-react';
import { formatMoney } from '../../utils/formatters';
import { vendaService, VendaResumo, VendaDetalhe, StatusProtheus } from '../../services/vendaService';
import { useToastStore } from '../../store/toastStore';
import { useAuthStore } from '../../store/authStore';
import { Toast } from '../../components/Toast';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ReciboTermico } from '../../components/ReciboTermico';
import { useImpressaoCupom } from '../../hooks/useImpressaoCupom';

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

// 'CONFERIR' é gravado tanto no meio do envio (antes de saber o resultado, pra sobreviver a uma
// queda no meio do caminho) quanto quando o resultado ficou mesmo indefinido (timeout, conexão
// caiu). Só dá pra diferenciar pelo tempo: atualizado há pouco = ainda mandando; há um tempão =
// realmente precisa conferir na mão. O prazo cobre o maior timeout de envio hoje (150s do envio
// manual) com folga.
const CONFERIR_EM_ANDAMENTO_MS = 180000;

const StatusBadge = ({ status, atualizadoEm }: { status: StatusProtheus; atualizadoEm?: string | null }) => {
  const integrado = status === 'INTEGRADO';
  const local = status === 'LOCAL';
  const enviandoAgora =
    status === 'PREPARANDO' ||
    (status === 'CONFERIR' && !!atualizadoEm && Date.now() - new Date(atualizadoEm).getTime() < CONFERIR_EM_ANDAMENTO_MS);

  if (enviandoAgora) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap bg-indigo-100 text-indigo-700">
        <RefreshCw size={12} className="animate-spin" />
        Enviando...
      </span>
    );
  }

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap',
        integrado ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
      )}
      title={integrado ? 'Já integrado ao Protheus' : local ? 'Salvo somente local' : 'Sem confirmação da Protheus — confira manualmente antes de reenviar'}
    >
      <span className={clsx('w-1.5 h-1.5 rounded-full', integrado ? 'bg-red-500' : 'bg-green-500')} />
      {integrado ? 'Integrado' : local ? 'Local' : 'Conferir Protheus'}
    </span>
  );
};

export function ConsultasPage() {
  const navigate = useNavigate();
  const { mostrarToast } = useToastStore();
  const { usuario, token } = useAuthStore();
  const [vendas, setVendas] = useState<VendaResumo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [expandidoId, setExpandidoId] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<VendaDetalhe | null>(null);
  const [vendaParaExcluir, setVendaParaExcluir] = useState<VendaResumo | null>(null);
  const { vendaParaImprimir, imprimirPorId } = useImpressaoCupom();

  const imprimirVenda = async (e: React.MouseEvent, venda: VendaResumo) => {
    e.stopPropagation();
    const detalhe = await imprimirPorId(venda.id);
    if (!detalhe) {
      mostrarToast('Não foi possível carregar a venda para impressão', 'erro');
    }
  };

  const carregar = async () => {
    setCarregando(true);
    const lista = await vendaService.listarVendasDoDia();
    setVendas(lista);
    setCarregando(false);
  };

  useEffect(() => {
    carregar();
  }, []);

  // O envio ao Protheus agora roda em segundo plano (o PDV dispara sozinho ao finalizar, e o
  // servidor tem uma fila que retenta as vendas paradas) — sem esse polling, o status na tela só
  // mudava quando o operador saía e voltava pra Consultas pra buscar de novo.
  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const lista = await vendaService.listarVendasDoDia();
        setVendas(lista);
        if (expandidoId) {
          const venda = await vendaService.buscarVenda(expandidoId);
          if (venda) setDetalhe(venda);
        }
      } catch {
        // Falha de rede num ciclo de atualização silenciosa não deve incomodar a tela — tenta de novo no próximo.
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [expandidoId]);

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

  const marcarIntegrado = async (e: React.MouseEvent, venda: VendaResumo) => {
    e.stopPropagation();
    if (!token) return;
    if (venda.statusProtheus === 'LOCAL' || venda.statusProtheus === 'INTEGRADO') return;
    // Não existe consulta automática pra saber se um envio "Conferir Protheus" (resultado
    // desconhecido, ex: timeout) realmente chegou lá — por isso pedimos o número do bilhete
    // como confirmação de que alguém checou no Protheus de verdade antes de marcar.
    const bilhete = window.prompt(
      `Confirme no Protheus que o Cupom ${venda.numeroCupom} foi integrado e informe o número do bilhete:`
    );
    if (!bilhete || !bilhete.trim()) return;
    const resultado = await vendaService.marcarIntegrado(venda.id, token, bilhete.trim());
    if (resultado.sucesso) {
      mostrarToast('Venda marcada como integrada', 'sucesso');
      setVendas((atual) => atual.map((v) => (v.id === venda.id ? { ...v, statusProtheus: 'INTEGRADO', bilheteProtheus: bilhete.trim() } : v)));
    } else {
      mostrarToast(`Falha ao marcar como integrada: ${resultado.erro}`, 'erro');
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
    <>
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans print:hidden">
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
                  <th className="p-4">Bilhete</th>
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
                          <StatusBadge status={venda.statusProtheus} atualizadoEm={venda.protheusAtualizadoEm} />
                        </td>
                        <td className="p-4 font-mono text-sm text-slate-600">
                          {venda.bilheteProtheus || <span className="text-slate-300">—</span>}
                        </td>
                        <td className="p-4 text-right font-bold tabular-nums text-slate-800">
                          {formatMoney(venda.total)}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center justify-end gap-1">
                            {usuario?.papel === 'ADMIN' && (venda.statusProtheus === 'CONFERIR' || venda.statusProtheus === 'PREPARANDO') && (
                              <button
                                onClick={(e) => marcarIntegrado(e, venda)}
                                className="p-2 rounded-lg text-slate-400 hover:text-green-600 hover:bg-green-50 transition-colors"
                                title="Marcar como integrada (depois de confirmar o bilhete no Protheus)"
                              >
                                <CheckCheck size={16} />
                              </button>
                            )}
                            <button
                              onClick={(e) => imprimirVenda(e, venda)}
                              className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                              title="Imprimir cupom (impressora térmica)"
                            >
                              <Printer size={16} />
                            </button>
                            {venda.statusProtheus === 'LOCAL' && (
                              <button
                                onClick={(e) => pedirExclusao(e, venda)}
                                className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                title="Excluir venda"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
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
                          <td colSpan={8} className="p-0">
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
    {/* Fora do wrapper print:hidden acima — só isto aparece quando a impressão dispara. */}
    {vendaParaImprimir && <ReciboTermico venda={vendaParaImprimir} />}
    </>
  );
}
