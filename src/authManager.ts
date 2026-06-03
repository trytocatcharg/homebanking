import fs from 'fs';
import path from 'path';
import { banks } from './config/banks';
import { createBrowser, closeBrowser } from './browser';
import { registerAdapters, getAllAdapters as getAllRegisteredAdapters } from './banks';
import { AccountBalance } from './banks/types';

const storagePath = path.resolve(__dirname, '..', 'storage', 'cookies');
const STORAGE_DIR_MODE = 0o700;
const STORAGE_FILE_MODE = 0o600;

let isRunning = false;
let isPaused = false;

export interface PrepareLoginResult {
  bankId: string;
  bankName: string;
  status: 'pending_credentials' | 'authenticated' | 'login_failed' | 'error';
  preparedAt?: string;
  attemptedAt?: string;
  loginAt?: string;
  balance?: AccountBalance | null;
  error?: string;
}

interface PersistedBankState {
  bankId: string;
  status: PrepareLoginResult['status'];
  preparedAt?: string;
  attemptedAt?: string;
  loginAt?: string;
  error?: string;
}

export function getIsPaused(): boolean {
  return isPaused;
}

export function setPaused(value: boolean): void {
  isPaused = value;
}

function ensureCookieStorage(): void {
  if (!fs.existsSync(storagePath)) {
    fs.mkdirSync(storagePath, { recursive: true, mode: STORAGE_DIR_MODE });
    console.log('[authManager] Created cookie storage directory:', storagePath);
  }

  try {
    fs.chmodSync(storagePath, STORAGE_DIR_MODE);
  } catch (err) {
    console.warn('[authManager] Could not enforce storage directory permissions:', err);
  }
}

function persistBankState(bankId: string, state: PersistedBankState): void {
  const filePath = path.join(storagePath, `${bankId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2), {
    encoding: 'utf8',
    mode: STORAGE_FILE_MODE,
  });

  try {
    fs.chmodSync(filePath, STORAGE_FILE_MODE);
  } catch (err) {
    console.warn(`[authManager] Could not enforce permissions for ${bankId}:`, err);
  }
}

export function getIsRunning(): boolean {
  return isRunning;
}

export async function prepareDailyLogin(): Promise<PrepareLoginResult[]> {
  isRunning = true;
  const debug = process.env.MODE_DEBUG === 'true';
  const results: PrepareLoginResult[] = [];

  try {
    ensureCookieStorage();
    registerAdapters();
    const registeredAdapters = getAllRegisteredAdapters();

    console.log(`[authManager] Preparing login for ${registeredAdapters.length} banks`);

    for (const adapter of registeredAdapters) {
      const bankConfig = banks.find((b) => b.id === adapter.bankId);

      if (!bankConfig) {
        console.warn(`[authManager] No config found for adapter: ${adapter.bankId}`);
        continue;
      }

      const envPrefix = bankConfig.credentialsEnvPrefix;
      const dni = process.env[`${envPrefix}_DNI`];
      const username = process.env[`${envPrefix}_USER`];
      const password = process.env[`${envPrefix}_PASS`];

      if (!dni || !username || !password) {
        const preparedAt = new Date().toISOString();
        const result: PrepareLoginResult = {
          bankId: adapter.bankId,
          bankName: bankConfig.name,
          preparedAt,
          status: 'pending_credentials',
        };

        console.log(`[authManager] No credentials found for ${bankConfig.name} (env: ${envPrefix}_DNI/USER/PASS)`);
        persistBankState(adapter.bankId, {
          bankId: adapter.bankId,
          preparedAt,
          status: 'pending_credentials',
        });
        results.push(result);
        continue;
      }

      let session;
      try {
        session = await createBrowser();
        const loginResult = await adapter.login({ dni, username, password }, session);

        if (loginResult.success) {
          const loginAt = new Date().toISOString();
          const result: PrepareLoginResult = {
            bankId: adapter.bankId,
            bankName: bankConfig.name,
            loginAt,
            status: 'authenticated',
            balance: loginResult.balance ?? null,
          };

          persistBankState(adapter.bankId, {
            bankId: adapter.bankId,
            loginAt,
            status: 'authenticated',
          });
          results.push(result);
          console.log(`[authManager] Successfully logged in: ${bankConfig.name}`);
        } else {
          const attemptedAt = new Date().toISOString();
          const error = loginResult.error || loginResult.message;
          const result: PrepareLoginResult = {
            bankId: adapter.bankId,
            bankName: bankConfig.name,
            attemptedAt,
            status: 'login_failed',
            error,
          };

          persistBankState(adapter.bankId, {
            bankId: adapter.bankId,
            attemptedAt,
            status: 'login_failed',
            error,
          });
          results.push(result);
          console.error(`[authManager] Login failed for ${bankConfig.name}: ${loginResult.message}`);
        }
      } catch (err) {
        const attemptedAt = new Date().toISOString();
        const error = err instanceof Error ? err.message : String(err);
        const result: PrepareLoginResult = {
          bankId: adapter.bankId,
          bankName: bankConfig.name,
          attemptedAt,
          status: 'error',
          error,
        };

        console.error(`[authManager] Error during login for ${bankConfig.name}:`, err);
        persistBankState(adapter.bankId, {
          bankId: adapter.bankId,
          attemptedAt,
          status: 'error',
          error,
        });
        results.push(result);
      } finally {
        if (session) {
          if (debug) {
            console.log(`[authManager] Debug mode activo: se mantiene abierto el browser para ${adapter.bankId}`);
          } else {
            await closeBrowser(session);
          }
        }
      }
    }

    return results;
  } finally {
    isRunning = false;
    console.log('[authManager] Daily login preparation complete');
  }
}

export { storagePath };
