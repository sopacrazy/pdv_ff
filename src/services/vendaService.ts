import { ItemVenda } from '../types/venda';

export interface VendaParaSalvar {
  numeroCupom: string;
  loja: string;
  caixa: string;
  cliente: { nome: string; cpf: string; codigo?: string; loja?: string; tabelaPreco?: string; nomeAVista?: string } | null;
  itens: ItemVenda[];
  subtotal: number;
  desconto: number;
  total: number;
  formaPagamento: string;
  valorRecebido?: number;
  troco?: number;
  tipoOperacao?: 'PDV' | 'BILHETE';
}

export type StatusProtheus = 'LOCAL' | 'INTEGRADO' | 'PREPARANDO' | 'CONFERIR' | 'REJEITADO' | 'EXCLUIDO_PROTHEUS';

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
  totalAntesArredondamento?: number | null;
  arredondamentoCorrigidoEm?: string | null;
  formaPagamento: string;
  criadoEm: string;
  dataLocal?: string;
  editadoEm: string | null;
  statusProtheus: StatusProtheus;
  protheusAtualizadoEm?: string | null;
  protheusConferidoEm?: string | null;
  protheusExcluidoEm?: string | null;
  bilheteProtheus?: string;
  resultadoProtheus?: ResultadoEnvioProtheus;
  valorRecebido: number | null;
  troco: number | null;
  tipoOperacao: 'PDV' | 'BILHETE';
  clienteCodigo?: string | null;
  clienteLoja?: string | null;
  tabelaPreco?: string | null;
}

export interface VendaDetalhe extends VendaResumo {
  dataLocal?: string;
  edicoesQuantidade?: { codigo: string; quantidadeAnterior: number; quantidadeNova: number; totalAnterior: number; totalNovo: number; editadoEm: string; usuario: string }[];
  ajustesPreco?: { codigo: string; totalItemAnterior: number; totalItemNovo: number; totalAnterior: number; totalNovo: number; ajustadoEm: string; usuario: string }[];
  impressao?: {
    clienteFantasia?: string; clienteEndereco?: string; clienteCidade?: string;
    clienteRg?: string; clienteTelefone?: string; clienteFax?: string;
    rota?: string; vendedorCodigo?: string; vendedorNome?: string;
    condicaoDescricao?: string; pesoTotal?: number;
  };
  itens: {
    id: string;
    codigo: string;
    descricao: string;
    quantidade: number;
    valorUnitario: number;
    desconto: number;
    valorTotal: number;
    unidade: string | null;
    // Segunda unidade (ex: KG quando a 1ª é CX) e sua quantidade convertida, gravadas no momento
    // da venda — ver server/db.js migração 5 e server/api.js calcularQuantidade2.
    unidade2: string | null;
    quantidade2: number | null;
    pesoUnitario?: number | null;
  }[];
}

export interface ResultadoEnvioProtheus {
  sucesso: boolean;
  status?: number;
  resposta?: unknown;
  payloadEnviado?: unknown;
  erro?: string;
  semInternet?: boolean;
  bilhete?: string | null;
}

export const vendaService = {
  conferirProtheus: async (token: string): Promise<{ sucesso: boolean; excluidas?: number; restauradas?: number; naoLocalizadas?: number; erro?: string }> => {
    try {
      const resposta = await fetch('/api/vendas/conferir-protheus', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      return await resposta.json();
    } catch { return { sucesso: false, erro: 'Não foi possível conferir os bilhetes.' }; }
  },
  // O número do cupom é decidido pelo servidor (contador atômico na mesma transação do insert) —
  // o que a tela manda em `venda.numeroCupom` é só um preview, nunca é o valor realmente gravado.
  registrarVenda: async (venda: VendaParaSalvar, token: string): Promise<{ sucesso: boolean; id?: string; numeroCupom?: string; erro?: string }> => {
    try {
      const resp = await fetch('/api/vendas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(venda),
      });
      if (!resp.ok) {
        const corpo = await resp.json().catch(() => ({}));
        return { sucesso: false, erro: corpo.erro || `Erro HTTP ${resp.status}` };
      }
      const corpo = await resp.json();
      return { sucesso: true, id: corpo.id, numeroCupom: corpo.numeroCupom };
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

  listarVendasPeriodo: async (inicio: string, fim: string): Promise<VendaResumo[]> => {
    const params = new URLSearchParams({ inicio, fim });
    const resp = await fetch(`/api/vendas?${params}`);
    if (!resp.ok) throw new Error('Não foi possível consultar as vendas do período.');
    return resp.json();
  },

  buscarVenda: async (id: string): Promise<VendaDetalhe | null> => {
    const resp = await fetch(`/api/vendas/${encodeURIComponent(id)}`);
    if (!resp.ok) return null;
    return resp.json();
  },

  editarQuantidadeRejeitada: async (id: string, itemId: string, quantidade: number, token: string): Promise<{ sucesso: boolean; erro?: string }> => {
    try {
      const resp = await fetch(`/api/vendas/${encodeURIComponent(id)}/itens/${encodeURIComponent(itemId)}/quantidade`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ quantidade }),
      });
      const corpo = await resp.json().catch(() => ({}));
      return resp.ok ? { sucesso: true } : { sucesso: false, erro: corpo.erro || `Erro HTTP ${resp.status}` };
    } catch (erro) {
      return { sucesso: false, erro: erro instanceof Error ? erro.message : 'Falha ao conectar com o servidor local' };
    }
  },

  recalcularArredondamentoRejeitado: async (id: string, totalAtualEsperado: number, totalEsperado: number, token: string): Promise<{ sucesso: boolean; erro?: string }> => {
    try {
      const resp = await fetch(`/api/vendas/${encodeURIComponent(id)}/recalcular-arredondamento`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ confirmado: true, totalAtualEsperado, totalEsperado }),
      });
      const corpo = await resp.json().catch(() => ({}));
      return resp.ok ? { sucesso: true } : { sucesso: false, erro: corpo.erro || `Erro HTTP ${resp.status}` };
    } catch (erro) {
      return { sucesso: false, erro: erro instanceof Error ? erro.message : 'Falha ao conectar com o servidor local' };
    }
  },

  // Manda imprimir direto na impressora térmica (ESC/POS via RAW print, ver
  // server/impressora-termica.js) — não usa mais window.print()/HTML.
  imprimirVenda: async (id: string, token: string): Promise<{ sucesso: boolean; erro?: string }> => {
    try {
      const resp = await fetch(`/api/vendas/${encodeURIComponent(id)}/imprimir`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
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

  // Só uma prévia pro cabeçalho — quem decide o número de verdade é o servidor, no momento de
  // salvar (ver registrarVenda). Uma falha aqui não pode travar nem inventar número nenhum.
  buscarProximoCupom: async (): Promise<string | null> => {
    try {
      const resp = await fetch('/api/vendas/proximo-cupom');
      if (!resp.ok) return null;
      const corpo = await resp.json();
      return corpo.proximoCupom;
    } catch {
      return null;
    }
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

  reprocessarProtheus: async (id: string, token: string): Promise<ResultadoEnvioProtheus> => {
    try {
      const resp = await fetch(`/api/vendas/${encodeURIComponent(id)}/enviar-protheus?reprocessar=1`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const corpo = await resp.json().catch(() => ({}));
      return { ...corpo, sucesso: Boolean(corpo.sucesso) };
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
