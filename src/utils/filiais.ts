const NOMES_FILIAIS: Record<string, string> = {
  '01': 'Belém',
  '04': 'Castanhal',
  '06': 'Piedade',
};

export function nomeFilial(codigo: string): string {
  return NOMES_FILIAIS[codigo] || codigo;
}

export function rotuloFilial(codigo: string): string {
  const nome = NOMES_FILIAIS[codigo];
  return nome ? `${codigo} — ${nome}` : codigo;
}
