import { create } from 'zustand';
import { Produto } from '../types/produto';
import { ItemVenda, Pagamento } from '../types/venda';

export type ModalType = 'NENHUM' | 'BUSCA_PRODUTO' | 'QUANTIDADE' | 'DESCONTO' | 'CANCELAR_ITEM' | 'CANCELAR_CUPOM' | 'PAGAMENTO' | 'CLIENTE' | 'FECHAR_CAIXA';

interface PdvState {
  isCaixaAberto: boolean;
  fundoDeTroco: number;
  cupomNumero: string;
  itens: ItemVenda[];
  itemSelecionadoId: string | null;
  cliente: { nome: string; cpf: string } | null;
  modalAtivo: ModalType;

  // Actions
  abrirCaixa: (valor: number) => void;
  fecharCaixa: () => void;
  abrirVenda: () => void;
  adicionarItem: (produto: Produto, quantidade: number) => void;
  alterarQuantidade: (id: string, quantidade: number) => void;
  removerItem: (id: string) => void;
  selecionarItem: (id: string | null) => void;
  selecionarAnterior: () => void;
  selecionarProximo: () => void;
  setModalAtivo: (modal: ModalType) => void;
  cancelarCupom: () => void;
  finalizarVenda: (pagamentos: Pagamento[]) => void;
}

const gerarId = () => Math.random().toString(36).substring(2, 9);

export const usePdvStore = create<PdvState>((set, get) => ({
  isCaixaAberto: false,
  fundoDeTroco: 0,
  cupomNumero: '000123',
  itens: [],
  itemSelecionadoId: null,
  cliente: null,
  modalAtivo: 'NENHUM',

  abrirCaixa: (valor) => set({ isCaixaAberto: true, fundoDeTroco: valor }),
  fecharCaixa: () => set({ isCaixaAberto: false, fundoDeTroco: 0, itens: [], cliente: null, modalAtivo: 'NENHUM' }),

  abrirVenda: () =>
    set({ itens: [], itemSelecionadoId: null, cliente: null, modalAtivo: 'NENHUM' }),

  adicionarItem: (produto, quantidade) => {
    const { itens } = get();
    const existenteIndex = itens.findIndex((i) => i.produto.codigo === produto.codigo);

    if (existenteIndex >= 0) {
      const novaLista = [...itens];
      const item = novaLista[existenteIndex];
      const novaQtd = item.quantidade + quantidade;
      novaLista[existenteIndex] = {
        ...item,
        quantidade: novaQtd,
        valorTotal: Math.round(novaQtd * item.valorUnitario - item.desconto),
      };
      set({ itens: novaLista, itemSelecionadoId: item.id });
    } else {
      const valorUnitarioCents = Math.round(produto.preco * 100);
      const novoItem: ItemVenda = {
        id: gerarId(),
        produto,
        quantidade,
        valorUnitario: valorUnitarioCents,
        desconto: 0,
        valorTotal: Math.round(quantidade * valorUnitarioCents),
      };
      set({ itens: [...itens, novoItem], itemSelecionadoId: novoItem.id });
    }
  },

  alterarQuantidade: (id, quantidade) => {
    const { itens } = get();
    const novaLista = itens.map((item) => {
      if (item.id === id) {
        return {
          ...item,
          quantidade,
          valorTotal: Math.round(quantidade * item.valorUnitario - item.desconto),
        };
      }
      return item;
    });
    set({ itens: novaLista });
  },

  removerItem: (id) => {
    const { itens, itemSelecionadoId } = get();
    const novaLista = itens.filter((i) => i.id !== id);
    set({
      itens: novaLista,
      itemSelecionadoId:
        itemSelecionadoId === id
          ? novaLista[novaLista.length - 1]?.id || null
          : itemSelecionadoId,
    });
  },

  selecionarItem: (id) => set({ itemSelecionadoId: id }),

  selecionarAnterior: () => {
    const { itens, itemSelecionadoId } = get();
    if (itens.length === 0) return;
    const index = itens.findIndex((i) => i.id === itemSelecionadoId);
    if (index > 0) {
      set({ itemSelecionadoId: itens[index - 1].id });
    } else if (index === -1 && itens.length > 0) {
      set({ itemSelecionadoId: itens[itens.length - 1].id });
    }
  },

  selecionarProximo: () => {
    const { itens, itemSelecionadoId } = get();
    if (itens.length === 0) return;
    const index = itens.findIndex((i) => i.id === itemSelecionadoId);
    if (index < itens.length - 1 && index !== -1) {
      set({ itemSelecionadoId: itens[index + 1].id });
    } else if (index === -1 && itens.length > 0) {
      set({ itemSelecionadoId: itens[0].id });
    }
  },

  setModalAtivo: (modal) => set({ modalAtivo: modal }),

  cancelarCupom: () =>
    set({ itens: [], itemSelecionadoId: null, cliente: null, modalAtivo: 'NENHUM' }),

  finalizarVenda: () => {
    const { cupomNumero } = get();
    const proximoCupom = (parseInt(cupomNumero, 10) + 1).toString().padStart(cupomNumero.length, '0');
    set({
      itens: [],
      itemSelecionadoId: null,
      cliente: null,
      modalAtivo: 'NENHUM',
      cupomNumero: proximoCupom,
    });
  },
}));
