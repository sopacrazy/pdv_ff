export interface Produto {
  codigo: string; // B1_COD
  descricao: string; // B1_DESC
  unidade: string; // B1_UM (primeira unidade)
  segundaUnidade?: string | null; // B1_SEGUM
  fatorConversao?: number | null; // B1_CONV
  tipoConversao?: 'D' | 'M' | string | null; // B1_TIPCONV — 'D' divide a 1ª unidade pelo fator pra achar a 2ª, 'M' multiplica
  preco: number; // B1_PRCVEN
  codigoBarras: string; // B1_CODBAR
  grupo: string; // B1_GRUPO
}

export interface ProdutoService {
  buscarPorCodigoOuBarras(codigo: string): Promise<Produto | null>;
  buscarPorDescricao(descricao: string): Promise<Produto[]>;
}
