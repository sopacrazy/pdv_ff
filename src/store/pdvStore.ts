import { create } from 'zustand';
import { Produto } from '../types/produto';
import { ItemVenda, Pagamento } from '../types/venda';
import { useAuthStore } from './authStore';
import { useToastStore } from './toastStore';
import { vendaService } from '../services/vendaService';
import { caixaService } from '../services/caixaService';
import { paraPrimeiraUnidade } from '../utils/unidades';

export type ModalType = 'NENHUM' | 'BUSCA_PRODUTO' | 'QUANTIDADE' | 'DESCONTO' | 'CANCELAR_ITEM' | 'CANCELAR_CUPOM' | 'PAGAMENTO' | 'CLIENTE' | 'FECHAR_CAIXA';

interface PdvState {
  isCaixaAberto: boolean;
  fundoDeTroco: number;
  cupomNumero: string;
  itens: ItemVenda[];
  itemSelecionadoId: string | null;
  cliente: { nome: string; cpf: string; condicaoPagamento?: string | null } | null;
  clientePadrao: { nome: string; cpf: string; condicaoPagamento?: string | null } | null;
  modalAtivo: ModalType;

  // Actions
  abrirCaixa: (valor: number) => Promise<void>;
  fecharCaixa: () => Promise<void>;
  carregarEstadoCaixa: () => Promise<void>;
  abrirVenda: () => void;
  definirClientePadrao: (cliente: { nome: string; cpf: string; condicaoPagamento?: string | null }) => void;
  definirCupomNumero: (numero: string) => void;
  adicionarItem: (produto: Produto, quantidade: number) => void;
  alterarQuantidade: (id: string, quantidade: number) => void;
  alterarQuantidadeSegundaUnidade: (id: string, quantidadeSegunda: number) => void;
  removerItem: (id: string) => void;
  selecionarItem: (id: string | null) => void;
  selecionarAnterior: () => void;
  selecionarProximo: () => void;
  setModalAtivo: (modal: ModalType) => void;
  cancelarCupom: () => void;
  finalizarVenda: (pagamentos: Pagamento[]) => Promise<{ sucesso: boolean; erro?: string; id?: string }>;
}

const gerarId = () => Math.random().toString(36).substring(2, 9);

export const usePdvStore = create<PdvState>((set, get) => ({
  isCaixaAberto: false,
  fundoDeTroco: 0,
  // Vazio até a tela confirmar com o servidor. Nunca usar um valor "chutado" aqui: se a busca do
  // próximo cupom falhar (ex: backend fora do ar), é melhor a tela ficar sem número por um
  // instante do que arriscar registrar uma venda com numeração errada (o servidor decide o número
  // real no momento de salvar — isto aqui é só o texto mostrado no cabeçalho antes de finalizar).
  cupomNumero: '',
  itens: [],
  itemSelecionadoId: null,
  cliente: null,
  clientePadrao: null,
  modalAtivo: 'NENHUM',

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

  // O total da venda e o que vai pro Protheus sempre usam a 1ª unidade (preço da tabela 015) —
  // editar pela 2ª unidade (ex: peso lido na balança) só converte pra 1ª unidade antes de aplicar.
  alterarQuantidadeSegundaUnidade: (id, quantidadeSegunda) => {
    const { itens } = get();
    const novaLista = itens.map((item) => {
      if (item.id !== id) return item;
      const quantidade = paraPrimeiraUnidade(item.produto, quantidadeSegunda);
      if (quantidade === null) return item;
      return {
        ...item,
        quantidade,
        valorTotal: Math.round(quantidade * item.valorUnitario - item.desconto),
      };
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

  cancelarCupom: () => {
    set({ itens: [], itemSelecionadoId: null, cliente: null, modalAtivo: 'NENHUM' });
  },

  finalizarVenda: async (pagamentos) => {
    const { cupomNumero, itens, cliente, clientePadrao } = get();
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

    const resultado = await vendaService.registrarVenda(payload);
    if (!resultado.sucesso) {
      return resultado;
    }

    const idDaVenda = resultado.id;

    // Dispara o envio ao Protheus em segundo plano, sem travar o caixa esperando resposta remota.
    // Se não houver internet agora, a venda fica salva com status 'LOCAL' e a fila do servidor
    // (processarFilaProtheus) entrega sozinha assim que a conexão voltar — nada a fazer aqui.
    if (idDaVenda) {
      const { token } = useAuthStore.getState();
      if (token) vendaService.enviarProtheus(idDaVenda, token, { rapido: true });
    }

    set({ itens: [], itemSelecionadoId: null, cliente: null, modalAtivo: 'NENHUM' });
    // Busca o próximo número confirmado pelo servidor em vez de incrementar aqui — o cupom da
    // venda que acabou de ser salva já foi decidido pelo backend (ver vendaService.registrarVenda);
    // isto aqui é só a prévia mostrada no cabeçalho antes da próxima venda.
    const proximo = await vendaService.buscarProximoCupom();
    if (proximo) set({ cupomNumero: proximo });

    return { ...resultado, id: idDaVenda };
  },

}));
