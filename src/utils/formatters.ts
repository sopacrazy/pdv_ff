export const formatMoney = (cents: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
};

export const parseMoney = (value: string): number => {
  const digits = value.replace(/\D/g, '');
  return parseInt(digits, 10) || 0;
};

export const formatMoneySegundaUnidade = (valorReais: number): string => new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL', minimumFractionDigits: 4, maximumFractionDigits: 4,
}).format(valorReais);
