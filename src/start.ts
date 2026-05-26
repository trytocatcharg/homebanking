import * as dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import { prepareDailyLogin, storagePath } from './authManager';
import { scheduleDailyPrep } from './scheduler';
import { stripSensitiveFields } from './utils';
import './bot';

const debug = process.env.MODE_DEBUG === 'true';

async function start(): Promise<void> {
  if (debug) {
    console.log('[debug] Ejecutando login...');
    await prepareDailyLogin();

    const files = fs.existsSync(storagePath)
      ? fs.readdirSync(storagePath).filter((f) => f.endsWith('.json'))
      : [];

    for (const file of files) {
      const filePath = path.join(storagePath, file);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const balance = data.balance?.formatted ?? 'sin saldo';
      console.log(`[debug] ${data.bankId}: ${data.status} — ${balance}`);

      stripSensitiveFields(filePath);
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
