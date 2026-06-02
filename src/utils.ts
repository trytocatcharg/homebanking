export function formatAmount(amount: number, symbol: string): string {
  const formatted = amount.toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${symbol} ${formatted}`;
}
