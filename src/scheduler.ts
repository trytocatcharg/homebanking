import cron from 'node-cron';
import { prepareDailyLogin, getIsPaused } from './authManager';

export function scheduleDailyPrep(): void {
  console.log('[scheduler] Scheduling daily login preparation at 00:00');

  cron.schedule(
    '0 0 * * *',
    async () => {
      if (getIsPaused()) {
        console.log('[scheduler] Skipping — bot is paused');
        return;
      }
      console.log('[scheduler] Running scheduled login preparation');
      try {
        await prepareDailyLogin();
      } catch (error) {
        console.error('[scheduler] Login preparation failed:', error);
      }
    },
    {
      scheduled: true,
      timezone: process.env.TIMEZONE || 'Europe/Madrid',
    }
  );
}
