import * as dotenv from 'dotenv';
dotenv.config();

import { prepareDailyLogin } from './authManager';
import { scheduleDailyPrep } from './scheduler';
import './bot';

const debug = process.env.MODE_DEBUG === 'true';

async function start(): Promise<void> {
  if (debug) {
    console.log('[debug] Ejecutando login...');
    const results = await prepareDailyLogin();

    for (const result of results) {
      const balance = result.balance?.formatted ?? 'sin saldo';
      console.log(`[debug] ${result.bankId}: ${result.status} — ${balance}`);
    }
    return;
  }

  console.log('Starting...');
  try {
    await prepareDailyLogin();
    scheduleDailyPrep();
  } catch (err) {
    console.error('Startup error during login preparation:', err);
  }
}

start().catch((e) => console.error('Unhandled startup error:', e));
