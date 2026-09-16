import { Produto, ProdutoService } from '../types/produto';

// Geração de EAN-13 válido simplificada para mock
// O último dígito é o verificador
const gerarEAN13 = (prefixo: string): string => {
  let soma = 0;
  for (let i = 0; i < 12; i++) {
    soma += parseInt(prefixo[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const digitoVerificador = (10 - (soma % 10)) % 10;
  return `${prefixo}${digitoVerificador}`;
};

export const mockProdutos: Produto[] = [
  { codigo: '0001', descricao: 'REFRIGERANTE COLA 2L', unidade: 'UN', preco: 8.50, codigoBarras: gerarEAN13('789123456001'), grupo: 'BEBIDAS' },
  { codigo: '0002', descricao: 'CERVEJA PILSEN LATA 350ML', unidade: 'UN', preco: 3.50, codigoBarras: gerarEAN13('789123456002'), grupo: 'BEBIDAS' },
  { codigo: '0003', descricao: 'SUCO DE LARANJA 1L', unidade: 'UN', preco: 6.90, codigoBarras: gerarEAN13('789123456003'), grupo: 'BEBIDAS' },
  { codigo: '0004', descricao: 'ARROZ BRANCO 5KG', unidade: 'PC', preco: 22.90, codigoBarras: gerarEAN13('789123456004'), grupo: 'ALIMENTOS' },
  { codigo: '0005', descricao: 'FEIJAO CARIOCA 1KG', unidade: 'UN', preco: 8.90, codigoBarras: gerarEAN13('789123456005'), grupo: 'ALIMENTOS' },
  { codigo: '0006', descricao: 'MACARRAO ESPAGUETE 500G', unidade: 'UN', preco: 4.50, codigoBarras: gerarEAN13('789123456006'), grupo: 'ALIMENTOS' },
  { codigo: '0007', descricao: 'MOLHO DE TOMATE SACHE 340G', unidade: 'UN', preco: 2.30, codigoBarras: gerarEAN13('789123456007'), grupo: 'ALIMENTOS' },
  { codigo: '0008', descricao: 'OLEO DE SOJA 900ML', unidade: 'UN', preco: 6.50, codigoBarras: gerarEAN13('789123456008'), grupo: 'ALIMENTOS' },
  { codigo: '0009', descricao: 'ACUCAR REFINADO 1KG', unidade: 'UN', preco: 4.20, codigoBarras: gerarEAN13('789123456009'), grupo: 'ALIMENTOS' },
  { codigo: '0010', descricao: 'CAFE TORRADO E MOIDO 500G', unidade: 'UN', preco: 15.90, codigoBarras: gerarEAN13('789123456010'), grupo: 'ALIMENTOS' },
  { codigo: '0011', descricao: 'LEITE INTEGRAL 1L', unidade: 'UN', preco: 5.40, codigoBarras: gerarEAN13('789123456011'), grupo: 'LATICINIOS' },
  { codigo: '0012', descricao: 'MANTEIGA COM SAL 200G', unidade: 'UN', preco: 10.90, codigoBarras: gerarEAN13('789123456012'), grupo: 'LATICINIOS' },
  { codigo: '0013', descricao: 'QUEIJO MUSSARELA KG', unidade: 'KG', preco: 45.00, codigoBarras: '2000000000013', grupo: 'LATICINIOS' }, // Pesável (prefixo 2)
  { codigo: '0014', descricao: 'PRESUNTO COZIDO KG', unidade: 'KG', preco: 35.00, codigoBarras: '2000000000014', grupo: 'FRIOS' },
  { codigo: '0015', descricao: 'PAO DE FORMA TRADICIONAL 500G', unidade: 'UN', preco: 7.50, codigoBarras: gerarEAN13('789123456015'), grupo: 'PADARIA' },
  { codigo: '0016', descricao: 'BISCOITO RECHEADO CHOCOLATE 130G', unidade: 'UN', preco: 2.80, codigoBarras: gerarEAN13('789123456016'), grupo: 'DOCES' },
  { codigo: '0017', descricao: 'CHOCOLATE AO LEITE 90G', unidade: 'UN', preco: 5.90, codigoBarras: gerarEAN13('789123456017'), grupo: 'DOCES' },
  { codigo: '0018', descricao: 'SABAO EM PO 1KG', unidade: 'UN', preco: 12.50, codigoBarras: gerarEAN13('789123456018'), grupo: 'LIMPEZA' },
  { codigo: '0019', descricao: 'DETERGENTE LIQUIDO 500ML', unidade: 'UN', preco: 2.20, codigoBarras: gerarEAN13('789123456019'), grupo: 'LIMPEZA' },
  { codigo: '0020', descricao: 'AMACIANTE DE ROUPAS 2L', unidade: 'UN', preco: 9.80, codigoBarras: gerarEAN13('789123456020'), grupo: 'LIMPEZA' },
  { codigo: '0021', descricao: 'DESINFETANTE PINHO 1L', unidade: 'UN', preco: 5.50, codigoBarras: gerarEAN13('789123456021'), grupo: 'LIMPEZA' },
  { codigo: '0022', descricao: 'PAPEL HIGIENICO 4 ROLOS', unidade: 'PC', preco: 6.90, codigoBarras: gerarEAN13('789123456022'), grupo: 'HIGIENE' },
  { codigo: '0023', descricao: 'CREME DENTAL 90G', unidade: 'UN', preco: 3.50, codigoBarras: gerarEAN13('789123456023'), grupo: 'HIGIENE' },
  { codigo: '0024', descricao: 'SABONETE EM BARRA 90G', unidade: 'UN', preco: 1.80, codigoBarras: gerarEAN13('789123456024'), grupo: 'HIGIENE' },
  { codigo: '0025', descricao: 'SHAMPOO CABELOS NORMAIS 350ML', unidade: 'UN', preco: 14.90, codigoBarras: gerarEAN13('789123456025'), grupo: 'HIGIENE' },
  { codigo: '0026', descricao: 'CONDICIONADOR 350ML', unidade: 'UN', preco: 16.90, codigoBarras: gerarEAN13('789123456026'), grupo: 'HIGIENE' },
  { codigo: '0027', descricao: 'DESODORANTE AEROSSOL 150ML', unidade: 'UN', preco: 12.90, codigoBarras: gerarEAN13('789123456027'), grupo: 'HIGIENE' },
  { codigo: '0028', descricao: 'FRALDA DESCARTAVEL M 30 UN', unidade: 'PC', preco: 39.90, codigoBarras: gerarEAN13('789123456028'), grupo: 'BEBE' },
  { codigo: '0029', descricao: 'LAMINA DE BARBEAR C/ 2', unidade: 'UN', preco: 8.50, codigoBarras: gerarEAN13('789123456029'), grupo: 'HIGIENE' },
  { codigo: '0030', descricao: 'PILHA ALCALINA AA C/ 4', unidade: 'PC', preco: 18.90, codigoBarras: gerarEAN13('789123456030'), grupo: 'BAZAR' },
];

export const produtoServiceMock: ProdutoService = {
  buscarPorCodigoOuBarras: async (codigo) => {
    // Simula delay de rede
    await new Promise(resolve => setTimeout(resolve, 150));
    const produto = mockProdutos.find(p => p.codigo === codigo || p.codigoBarras === codigo);
    return produto || null;
  },
  buscarPorDescricao: async (descricao) => {
    await new Promise(resolve => setTimeout(resolve, 150));
    const termo = descricao.toLowerCase();
    return mockProdutos.filter(p => p.descricao.toLowerCase().includes(termo));
  }
};
