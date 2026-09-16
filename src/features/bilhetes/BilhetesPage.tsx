import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  ArrowLeft,
  Plus,
  Search,
  Ticket,
  TrendingUp,
  Wallet,
  Truck,
  ChevronRight,
} from 'lucide-react';
import { formatMoney } from '../../utils/formatters';
import { useBilheteStore } from '../../store/bilheteStore';
import { StatusBilhete } from '../../types/bilhete';

const STATUS_CONFIG: Record<StatusBilhete, { label: string; classe: string }> = {
  RASCUNHO: { label: 'Rascunho', classe: 'bg-slate-100 text-slate-600' },
  CONFIRMADO: { label: 'Confirmado', classe: 'bg-green-100 text-green-700' },
  CANCELADO: { label: 'Cancelado', classe: 'bg-red-100 text-red-700' },
};

const StatusBadge = ({ status }: { status: StatusBilhete }) => {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={clsx('inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap', cfg.classe)}>
      {cfg.label}
    </span>
  );
};

function calcularTotal(bilhete: { itens: { total: number }[]; desconto: number }) {
  const subtotal = bilhete.itens.reduce((acc, i) => acc + i.total, 0);
  return subtotal - bilhete.desconto;
}

export function BilhetesPage() {
  const navigate = useNavigate();
  const bilhetes = useBilheteStore((s) => s.bilhetes);
  const [busca, setBusca] = useState('');

  const termo = busca.trim().toLowerCase();
  const filtrados = termo
    ? bilhetes.filter(
        (b) =>
          b.numero.toLowerCase().includes(termo) ||
          b.cliente.nome.toLowerCase().includes(termo) ||
          b.cliente.codigo.includes(termo)
      )
    : bilhetes;

  const valorTotal = bilhetes.reduce((acc, b) => acc + calcularTotal(b), 0);
  const ticketMedio = bilhetes.length > 0 ? Math.round(valorTotal / bilhetes.length) : 0;
  const comEntrega = bilhetes.filter((b) => b.precisaEntrega).length;

  const formatadorData = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const formatadorHora = new Intl.DateTimeFormat('pt-BR', { timeStyle: 'short' });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <header className="bg-white p-4 shadow-sm flex items-center justify-between border-b border-slate-200">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/home')}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Bilhetes</h1>
            <p className="text-sm text-slate-400">Vendas para clientes do atacado</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/bilhetes/novo')}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-colors shadow-sm"
        >
          <Plus size={18} />
          Novo Bilhete
        </button>
      </header>

      <main className="flex-1 p-8 max-w-6xl mx-auto w-full">
        <div className="grid grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-blue-50 text-blue-600">
              <Ticket size={24} />
            </div>
            <div>
              <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Bilhetes</div>
              <div className="text-2xl font-black text-slate-800 tabular-nums">{bilhetes.length}</div>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-6 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-green-50 text-green-600">
              <Wallet size={24} />
            </div>
            <div>
              <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Valor total</div>
              <div className="text-2xl font-black text-green-600 tabular-nums">{formatMoney(valorTotal)}</div>
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

        <div className="relative mb-6">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por número do bilhete, cliente ou código..."
            className="w-full bg-white border border-slate-200 rounded-xl pl-11 pr-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all"
          />
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          {filtrados.length === 0 ? (
            <div className="p-16 flex flex-col items-center gap-3 text-slate-400">
              <Ticket size={40} className="opacity-40" />
              {bilhetes.length === 0 ? 'Nenhum bilhete registrado ainda.' : 'Nenhum bilhete encontrado.'}
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-100 text-slate-600 text-xs uppercase font-bold border-b border-slate-200">
                <tr>
                  <th className="p-4">Bilhete</th>
                  <th className="p-4">Data</th>
                  <th className="p-4">Cliente</th>
                  <th className="p-4">Vendedor</th>
                  <th className="p-4 text-center">Itens</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Total</th>
                  <th className="p-4 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((bilhete) => (
                  <tr
                    key={bilhete.id}
                    onClick={() => navigate(`/bilhetes/${bilhete.id}`)}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="p-4">
                      <span className="font-mono font-bold text-slate-800">{bilhete.numero}</span>
                    </td>
                    <td className="p-4 text-sm text-slate-500">
                      <div>{formatadorData.format(new Date(bilhete.data))}</div>
                      <div className="text-xs text-slate-400">{formatadorHora.format(new Date(bilhete.data))}</div>
                    </td>
                    <td className="p-4">
                      <div className="font-medium text-slate-800 text-sm">{bilhete.cliente.nome}</div>
                      <div className="text-xs text-slate-400 font-mono">Cód: {bilhete.cliente.codigo}</div>
                    </td>
                    <td className="p-4 text-sm text-slate-600">{bilhete.vendedor}</td>
                    <td className="p-4 text-center">
                      <span className="inline-flex items-center justify-center min-w-[1.75rem] h-7 px-2 rounded-full bg-slate-100 text-slate-600 text-sm font-bold tabular-nums">
                        {bilhete.itens.length}
                      </span>
                      {bilhete.precisaEntrega && (
                        <Truck size={14} className="inline-block ml-2 text-blue-500 align-middle" />
                      )}
                    </td>
                    <td className="p-4">
                      <StatusBadge status={bilhete.status} />
                    </td>
                    <td className="p-4 text-right font-bold tabular-nums text-slate-800">
                      {formatMoney(calcularTotal(bilhete))}
                    </td>
                    <td className="p-4">
                      <ChevronRight size={18} className="text-slate-300" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {comEntrega > 0 && (
          <p className="text-sm text-slate-400 mt-4 flex items-center gap-2">
            <Truck size={14} />
            {comEntrega} bilhete{comEntrega > 1 ? 's' : ''} com entrega agendada
          </p>
        )}
      </main>
    </div>
  );
}
