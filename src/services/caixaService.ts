export interface EstadoCaixa {
  aberto: boolean;
  fundoDeTroco: number;
}

async function tratarResposta(resp: Response): Promise<{ sucesso: boolean; erro?: string }> {
  if (!resp.ok) {
    const corpo = await resp.json().catch(() => ({}));
    return { sucesso: false, erro: corpo.erro || `Erro HTTP ${resp.status}` };
  }
  return { sucesso: true };
}

export const caixaService = {
  buscarEstado: async (): Promise<EstadoCaixa | null> => {
    try {
      const resp = await fetch('/api/caixa');
      if (!resp.ok) return null;
      return resp.json();
    } catch {
      return null;
    }
  },

  abrir: async (fundoDeTroco: number): Promise<{ sucesso: boolean; erro?: string }> => {
    try {
      const resp = await fetch('/api/caixa/abrir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fundoDeTroco }),
      });
      return tratarResposta(resp);
    } catch (erro) {
      return { sucesso: false, erro: erro instanceof Error ? erro.message : 'Falha ao conectar com o servidor local' };
    }
  },

  fechar: async (): Promise<{ sucesso: boolean; erro?: string }> => {
    try {
      const resp = await fetch('/api/caixa/fechar', { method: 'POST' });
      return tratarResposta(resp);
    } catch (erro) {
      return { sucesso: false, erro: erro instanceof Error ? erro.message : 'Falha ao conectar com o servidor local' };
    }
  },
};
