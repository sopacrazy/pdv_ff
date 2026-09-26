import { ConfiguracaoSistema } from '../types/usuario';

function headers(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export const configuracaoService = {
  buscar: async (token: string): Promise<ConfiguracaoSistema | null> => {
    try {
      const resp = await fetch('/api/configuracoes', { headers: headers(token) });
      if (!resp.ok) return null;
      return resp.json();
    } catch {
      return null;
    }
  },

  salvar: async (
    token: string,
    dados: Pick<ConfiguracaoSistema, 'filial' | 'caixa'>
  ): Promise<{ sucesso: boolean; configuracao?: ConfiguracaoSistema; erro?: string }> => {
    try {
      const resp = await fetch('/api/configuracoes', {
        method: 'PUT',
        headers: { ...headers(token), 'Content-Type': 'application/json' },
        body: JSON.stringify(dados),
      });
      const corpo = await resp.json().catch(() => ({}));
      if (!resp.ok) return { sucesso: false, erro: corpo.erro || `Erro HTTP ${resp.status}` };
      return { sucesso: true, configuracao: corpo.configuracao };
    } catch (erro) {
      return {
        sucesso: false,
        erro: erro instanceof Error ? erro.message : 'Falha ao salvar a configuração local',
      };
    }
  },
};
