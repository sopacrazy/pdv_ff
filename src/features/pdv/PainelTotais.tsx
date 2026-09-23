import { usePdvStore } from '../../store/pdvStore';
import { formatMoney } from '../../utils/formatters';
import { User } from 'lucide-react';
import fortfruitLogo from '@/fortfruit-logo.png';

export const PainelTotais = () => {
  const { itens, cliente, clientePadrao } = usePdvStore();
  const clienteExibido = cliente || clientePadrao;

  const ultimoItem = itens.length > 0 ? itens[itens.length - 1] : null;
  const totalItens = itens.reduce((acc, i) => acc + i.quantidade, 0);
  const subtotal = itens.reduce((acc, i) => acc + i.quantidade * i.valorUnitario, 0);
  const totalDescontos = itens.reduce((acc, i) => acc + i.desconto, 0);
  const total = subtotal - totalDescontos;

  return (
    <div className="w-[420px] shrink-0 bg-slate-50 flex flex-col border-l border-slate-200 h-full min-h-0">

      {/* Área rolável: encolhe em telas baixas sem nunca esconder o Total a Pagar */}
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col p-4 gap-4">

        {/* Logo da Empresa (fixa) */}
        <div className="shrink-0 bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-center">
          <img src={fortfruitLogo} alt="Fort Fruit" className="max-h-12 object-contain" />
        </div>

        {/* Último Item Card */}
        <div className="shrink-0 bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col">
          <div className="text-slate-500 text-sm font-bold uppercase mb-2 tracking-wider">Último Item</div>
          <div className="text-xl font-bold text-slate-900 line-clamp-2 leading-tight min-h-[3rem]">
            {ultimoItem?.produto.descricao || 'Nenhum item registrado'}
          </div>
          <div className="flex justify-between items-end mt-4">
            <div className="text-slate-500 font-mono text-lg">
              {ultimoItem ? `${ultimoItem.quantidade} x ${formatMoney(ultimoItem.valorUnitario)}` : '-'}
            </div>
            <div className="text-3xl font-bold text-blue-600 font-mono tabular-nums">
              {ultimoItem ? formatMoney(ultimoItem.valorTotal) : formatMoney(0)}
            </div>
          </div>
        </div>

        {/* Resumo Valores */}
        <div className="shrink-0 flex flex-col gap-3 text-lg">
          <div className="flex justify-between items-center text-slate-600">
            <span>Itens na venda</span>
            <span className="font-mono font-bold text-slate-800">{totalItens}</span>
          </div>
          <div className="flex justify-between items-center text-slate-600">
            <span>Subtotal</span>
            <span className="font-mono font-bold tabular-nums text-slate-800">{formatMoney(subtotal)}</span>
          </div>
          <div className="flex justify-between items-center text-red-500">
            <span>Descontos</span>
            <span className="font-mono font-bold tabular-nums">- {formatMoney(totalDescontos)}</span>
          </div>
        </div>

        {/* Cliente info */}
        <div className="shrink-0 bg-slate-200/50 rounded-lg p-3 flex items-center gap-3 text-slate-700">
          <User size={20} className="text-slate-500" />
          <span className="text-sm truncate font-medium">
            {clienteExibido ? clienteExibido.nome : 'Carregando cliente...'}
          </span>
        </div>
      </div>

      {/* TOTAL A PAGAR — fixo fora da área rolável, sempre visível */}
      <div className="shrink-0 p-4 pt-0">
        <div className="bg-green-600 text-white rounded-2xl p-5 flex flex-col justify-center shadow-[0_8px_30px_rgb(22,163,74,0.3)] border border-green-500">
          <div className="font-black uppercase tracking-widest text-sm opacity-90">Total a Pagar</div>
          <div className="text-[44px] leading-none font-black tracking-tighter mt-2 tabular-nums">
            {formatMoney(total)}
          </div>
        </div>
      </div>

    </div>
  );
};
