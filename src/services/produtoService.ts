import { Produto, ProdutoService } from '../types/produto';

export const produtoService: ProdutoService = {
  buscarPorCodigoOuBarras: async (codigo) => {
    const resp = await fetch(`/api/produtos/busca?codigo=${encodeURIComponent(codigo)}`);
    if (!resp.ok) return null;
    const produto: Produto | null = await resp.json();
    return produto;
  },
  buscarPorDescricao: async (descricao) => {
    const resp = await fetch(`/api/produtos/buscar?q=${encodeURIComponent(descricao)}`);
    if (!resp.ok) return [];
    const produtos: Produto[] = await resp.json();
    return produtos;
  },
};
