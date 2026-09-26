import { Produto } from '../types/produto';
import { ItemVenda } from '../types/venda';

export interface ClienteBilhete {
  codigo: string;
  loja: string;
  nome: string;
  fantasia: string;
  cpfCnpj: string;
  condicaoPagamento: string;
  condicaoDescricao?: string;
  tabelaPreco: string;
  tabelaDescricao?: string;
  risco?: string;
  limiteCredito: number;
  saldoCredito?: number | null;
  inadimplencia?: number | null;
  status?: string;
  vencimentoMaisAntigo?: string | null;
  creditoAtualizadoEm?: string | null;
  atualizadoEm: string;
}

const autorizacao = (token: string) => ({ Authorization: `Bearer ${token}` });

export const bilheteService = {
  validar: async (cliente: ClienteBilhete | null, itens: ItemVenda[], total: number, nomeClienteAVista: string, token: string): Promise<string[]> => {
    if (!cliente) return ['Selecione o cliente do Bilhete.'];
    if (!itens.length) return ['Inclua ao menos um produto no Bilhete.'];
    try {
      const resposta = await fetch('/api/bilhetes/validar', {
        method: 'POST',
        headers: { ...autorizacao(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ cliente: { ...cliente, nomeAVista: nomeClienteAVista }, itens, subtotal: total, desconto: 0, total, tipoOperacao: 'BILHETE' }),
      });
      const corpo = await resposta.json().catch(() => ({}));
      if (Array.isArray(corpo.erros)) return corpo.erros;
      return resposta.ok ? [] : [corpo.erro || `Falha na validação local: HTTP ${resposta.status}`];
    } catch (erro) {
      return [erro instanceof Error ? erro.message : 'Não foi possível validar o Bilhete no servidor local.'];
    }
  },

  buscarClientes: async (termo: string, token: string): Promise<ClienteBilhete[]> => {
    if (termo.trim().length < 2) return [];
    const resposta = await fetch(`/api/bilhetes/clientes?q=${encodeURIComponent(termo.trim())}`, { headers: autorizacao(token) });
    return resposta.ok ? resposta.json() : [];
  },

  sincronizarFinanceiroCliente: async (cliente: ClienteBilhete, token: string): Promise<void> => {
    await fetch(
      `/api/bilhetes/clientes/${encodeURIComponent(cliente.codigo)}/${encodeURIComponent(cliente.loja)}/sincronizar-financeiro`,
      { method: 'POST', headers: autorizacao(token) }
    );
  },

  buscarProdutos: async (cliente: ClienteBilhete | null, termo: string, token: string): Promise<{ produtos: Produto[]; erro?: string }> => {
    if (!termo.trim()) return { produtos: [] };
    try {
      const contextoCliente = cliente
        ? `&cliente=${encodeURIComponent(cliente.codigo)}&loja=${encodeURIComponent(cliente.loja)}`
        : '';
      const resposta = await fetch(
        `/api/bilhetes/produtos?q=${encodeURIComponent(termo.trim())}${contextoCliente}`,
        { headers: autorizacao(token) }
      );
      const corpo = await resposta.json().catch(() => ({}));
      if (!resposta.ok) return { produtos: [], erro: corpo.erro || `Erro HTTP ${resposta.status}` };
      return { produtos: corpo };
    } catch (erro) {
      return { produtos: [], erro: erro instanceof Error ? erro.message : 'Falha ao consultar o cache do Bilhete.' };
    }
  },
};
