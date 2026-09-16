import { ItemVenda } from '../types/venda';

export interface VendaParaSalvar {
  numeroCupom: string;
  loja: string;
  caixa: string;
  operador: string;
  cliente: { nome: string; cpf: string } | null;
  itens: ItemVenda[];
  subtotal: number;
  desconto: number;
  total: number;
  formaPagamento: string;
  valorRecebido?: number;
  troco?: number;
}

export type StatusProtheus = 'LOCAL' | 'INTEGRADO';

export interface VendaResumo {
  id: string;
  numeroCupom: string;
  loja: string;
  caixa: string;
  operador: string;
  clienteNome: string | null;
  clienteCpf: string | null;
  subtotal: number;
  desconto: number;
  total: number;
  formaPagamento: string;
  criadoEm: string;
  editadoEm: string | null;
  statusProtheus: StatusProtheus;
  valorRecebido: number | null;
  troco: number | null;
}

export interface VendaDetalhe extends VendaResumo {
  itens: {
    codigo: string;
    descricao: string;
    quantidade: number;
    valorUnitario: number;
    desconto: number;
    valorTotal: number;
  }[];
}

export const vendaService = {
  registrarVenda: async (venda: VendaParaSalvar): Promise<{ sucesso: boolean; id?: string; erro?: string }> => {
    try {
      const resp = await fetch('/api/vendas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(venda),
      });
      if (!resp.ok) {
        const corpo = await resp.json().catch(() => ({}));
        return { sucesso: false, erro: corpo.erro || `Erro HTTP ${resp.status}` };
      }
      const corpo = await resp.json();
      return { sucesso: true, id: corpo.id };
    } catch (erro) {
      return { sucesso: false, erro: erro instanceof Error ? erro.message : 'Falha ao conectar com o servidor local' };
    }
  },

  listarVendasDoDia: async (data?: string): Promise<VendaResumo[]> => {
    const query = data ? `?data=${encodeURIComponent(data)}` : '';
    const resp = await fetch(`/api/vendas${query}`);
    if (!resp.ok) return [];
    return resp.json();
  },

  buscarVenda: async (id: string): Promise<VendaDetalhe | null> => {
    const resp = await fetch(`/api/vendas/${encodeURIComponent(id)}`);
    if (!resp.ok) return null;
    return resp.json();
  },

  atualizarVenda: async (id: string, venda: VendaParaSalvar): Promise<{ sucesso: boolean; erro?: string }> => {
    try {
      const resp = await fetch(`/api/vendas/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(venda),
      });
      if (!resp.ok) {
        const corpo = await resp.json().catch(() => ({}));
        return { sucesso: false, erro: corpo.erro || `Erro HTTP ${resp.status}` };
      }
      return { sucesso: true };
    } catch (erro) {
      return { sucesso: false, erro: erro instanceof Error ? erro.message : 'Falha ao conectar com o servidor local' };
    }
  },

  buscarProximoCupom: async (): Promise<string | null> => {
    const resp = await fetch('/api/vendas/proximo-cupom');
    if (!resp.ok) return null;
    const corpo = await resp.json();
    return corpo.proximoCupom;
  },

  excluirVenda: async (id: string): Promise<{ sucesso: boolean; erro?: string }> => {
    try {
      const resp = await fetch(`/api/vendas/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!resp.ok) {
        const corpo = await resp.json().catch(() => ({}));
        return { sucesso: false, erro: corpo.erro || `Erro HTTP ${resp.status}` };
      }
      return { sucesso: true };
    } catch (erro) {
      return { sucesso: false, erro: erro instanceof Error ? erro.message : 'Falha ao conectar com o servidor local' };
    }
  },
};
