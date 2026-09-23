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

export type StatusProtheus = 'LOCAL' | 'INTEGRADO' | 'PREPARANDO' | 'CONFERIR';

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
  bilheteProtheus?: string;
  resultadoProtheus?: ResultadoEnvioProtheus;
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

export interface ResultadoEnvioProtheus {
  sucesso: boolean;
  status?: number;
  resposta?: unknown;
  payloadEnviado?: unknown;
  erro?: string;
  semInternet?: boolean;
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

  resumoSemana: async (): Promise<{ data: string; quantidade: number; total: number }[]> => {
    try {
      const resp = await fetch('/api/vendas/resumo-semana');
      if (!resp.ok) return [];
      return resp.json();
    } catch {
      return [];
    }
  },

  buscarProximoCupom: async (): Promise<string | null> => {
    const resp = await fetch('/api/vendas/proximo-cupom');
    if (!resp.ok) return null;
    const corpo = await resp.json();
    return corpo.proximoCupom;
  },

  enviarProtheus: async (id: string, token: string, opcoes?: { rapido?: boolean }): Promise<ResultadoEnvioProtheus> => {
    try {
      const query = opcoes?.rapido ? '?rapido=1' : '';
      const resp = await fetch(`/api/vendas/${encodeURIComponent(id)}/enviar-protheus${query}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const corpo = await resp.json().catch(() => ({}));
      if (!resp.ok && !corpo.status) {
        return { sucesso: false, erro: corpo.erro || `Erro HTTP ${resp.status}`, semInternet: corpo.semInternet };
      }
      return corpo;
    } catch (erro) {
      return { sucesso: false, erro: erro instanceof Error ? erro.message : 'Falha ao conectar com o servidor local' };
    }
  },

  marcarIntegrado: async (id: string, token: string, bilhete: string): Promise<{ sucesso: boolean; erro?: string }> => {
    try {
      const resp = await fetch(`/api/vendas/${encodeURIComponent(id)}/marcar-integrado`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bilhete }),
      });
      const corpo = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        return { sucesso: false, erro: corpo.erro || `Erro HTTP ${resp.status}` };
      }
      return corpo;
    } catch (erro) {
      return { sucesso: false, erro: erro instanceof Error ? erro.message : 'Falha ao conectar com o servidor local' };
    }
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
