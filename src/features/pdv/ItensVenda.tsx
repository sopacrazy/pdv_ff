import { useEffect, useRef, useState } from 'react';
import { usePdvStore } from '../../store/pdvStore';
import { formatMoney } from '../../utils/formatters';
import { clsx } from 'clsx';
import { ShoppingCart } from 'lucide-react';

export const ItensVenda = () => {
  const { isCaixaAberto, itens, itemSelecionadoId, selecionarItem } = usePdvStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const prevLength = useRef(itens.length);
  const [piscarId, setPiscarId] = useState<string | null>(null);

  // Auto-scroll e efeito de piscar
  useEffect(() => {
    if (itens.length > prevLength.current) {
      const ultimo = itens[itens.length - 1];
      setPiscarId(ultimo.id);
      setTimeout(() => setPiscarId(null), 500);
      // Rola apenas o container da tabela (scrollTo), nunca scrollIntoView:
      // scrollIntoView também arrasta ancestrais com overflow-hidden (o <main>),
      // o que fazia a tela inteira "pular" e esconder o topo do campo de leitura.
      const container = containerRef.current;
      if (container) {
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
      }
    }
    prevLength.current = itens.length;
  }, [itens]);

  if (itens.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-4">
        <ShoppingCart size={64} className="opacity-30 text-slate-400 mb-2" />
        {isCaixaAberto ? (
          <>
            <p className="text-xl text-slate-700 font-medium">Caixa Livre</p>
            <p className="text-sm text-slate-500">Leia o primeiro produto para iniciar a venda</p>
          </>
        ) : (
          <p className="text-xl text-slate-700 font-medium">Aguardando abertura de caixa...</p>
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="overflow-auto h-full bg-white pb-16">
      <table className="w-full text-left border-collapse whitespace-nowrap">
        <thead className="sticky top-0 bg-slate-100 text-slate-600 text-base uppercase font-bold z-10 shadow-sm border-b border-slate-200">
          <tr>
            <th className="p-4 w-16 text-center">Item</th>
            <th className="p-4 w-36">Código</th>
            <th className="p-4">Descrição</th>
            <th className="p-4 w-16 text-center">UN</th>
            <th className="p-4 w-24 text-right">Qtd</th>
            <th className="p-4 w-32 text-right">Vl. Unit</th>
            <th className="p-4 w-28 text-right">Desc.</th>
            <th className="p-4 w-36 text-right pr-6">Total</th>
          </tr>
        </thead>
        <tbody className="font-mono text-2xl text-slate-800">
          {itens.map((item, index) => {
            const semPreco = !item.valorUnitario || item.valorUnitario <= 0;
            return (
              <tr
                key={item.id}
                onClick={() => selecionarItem(item.id)}
                title={semPreco ? 'Produto sem preço — não é possível finalizar a venda' : undefined}
                className={clsx(
                  'border-b border-slate-100 cursor-pointer transition-all duration-200',
                  semPreco
                    ? 'bg-red-50 text-red-700'
                    : itemSelecionadoId === item.id
                    ? 'bg-blue-100 border-l-[6px] border-l-blue-600 ring-1 ring-inset ring-blue-200 text-blue-950'
                    : 'hover:bg-slate-50 even:bg-slate-50/50',
                  itemSelecionadoId === item.id && semPreco && 'border-l-[6px] border-l-red-600',
                  piscarId === item.id && 'bg-amber-200'
                )}
              >
                <td className="p-4 text-center text-slate-400">{(index + 1).toString().padStart(3, '0')}</td>
                <td className="p-4 text-slate-500">{item.produto.codigo}</td>
                <td className="p-4 truncate max-w-[200px]" title={item.produto.descricao}>
                  {item.produto.descricao}
                </td>
                <td className="p-4 text-center text-slate-400">{item.produto.unidade}</td>
                <td className="p-4 text-right tabular-nums font-bold">{item.quantidade}</td>
                <td className="p-4 text-right tabular-nums font-bold">
                  {semPreco ? 'SEM PREÇO' : formatMoney(item.valorUnitario)}
                </td>
                <td className="p-4 text-right tabular-nums text-red-500">
                  {item.desconto > 0 ? formatMoney(item.desconto) : '-'}
                </td>
                <td className="p-4 text-right tabular-nums font-bold pr-6">{formatMoney(item.valorTotal)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="h-4" />
    </div>
  );
};
