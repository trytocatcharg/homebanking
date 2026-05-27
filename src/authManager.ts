import fs from 'fs';
import path from 'path';
import { banks } from './config/banks';
import { createBrowser, closeBrowser } from './browser';
import { registerAdapters, getAllAdapters as getAllRegisteredAdapters } from './banks';
import { stripSensitiveFields } from './utils';

const storagePath = path.resolve(__dirname, '..', 'storage', 'cookies');

let isRunning = false;
let isPaused = false;

export function getIsPaused(): boolean {
  return isPaused;
}

export function setPaused(value: boolean): void {
  isPaused = value;
}

function ensureCookieStorage(): void {
  if (!fs.existsSync(storagePath)) {
    fs.mkdirSync(storagePath, { recursive: true });
    console.log('[authManager] Created cookie storage directory:', storagePath);
  }
}

export function getIsRunning(): boolean {
  return isRunning;
}

export async function prepareDailyLogin(): Promise<void> {
  isRunning = true;
  try {
  ensureCookieStorage();
  registerAdapters();
  const registeredAdapters = getAllRegisteredAdapters();

  console.log(`[authManager] Preparing login for ${registeredAdapters.length} banks`);

  for (const adapter of registeredAdapters) {
    const bankConfig = banks.find((b) => b.id === adapter.bankId);
    const cookieFile = path.join(storagePath, `${adapter.bankId}.json`);

    if (!bankConfig) {
      console.warn(`[authManager] No config found for adapter: ${adapter.bankId}`);
      continue;
    }

    const envPrefix = bankConfig.credentialsEnvPrefix;
    const dni = process.env[`${envPrefix}_DNI`];
    const username = process.env[`${envPrefix}_USER`];
    const password = process.env[`${envPrefix}_PASS`];

    if (!dni || !username || !password) {
      console.log(`[authManager] No credentials found for ${bankConfig.name} (env: ${envPrefix}_DNI/USER/PASS)`);
      if (!fs.existsSync(cookieFile)) {
        fs.writeFileSync(
          cookieFile,
          JSON.stringify({
            bankId: adapter.bankId,
            preparedAt: new Date().toISOString(),
            status: 'pending_credentials',
          }, null, 2),
          { encoding: 'utf8' }
        );
      }
      continue;
    }

    try {
      const session = await createBrowser();
      const result = await adapter.login({ dni, username, password }, session);
      await closeBrowser(session);

      if (result.success && result.cookies) {
        fs.writeFileSync(
          cookieFile,
          JSON.stringify({
            bankId: adapter.bankId,
            loginAt: new Date().toISOString(),
            status: 'authenticated',
            cookies: result.cookies,
            token: result.token ?? null,
            balance: result.balance ?? null,
            rawAccounts: result.rawAccounts ?? null,
          }, null, 2),
          { encoding: 'utf8' }
        );
        stripSensitiveFields(cookieFile);
        console.log(`[authManager] Successfully logged in: ${bankConfig.name}`);
      } else {
        fs.writeFileSync(
          cookieFile,
          JSON.stringify({
            bankId: adapter.bankId,
            attemptedAt: new Date().toISOString(),
            status: 'login_failed',
            error: result.error || result.message,
          }, null, 2),
          { encoding: 'utf8' }
        );
        console.error(`[authManager] Login failed for ${bankConfig.name}: ${result.message}`);
      }
    } catch (err) {
      console.error(`[authManager] Error during login for ${bankConfig.name}:`, err);
      fs.writeFileSync(
        cookieFile,
        JSON.stringify({
          bankId: adapter.bankId,
          attemptedAt: new Date().toISOString(),
          status: 'error',
          error: String(err),
        }, null, 2),
        { encoding: 'utf8' }
      );
    }
  }

  } finally {
    isRunning = false;
  }
  console.log('[authManager] Daily login preparation complete');
}

export { storagePath };
