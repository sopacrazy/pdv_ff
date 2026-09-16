import { create } from 'zustand';
import { Bilhete, Cliente, ItemBilhete } from '../types/bilhete';

const gerarId = () => Math.random().toString(36).substring(2, 9);

const gerarNumero = () => {
  const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let resultado = '';
  for (let i = 0; i < 6; i++) resultado += letras[Math.floor(Math.random() * letras.length)];
  return resultado;
};

export const CLIENTES_MOCK: Cliente[] = [
  { codigo: '374132', loja: '01', nome: 'FORMOSA DUQUE COMERCIO DE FRUTAS', condPagamentoPadrao: 'A Prazo', limiteCredito: 1500000 },
  { codigo: '000980', loja: '01', nome: 'GUILHERME BELEM HORTIFRUTI', condPagamentoPadrao: 'A Vista', limiteCredito: 500000 },
  { codigo: '000535', loja: '01', nome: 'CAMARAO BELEM DISTRIBUIDORA', condPagamentoPadrao: 'Boleto', limiteCredito: 2200000 },
  { codigo: '000372', loja: '01', nome: 'DELIO BELEM MERCEARIA', condPagamentoPadrao: 'A Prazo', limiteCredito: 800000 },
  { codigo: '000001', loja: '01', nome: 'CONSUMIDOR FINAL - A VISTA', condPagamentoPadrao: 'A Vista', limiteCredito: 0 },
];

function criarItem(codigo: string, descricao: string, quantidade: number, unidade: string, precoUnitario: number): ItemBilhete {
  return {
    id: gerarId(),
    codigo,
    descricao,
    quantidade,
    unidade,
    precoUnitario,
    total: Math.round(quantidade * precoUnitario),
  };
}

const bilhetesIniciais: Bilhete[] = [
  {
    id: gerarId(),
    numero: 'SARPYB',
    data: new Date(Date.now() - 86400000).toISOString(),
    cliente: CLIENTES_MOCK[0],
    vendedor: 'ILMAR SARAIVA SILVA',
    formaPagamento: 'A Prazo',
    condicaoPagamento: '30 DD',
    transportadora: 'Transp. Norte Ltda',
    rota: 'Rota Centro',
    precisaEntrega: true,
    itens: [
      criarItem('102.001', 'ABACAXI - G', 20, 'UN', 610),
      criarItem('253.107', 'UVA BLACK BANDEJA 500G', 15, 'UN', 690),
      criarItem('134.039', 'BATATA BOLINHA 1 KG', 30, 'KG', 750),
    ],
    desconto: 0,
    status: 'CONFIRMADO',
    criadoEm: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: gerarId(),
    numero: 'KMTXQL',
    data: new Date().toISOString(),
    cliente: CLIENTES_MOCK[2],
    vendedor: 'OPERADOR PADRÃO',
    formaPagamento: 'Boleto',
    condicaoPagamento: '15/30 DD',
    transportadora: 'Frota Própria',
    rota: 'Rota Sul',
    precisaEntrega: true,
    itens: [
      criarItem('104.001', 'ACELGA', 50, 'UN', 1000),
      criarItem('106.001', 'AGRIAO', 40, 'MC', 600),
    ],
    desconto: 5000,
    status: 'RASCUNHO',
    criadoEm: new Date().toISOString(),
  },
];

interface BilheteState {
  bilhetes: Bilhete[];
  adicionarBilhete: (bilhete: Omit<Bilhete, 'id' | 'numero' | 'criadoEm'>) => Bilhete;
  atualizarBilhete: (id: string, bilhete: Omit<Bilhete, 'id' | 'numero' | 'criadoEm'>) => void;
  buscarBilhete: (id: string) => Bilhete | undefined;
}

export const useBilheteStore = create<BilheteState>((set, get) => ({
  bilhetes: bilhetesIniciais,

  adicionarBilhete: (dados) => {
    const novo: Bilhete = {
      ...dados,
      id: gerarId(),
      numero: gerarNumero(),
      criadoEm: new Date().toISOString(),
    };
    set({ bilhetes: [novo, ...get().bilhetes] });
    return novo;
  },

  atualizarBilhete: (id, dados) => {
    set({
      bilhetes: get().bilhetes.map((b) => (b.id === id ? { ...b, ...dados } : b)),
    });
  },

  buscarBilhete: (id) => get().bilhetes.find((b) => b.id === id),
}));
