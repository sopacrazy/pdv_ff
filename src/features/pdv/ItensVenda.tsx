import { useEffect, useRef, useState } from 'react';
import { usePdvStore } from '../../store/pdvStore';
import { formatMoney } from '../../utils/formatters';
import { produtoServiceMock } from '../../services/produtoService.mock';
import { clsx } from 'clsx';
import { ShoppingCart } from 'lucide-react';

export const ItensVenda = () => {
  const { isCaixaAberto, itens, itemSelecionadoId, selecionarItem, adicionarItem } = usePdvStore();
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevLength = useRef(itens.length);
  const [piscarId, setPiscarId] = useState<string | null>(null);

  // Auto-scroll e efeito de piscar
  useEffect(() => {
    if (itens.length > prevLength.current) {
      const ultimo = itens[itens.length - 1];
      setPiscarId(ultimo.id);
      setTimeout(() => setPiscarId(null), 500);
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevLength.current = itens.length;
  }, [itens]);

  const inserirTestes = async () => {
    const p1 = await produtoServiceMock.buscarPorCodigoOuBarras('0001');
    const p2 = await produtoServiceMock.buscarPorCodigoOuBarras('0013');
    const p3 = await produtoServiceMock.buscarPorCodigoOuBarras('0004');
    if (p1) adicionarItem(p1, 2);
    if (p2) adicionarItem(p2, 1.5);
    if (p3) adicionarItem(p3, 1);
  };

  if (itens.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-4">
        <ShoppingCart size={64} className="opacity-30 text-slate-400 mb-2" />
        {isCaixaAberto ? (
          <>
            <p className="text-xl text-slate-700 font-medium">Caixa Livre</p>
            <p className="text-sm text-slate-500 mb-6">Leia o primeiro produto para iniciar a venda</p>
            <button 
              onClick={inserirTestes}
              className="px-6 py-2.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-full font-bold text-sm transition-colors border border-blue-200"
            >
              + Adicionar Produtos Teste
            </button>
            <p className="text-xs text-slate-400 mt-2">Dica: digite 0001 ou 3*0004 e tecle ENTER</p>
          </>
        ) : (
          <p className="text-xl text-slate-700 font-medium">Aguardando abertura de caixa...</p>
        )}
      </div>
    );
  }

  return (
    <div className="overflow-auto h-full bg-white pb-16">
      <table className="w-full text-left border-collapse whitespace-nowrap">
        <thead className="sticky top-0 bg-slate-100 text-slate-600 text-sm uppercase font-bold z-10 shadow-sm border-b border-slate-200">
          <tr>
            <th className="p-3 w-16 text-center">Item</th>
            <th className="p-3 w-36">Código</th>
            <th className="p-3">Descrição</th>
            <th className="p-3 w-16 text-center">UN</th>
            <th className="p-3 w-24 text-right">Qtd</th>
            <th className="p-3 w-32 text-right">Vl. Unit</th>
            <th className="p-3 w-28 text-right">Desc.</th>
            <th className="p-3 w-36 text-right pr-6">Total</th>
          </tr>
        </thead>
        <tbody className="font-mono text-lg text-slate-800">
          {itens.map((item, index) => (
            <tr
              key={item.id}
              onClick={() => selecionarItem(item.id)}
              className={clsx(
                'border-b border-slate-100 cursor-pointer transition-all duration-200',
                itemSelecionadoId === item.id
                  ? 'bg-blue-100 border-l-[6px] border-l-blue-600 ring-1 ring-inset ring-blue-200 text-blue-950'
                  : 'hover:bg-slate-50 even:bg-slate-50/50',
                piscarId === item.id && 'bg-amber-200'
              )}
            >
              <td className="p-3 text-center text-slate-400">{(index + 1).toString().padStart(3, '0')}</td>
              <td className="p-3 text-slate-500">{item.produto.codigo}</td>
              <td className="p-3 truncate max-w-[200px]" title={item.produto.descricao}>
                {item.produto.descricao}
              </td>
              <td className="p-3 text-center text-slate-400">{item.produto.unidade}</td>
              <td className="p-3 text-right tabular-nums font-bold">{item.quantidade}</td>
              <td className="p-3 text-right tabular-nums">{formatMoney(item.valorUnitario)}</td>
              <td className="p-3 text-right tabular-nums text-red-500">
                {item.desconto > 0 ? formatMoney(item.desconto) : '-'}
              </td>
              <td className="p-3 text-right tabular-nums font-bold pr-6">{formatMoney(item.valorTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div ref={bottomRef} className="h-4" />
    </div>
  );
};
