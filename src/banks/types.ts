import { BrowserSession } from '../browser';

export interface AccountBalance {
  amount: number;
  symbol: string;
  formatted: string;
}

export interface BankLoginResult {
  success: boolean;
  message: string;
  cookies?: string;
  token?: string | null;
  balance?: AccountBalance | null;
  rawAccounts?: unknown;
  error?: string;
}

export interface BankCredentials {
  dni: string;
  username: string;
  password: string;
}

export interface BankAdapter {
  bankId: string;
  login(credentials: BankCredentials, session: BrowserSession): Promise<BankLoginResult>;
}
