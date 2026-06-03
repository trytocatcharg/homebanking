import { BankAdapter } from './types';
import { SupervielleAdapter } from './adapters/supervielle.adapter';
import { GaliciaAdapter } from './adapters/galicia.adapter';


const adapters: Map<string, BankAdapter> = new Map();

export function registerAdapters(): void {
  const supervielle = new SupervielleAdapter();
  adapters.set(supervielle.bankId, supervielle);

  const galicia = new GaliciaAdapter();
  adapters.set(galicia.bankId, galicia);

  console.log(`[banks] Registered ${adapters.size} bank adapter(s)`);
}

export function getAdapter(bankId: string): BankAdapter | undefined {
  return adapters.get(bankId);
}

export function getAllAdapters(): BankAdapter[] {
  return Array.from(adapters.values());
}

export { BankAdapter } from './types';
