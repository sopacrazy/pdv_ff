import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { Wallet, Receipt } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { useAuthStore } from '../../store/authStore';
import { formatMoney } from '../../utils/formatters';
import { vendaService, VendaResumo } from '../../services/vendaService';
import {
  Donut,
  GraficoLinha,
  GraficoBarras,
  GraficoBarrasHorizontais,
  COR_SERIE,
  COR_TRILHA,
  COR_DESTAQUE,
  COR_TRILHA_DESTAQUE,
  PontoLinha,
  BarraDia,
  BarraHorizontal,
} from './charts';

const ROTULOS_FORMA: Record<string, string> = {
  Dinheiro: 'Dinheiro',
  PIX: 'PIX',
  Credito: 'Cartão de crédito',
  Debito: 'Cartão de débito',
};

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// Valor compacto pro centro do donut; o valor exato fica na legenda logo abaixo.
function moedaCompacta(centavos: number) {
  const reais = centavos / 100;
  if (reais >= 1000) {
    return `R$ ${(reais / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  }
  return `R$ ${reais.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
}

function saudacao(hora: number) {
  if (hora < 12) return 'Bom dia';
  if (hora < 18) return 'Boa tarde';
  return 'Boa noite';
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={clsx('bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5', className)}>{children}</div>
  );
}

function TituloCard({ titulo, acessorio }: { titulo: string; acessorio?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-base font-bold text-slate-800">{titulo}</h2>
      {acessorio}
    </div>
  );
}

export function HomePage() {
  const navigate = useNavigate();
  const { vendedor, loja, caixa, usuario } = useAuthStore();
  const isAdmin = usuario?.papel === 'ADMIN';

  const [horaAtual, setHoraAtual] = useState(new Date());
  const [vendasHoje, setVendasHoje] = useState<VendaResumo[]>([]);
  const [semana, setSemana] = useState<{ data: string; quantidade: number; total: number }[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => setHoraAtual(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelado = false;
    const carregar = async () => {
      const [vendas, resumo] = await Promise.all([vendaService.listarVendasDoDia(), vendaService.resumoSemana()]);
      if (cancelado) return;
      setVendasHoje(vendas);
      setSemana(resumo);
      setCarregando(false);
    };
    carregar();
    return () => {
      cancelado = true;
    };
  }, []);

  const horaCorrente = horaAtual.getHours();

  const faturamentoHoje = vendasHoje.reduce((soma, venda) => soma + venda.total, 0);
  const cuponsHoje = vendasHoje.length;
  const ticketMedio = cuponsHoje > 0 ? Math.round(faturamentoHoje / cuponsHoje) : 0;

  // Média dos 6 dias anteriores — denominador honesto pra comparar o dia de hoje.
  const diasAnteriores = semana.slice(0, -1);
  const mediaFaturamento = diasAnteriores.length
    ? diasAnteriores.reduce((soma, dia) => soma + dia.total, 0) / diasAnteriores.length
    : 0;
  const mediaCupons = diasAnteriores.length
    ? diasAnteriores.reduce((soma, dia) => soma + dia.quantidade, 0) / diasAnteriores.length
    : 0;

  const percentualFaturamento = mediaFaturamento > 0 ? (faturamentoHoje / mediaFaturamento) * 100 : 0;
  const percentualCupons = mediaCupons > 0 ? (cuponsHoje / mediaCupons) * 100 : 0;

  const totalSemana = semana.reduce((soma, dia) => soma + dia.total, 0);
  const cuponsSemana = semana.reduce((soma, dia) => soma + dia.quantidade, 0);

  const pontosPorHora = useMemo<PontoLinha[]>(() => {
    if (vendasHoje.length === 0) return [];
    const porHora = new Map<number, number>();
    vendasHoje.forEach((venda) => {
      const hora = new Date(venda.criadoEm).getHours();
      porHora.set(hora, (porHora.get(hora) || 0) + venda.total);
    });
    const horas = [...porHora.keys()];
    const inicio = Math.min(...horas);
    const fim = Math.max(Math.max(...horas), horaCorrente);
    const pontos: PontoLinha[] = [];
    for (let hora = inicio; hora <= fim; hora += 1) {
      pontos.push({ rotulo: `${String(hora).padStart(2, '0')}h`, valor: porHora.get(hora) || 0 });
    }
    return pontos;
  }, [vendasHoje, horaCorrente]);

  const barrasSemana = useMemo<BarraDia[]>(
    () =>
      semana.map((dia, indice) => {
        const [ano, mes, diaDoMes] = dia.data.split('-').map(Number);
        const data = new Date(ano, mes - 1, diaDoMes);
        return {
          rotulo: DIAS_SEMANA[data.getDay()],
          valor: dia.total,
          detalhe: `${dia.quantidade} ${dia.quantidade === 1 ? 'venda' : 'vendas'} · ${String(diaDoMes).padStart(2, '0')}/${String(mes).padStart(2, '0')}`,
          destacado: indice === semana.length - 1,
        };
      }),
    [semana]
  );

  const formasPagamento = useMemo<BarraHorizontal[]>(() => {
    const porForma = new Map<string, number>();
    vendasHoje.forEach((venda) => {
      porForma.set(venda.formaPagamento, (porForma.get(venda.formaPagamento) || 0) + venda.total);
    });
    return [...porForma.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([forma, valor]) => ({
        rotulo: ROTULOS_FORMA[forma] || forma || 'Outros',
        valor,
        formatado: formatMoney(valor),
        percentual: faturamentoHoje > 0 ? (valor / faturamentoHoje) * 100 : 0,
      }));
  }, [vendasHoje, faturamentoHoje]);

  const formatadorHora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const formatadorData = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full' });

  return (
    <AppShell rotaAtiva="/home">
      <header className="bg-white rounded-2xl border border-slate-200/80 shadow-sm px-6 py-4">
        <h1 className="text-xl font-bold text-slate-800 truncate">
          {saudacao(horaCorrente)}, {(vendedor?.nome || 'Operador').split(' ')[0]}
        </h1>
        <p className="text-sm text-slate-400 capitalize truncate">
          {formatadorData.format(horaAtual)} · Loja {loja} · Caixa {caixa}
        </p>
      </header>

          <div className={clsx('grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-4 transition-opacity', carregando && 'opacity-60')}>
            {/* COLUNA ESQUERDA */}
            <div className="flex flex-col gap-4 min-w-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card className="flex flex-col items-center">
                  <TituloCard titulo="Faturamento de hoje" />
                  <Donut percentual={percentualFaturamento} cor={COR_SERIE} corTrilha={COR_TRILHA}>
                    <span className="text-[34px] leading-none font-bold text-slate-900">
                      {moedaCompacta(faturamentoHoje)}
                    </span>
                  </Donut>
                  <p className="text-xs text-slate-400 mt-3 text-center">
                    <span className="text-slate-600 font-bold">{formatMoney(faturamentoHoje)}</span>
                    {mediaFaturamento > 0
                      ? ` · ${percentualFaturamento.toFixed(0)}% da média da semana`
                      : ' · sem histórico anterior'}
                  </p>
                </Card>

                <Card className="flex flex-col items-center">
                  <TituloCard titulo="Cupons emitidos" />
                  <Donut percentual={percentualCupons} cor={COR_DESTAQUE} corTrilha={COR_TRILHA_DESTAQUE}>
                    <span className="text-[40px] leading-none font-bold text-slate-900">{cuponsHoje}</span>
                    <span className="text-xs text-slate-400 mt-1">
                      ticket {cuponsHoje > 0 ? formatMoney(ticketMedio) : '—'}
                    </span>
                  </Donut>
                  <p className="text-xs text-slate-400 mt-3 text-center">
                    {mediaCupons > 0
                      ? `${percentualCupons.toFixed(0)}% da média da semana (${mediaCupons.toFixed(1)}/dia)`
                      : 'Sem histórico dos dias anteriores'}
                  </p>
                </Card>
              </div>

              {isAdmin && (
                <>
                  <Card>
                    <TituloCard
                      titulo="Faturamento por hora"
                      acessorio={<span className="text-xs text-slate-400">Hoje</span>}
                    />
                    {pontosPorHora.length > 1 ? (
                      <GraficoLinha pontos={pontosPorHora} formatarValor={formatMoney} />
                    ) : (
                      <div className="h-[190px] flex items-center justify-center text-sm text-slate-400">
                        {pontosPorHora.length === 1
                          ? 'Só uma hora com venda até agora — o gráfico aparece a partir da segunda.'
                          : 'Nenhuma venda registrada hoje.'}
                      </div>
                    )}
                  </Card>

                  <Card>
                    <TituloCard
                      titulo="Formas de pagamento"
                      acessorio={<span className="text-xs text-slate-400">Hoje</span>}
                    />
                    {formasPagamento.length > 0 ? (
                      <GraficoBarrasHorizontais barras={formasPagamento} />
                    ) : (
                      <div className="h-24 flex items-center justify-center text-sm text-slate-400">
                        Nenhuma venda registrada hoje.
                      </div>
                    )}
                  </Card>
                </>
              )}
            </div>

            {/* COLUNA DIREITA */}
            <div className="flex flex-col gap-4 min-w-0">
              <Card className="flex-1 flex flex-col min-h-[320px]">
                <TituloCard
                  titulo="Últimas vendas"
                  acessorio={
                    <button
                      onClick={() => navigate('/consultas')}
                      className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      Ver todas
                    </button>
                  }
                />

                {vendasHoje.length > 0 ? (
                  <div className="flex flex-col gap-2 overflow-auto pr-1 -mr-1 max-h-[420px]">
                    {vendasHoje.slice(0, 12).map((venda) => (
                      <button
                        key={venda.id}
                        onClick={() => navigate('/consultas')}
                        className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors text-left"
                      >
                        <div className="h-10 w-10 shrink-0 rounded-full bg-white border border-slate-200 flex items-center justify-center text-blue-600">
                          <Receipt size={18} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-slate-800 text-sm truncate">
                            Cupom {venda.numeroCupom}
                            {venda.clienteNome ? ` · ${venda.clienteNome}` : ''}
                          </p>
                          <p className="text-xs text-slate-400">
                            {formatadorHora.format(new Date(venda.criadoEm))} ·{' '}
                            {ROTULOS_FORMA[venda.formaPagamento] || venda.formaPagamento || 'Sem forma'}
                          </p>
                        </div>
                        <span className="font-bold text-slate-800 tabular-nums shrink-0">{formatMoney(venda.total)}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 text-slate-400">
                    <Wallet size={32} className="text-slate-300" />
                    <p className="text-sm">Nenhuma venda hoje ainda.</p>
                  </div>
                )}
              </Card>

              {isAdmin && (
                <Card>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-base font-bold text-slate-800">Vendas na semana</h2>
                      <p className="text-2xl font-bold text-slate-900 mt-1">{formatMoney(totalSemana)}</p>
                      <p className="text-xs text-slate-400">{cuponsSemana} cupons nos últimos 7 dias</p>
                    </div>
                  </div>
                  {barrasSemana.length > 0 ? (
                    <GraficoBarras barras={barrasSemana} formatarValor={formatMoney} />
                  ) : (
                    <div className="h-44 flex items-center justify-center text-sm text-slate-400">Sem dados.</div>
                  )}
                </Card>
              )}
            </div>
          </div>
    </AppShell>
  );
}
