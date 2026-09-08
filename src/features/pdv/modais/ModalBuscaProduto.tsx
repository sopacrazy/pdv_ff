import { useEffect, useState, useRef } from 'react';
import { usePdvStore } from '../../../store/pdvStore';
import { produtoServiceMock } from '../../../services/produtoService.mock';
import { Produto } from '../../../types/produto';
import { formatMoney } from '../../../utils/formatters';
import { Search, X } from 'lucide-react';
import { clsx } from 'clsx';

export const ModalBuscaProduto = () => {
  const { setModalAtivo, adicionarItem } = usePdvStore();
  const [busca, setBusca] = useState('');
  const [resultados, setResultados] = useState<Produto[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const buscar = async () => {
      if (busca.length >= 2) {
        const res = await produtoServiceMock.buscarPorDescricao(busca);
        setResultados(res);
        setSelectedIndex(0);
      } else {
        setResultados([]);
      }
    };
    const timer = setTimeout(buscar, 300);
    return () => clearTimeout(timer);
  }, [busca]);

  useEffect(() => {
    // Scroll selecionado pra view
    const selectedEl = listRef.current?.children[selectedIndex] as HTMLElement;
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setModalAtivo('NENHUM');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, resultados.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (resultados.length > 0 && resultados[selectedIndex]) {
        adicionarItem(resultados[selectedIndex], 1);
        setModalAtivo('NENHUM');
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col h-[600px] border border-slate-200">
        <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-2xl">
          <div className="flex items-center gap-3 text-blue-600">
            <Search size={28} />
            <h2 className="text-2xl font-bold text-slate-800">Buscar Produto</h2>
          </div>
          <button onClick={() => setModalAtivo('NENHUM')} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={28} />
          </button>
        </div>
        
        <div className="p-6">
          <input
            id="input-busca-produto"
            ref={inputRef}
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite o código ou descrição..."
            className="w-full bg-white border-2 border-slate-300 focus:border-blue-500 rounded-xl px-6 py-4 text-xl text-slate-800 focus:outline-none focus:ring-4 focus:ring-blue-500/20"
          />
        </div>

        <div className="flex-1 overflow-auto px-6 pb-6">
          {resultados.length > 0 ? (
            <ul ref={listRef} className="space-y-2">
              {resultados.map((p, index) => (
                <li
                  key={p.codigo}
                  onClick={() => {
                    adicionarItem(p, 1);
                    setModalAtivo('NENHUM');
                  }}
                  className={clsx(
                    'flex justify-between items-center p-4 rounded-lg cursor-pointer transition-colors',
                    selectedIndex === index ? 'bg-blue-600 text-white' : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
                  )}
                >
                  <div className="flex flex-col">
                    <span className="font-bold text-lg">{p.descricao}</span>
                    <span className={clsx("text-sm font-mono", selectedIndex === index ? "opacity-90 text-blue-100" : "opacity-80 text-slate-500")}>Cód: {p.codigo} | Barras: {p.codigoBarras}</span>
                  </div>
                  <div className="font-bold text-xl tabular-nums">
                    {formatMoney(Math.round(p.preco * 100))}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500 text-lg">
              {busca.length >= 2 ? 'Nenhum produto encontrado.' : 'Digite pelo menos 2 caracteres.'}
            </div>
          )}
        </div>
        
        <div className="p-4 bg-slate-50 rounded-b-2xl border-t border-slate-200 text-center text-slate-500 text-sm">
          Use as <strong className="text-slate-800">SETAS</strong> para navegar, <strong className="text-slate-800">ENTER</strong> para selecionar e <strong className="text-slate-800">ESC</strong> para sair.
        </div>
      </div>
    </div>
  );
};
