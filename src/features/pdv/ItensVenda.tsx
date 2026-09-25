import { useEffect, useRef, useState } from 'react';
import { usePdvStore } from '../../store/pdvStore';
import { formatMoney } from '../../utils/formatters';
import { temSegundaUnidade, paraSegundaUnidade } from '../../utils/unidades';
import { clsx } from 'clsx';
import { ShoppingCart } from 'lucide-react';

const formatarQtd = (valor: number) => (Number.isInteger(valor) ? String(valor) : String(valor).replace('.', ','));

// Campo de quantidade sempre editável na própria linha (sem precisar de modal ou selecionar o item
// antes). Mantém um texto local pra não brigar com o que o operador está digitando — só volta a
// espelhar o valor vindo da store quando o campo não está focado (ex: depois que a conversão da
// outra unidade recalcula este valor).
const CampoQuantidade = ({
  id,
  valor,
  onConfirmar,
  className,
  title,
}: {
  id?: string;
  valor: number;
  onConfirmar: (novoValor: number) => void;
  className?: string;
  title?: string;
}) => {
  const [texto, setTexto] = useState(formatarQtd(valor));
  const [focado, setFocado] = useState(false);

  useEffect(() => {
    if (!focado) setTexto(formatarQtd(valor));
  }, [valor, focado]);

  const confirmar = () => {
    const numero = parseFloat(texto.replace(',', '.'));
    if (Number.isFinite(numero) && numero > 0) {
      onConfirmar(numero);
    } else {
      setTexto(formatarQtd(valor));
    }
  };

  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      title={title}
      value={texto}
      onFocus={(e) => {
        setFocado(true);
        // Chamar select() direto aqui não é suficiente: o mouseup do clique (ou a ação padrão da
        // seta que trouxe o foco pra cá) roda logo depois e desfaz a seleção, deixando só o cursor
        // posicionado. Adiar pro próximo tick garante que a seleção vença por último.
        const input = e.currentTarget;
        setTimeout(() => input.select(), 0);
      }}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={() => {
        setFocado(false);
        confirmar();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          confirmar();
          // Volta pro campo de leitura — sem isso o foco ficava "perdido" (só tirado do campo,
          // sem ir pra lugar nenhum) e era preciso clicar de novo pra continuar lendo produtos.
          document.getElementById('input-leitor')?.focus();
        }
      }}
      className={clsx(
        'w-full bg-transparent text-right tabular-nums font-bold outline-none rounded px-1.5 py-1 border border-transparent hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-colors',
        className
      )}
    />
  );
};

export const ItensVenda = () => {
  const { isCaixaAberto, itens, itemSelecionadoId, selecionarItem, alterarQuantidade, alterarQuantidadeSegundaUnidade } = usePdvStore();
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
            <th className="p-4 w-28 text-right">Qtd</th>
            <th className="p-4 w-16 text-center">UN</th>
            <th className="p-4 w-28 text-right">Qtd 2ª</th>
            <th className="p-4 w-16 text-center">UN 2ª</th>
            <th className="p-4 w-32 text-right">Vl. Unit</th>
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
                <td className="p-4 truncate" title={item.produto.descricao}>
                  {item.produto.descricao}
                </td>
                <td className="p-1 text-right">
                  <CampoQuantidade
                    id={`qtd-1-${item.id}`}
                    valor={item.quantidade}
                    onConfirmar={(novoValor) => alterarQuantidade(item.id, novoValor)}
                    title={`Quantidade em ${item.produto.unidade}`}
                  />
                </td>
                <td className="p-4 text-center text-slate-400">{item.produto.unidade}</td>
                <td className="p-1 text-right">
                  {temSegundaUnidade(item.produto) ? (
                    <CampoQuantidade
                      id={`qtd-2-${item.id}`}
                      valor={paraSegundaUnidade(item.produto, item.quantidade) ?? 0}
                      onConfirmar={(novoValor) => alterarQuantidadeSegundaUnidade(item.id, novoValor)}
                      title={`Quantidade em ${item.produto.segundaUnidade} (pesagem na balança)`}
                    />
                  ) : (
                    <span className="text-slate-300 pr-1.5">—</span>
                  )}
                </td>
                <td className="p-4 text-center text-slate-400">
                  {temSegundaUnidade(item.produto) ? item.produto.segundaUnidade : <span className="text-slate-300">—</span>}
                </td>
                <td className="p-4 text-right tabular-nums font-bold">
                  {semPreco ? 'SEM PREÇO' : formatMoney(item.valorUnitario)}
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
