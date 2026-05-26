import fs from 'fs';

export function stripSensitiveFields(filePath: string): void {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const { cookies: _, token: __, ...sanitized } = data;
  fs.writeFileSync(filePath, JSON.stringify(sanitized, null, 2), { encoding: 'utf8' });
}

export function formatAmount(amount: number, symbol: string): string {
  const formatted = amount.toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${symbol} ${formatted}`;
}
