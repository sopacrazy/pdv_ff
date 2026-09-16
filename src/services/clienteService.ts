export interface ClientePadrao {
  nome: string;
  cpf: string;
}

export const clienteService = {
  buscarClientePadrao: async (): Promise<ClientePadrao | null> => {
    const resp = await fetch('/api/cliente-padrao');
    if (!resp.ok) return null;
    return resp.json();
  },
};
