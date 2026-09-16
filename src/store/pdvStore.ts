import { create } from 'zustand';
import { Produto } from '../types/produto';
import { ItemVenda, Pagamento } from '../types/venda';
import { useAuthStore } from './authStore';
import { useToastStore } from './toastStore';
import { vendaService, VendaDetalhe } from '../services/vendaService';
import { caixaService } from '../services/caixaService';

export type ModalType = 'NENHUM' | 'BUSCA_PRODUTO' | 'BUSCA_VENDA' | 'QUANTIDADE' | 'DESCONTO' | 'CANCELAR_ITEM' | 'CANCELAR_CUPOM' | 'PAGAMENTO' | 'CLIENTE' | 'FECHAR_CAIXA';

interface PdvState {
  isCaixaAberto: boolean;
  fundoDeTroco: number;
  cupomNumero: string;
  itens: ItemVenda[];
  itemSelecionadoId: string | null;
  cliente: { nome: string; cpf: string } | null;
  clientePadrao: { nome: string; cpf: string } | null;
  modalAtivo: ModalType;
  vendaEmEdicaoId: string | null;

  // Actions
  abrirCaixa: (valor: number) => Promise<void>;
  fecharCaixa: () => Promise<void>;
  carregarEstadoCaixa: () => Promise<void>;
  abrirVenda: () => void;
  definirClientePadrao: (cliente: { nome: string; cpf: string }) => void;
  definirCupomNumero: (numero: string) => void;
  adicionarItem: (produto: Produto, quantidade: number) => void;
  alterarQuantidade: (id: string, quantidade: number) => void;
  removerItem: (id: string) => void;
  selecionarItem: (id: string | null) => void;
  selecionarAnterior: () => void;
  selecionarProximo: () => void;
  setModalAtivo: (modal: ModalType) => void;
  cancelarCupom: () => Promise<void>;
  finalizarVenda: (pagamentos: Pagamento[]) => Promise<{ sucesso: boolean; erro?: string }>;
  iniciarEdicaoVenda: (venda: VendaDetalhe) => void;
  cancelarEdicaoVenda: () => Promise<void>;
}

const gerarId = () => Math.random().toString(36).substring(2, 9);

export const usePdvStore = create<PdvState>((set, get) => ({
  isCaixaAberto: false,
  fundoDeTroco: 0,
  cupomNumero: '000123',
  itens: [],
  itemSelecionadoId: null,
  cliente: null,
  clientePadrao: null,
  modalAtivo: 'NENHUM',
  vendaEmEdicaoId: null,

  abrirCaixa: async (valor) => {
    const resultado = await caixaService.abrir(valor);
    if (!resultado.sucesso) {
      useToastStore.getState().mostrarToast(`Falha ao abrir caixa: ${resultado.erro}`, 'erro');
      return;
    }
    set({ isCaixaAberto: true, fundoDeTroco: valor });
  },
  definirClientePadrao: (cliente) => set({ clientePadrao: cliente }),
  definirCupomNumero: (numero) => set({ cupomNumero: numero }),
  fecharCaixa: async () => {
    const resultado = await caixaService.fechar();
    if (!resultado.sucesso) {
      useToastStore.getState().mostrarToast(`Falha ao fechar caixa: ${resultado.erro}`, 'erro');
      return;
    }
    set({ isCaixaAberto: false, fundoDeTroco: 0, itens: [], cliente: null, modalAtivo: 'NENHUM' });
  },
  carregarEstadoCaixa: async () => {
    const estado = await caixaService.buscarEstado();
    if (estado) {
      set({ isCaixaAberto: estado.aberto, fundoDeTroco: estado.fundoDeTroco });
    }
  },

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

  cancelarCupom: async () => {
    const { vendaEmEdicaoId } = get();
    if (vendaEmEdicaoId) {
      await get().cancelarEdicaoVenda();
      return;
    }
    set({ itens: [], itemSelecionadoId: null, cliente: null, modalAtivo: 'NENHUM' });
  },

  iniciarEdicaoVenda: (venda) => {
    const itens: ItemVenda[] = venda.itens.map((item) => ({
      id: gerarId(),
      produto: {
        codigo: item.codigo,
        descricao: item.descricao,
        unidade: 'UN',
        preco: item.valorUnitario / 100,
        codigoBarras: '',
        grupo: '',
      },
      quantidade: item.quantidade,
      valorUnitario: item.valorUnitario,
      desconto: item.desconto,
      valorTotal: item.valorTotal,
    }));

    set({
      itens,
      itemSelecionadoId: itens[itens.length - 1]?.id || null,
      cliente: venda.clienteNome ? { nome: venda.clienteNome, cpf: venda.clienteCpf || '' } : null,
      cupomNumero: venda.numeroCupom,
      vendaEmEdicaoId: venda.id,
      modalAtivo: 'NENHUM',
    });
  },

  cancelarEdicaoVenda: async () => {
    set({ itens: [], itemSelecionadoId: null, cliente: null, vendaEmEdicaoId: null, modalAtivo: 'NENHUM' });
    const proximo = await vendaService.buscarProximoCupom();
    if (proximo) set({ cupomNumero: proximo });
  },

  finalizarVenda: async (pagamentos) => {
    const { cupomNumero, itens, cliente, clientePadrao, vendaEmEdicaoId } = get();
    const { loja, caixa, vendedor } = useAuthStore.getState();

    const subtotal = itens.reduce((acc, i) => acc + i.quantidade * i.valorUnitario, 0);
    const desconto = itens.reduce((acc, i) => acc + i.desconto, 0);
    const total = subtotal - desconto;

    const payload = {
      numeroCupom: cupomNumero,
      loja,
      caixa,
      operador: vendedor?.nome || '',
      cliente: cliente || clientePadrao,
      itens,
      subtotal,
      desconto,
      total,
      formaPagamento: pagamentos.map((p) => p.forma).join(', '),
      valorRecebido: pagamentos[0]?.valorRecebido,
      troco: pagamentos[0]?.troco,
    };

    const resultado = vendaEmEdicaoId
      ? await vendaService.atualizarVenda(vendaEmEdicaoId, payload)
      : await vendaService.registrarVenda(payload);

    if (!resultado.sucesso) {
      return resultado;
    }

    if (vendaEmEdicaoId) {
      set({ itens: [], itemSelecionadoId: null, cliente: null, modalAtivo: 'NENHUM', vendaEmEdicaoId: null });
      const proximo = await vendaService.buscarProximoCupom();
      if (proximo) set({ cupomNumero: proximo });
    } else {
      const proximoCupom = (parseInt(cupomNumero, 10) + 1).toString().padStart(cupomNumero.length, '0');
      set({
        itens: [],
        itemSelecionadoId: null,
        cliente: null,
        modalAtivo: 'NENHUM',
        cupomNumero: proximoCupom,
      });
    }

    return resultado;
  },
}));
