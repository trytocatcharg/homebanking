import fs from 'fs';
import path from 'path';
import TelegramBot from 'node-telegram-bot-api';
import { prepareDailyLogin, getIsRunning, getIsPaused, setPaused, storagePath } from './authManager';
import { formatAmount } from './utils';
const token = process.env.TELEGRAM_BOT_TOKEN;

// Allowed chat IDs should be provided as a comma-separated list in the env variable
// Example: ALLOWED_CHAT_IDS=123456789,987654321
const allowedChatIdsEnv = process.env.ALLOWED_CHAT_IDS || '';
const allowedChatIds: Set<number> = new Set(
  allowedChatIdsEnv
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => Number(s))
);

function isAllowed(chatId: number | string): boolean {
  if (allowedChatIds.size === 0) {
    console.warn('ALLOWED_CHAT_IDS is empty or not set; bot will not respond to any chat.');
    return false;
  }
  return allowedChatIds.has(Number(chatId));
}

const debug = process.env.MODE_DEBUG === 'true';

if (!token) {
  if (!debug) {
    console.error('TELEGRAM_BOT_TOKEN not set in environment; bot will not start.');
    process.exit(1);
  }
}

const bot = token ? new TelegramBot(token, { polling: !debug }) : null;

if (bot) {
  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    if (!isAllowed(chatId)) return;
    bot.sendMessage(chatId, 'Hola — servicio de homebanking listo. Usa /status para ver el estado.');
  });

  bot.onText(/\/status/, (msg) => {
    const chatId = msg.chat.id;
    if (!isAllowed(chatId)) return;
    bot.sendMessage(chatId, getIsRunning() ? 'En ejecución: Sí ⏳' : 'En ejecución: No');
  });

  bot.onText(/\/pausar/, (msg) => {
    const chatId = msg.chat.id;
    if (!isAllowed(chatId)) return;
    setPaused(true);
    bot.sendMessage(chatId, 'Bot pausado. El scheduler no ejecutará logins hasta que uses /reanudar.');
  });

  bot.onText(/\/reanudar/, (msg) => {
    const chatId = msg.chat.id;
    if (!isAllowed(chatId)) return;
    setPaused(false);
    bot.sendMessage(chatId, 'Bot reanudado. El scheduler volverá a ejecutar logins normalmente.');
  });

  bot.onText(/\/balance/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isAllowed(chatId)) return;

    if (getIsPaused()) {
      bot.sendMessage(chatId, 'El bot está pausado. Usa /reanudar primero.');
      return;
    }

    if (getIsRunning()) {
      bot.sendMessage(chatId, 'Ya hay un login en curso, esperá que termine.');
      return;
    }

    bot.sendMessage(chatId, 'Iniciando login...');

    try {
      await prepareDailyLogin();

      const files = fs.existsSync(storagePath)
        ? fs.readdirSync(storagePath).filter((f) => f.endsWith('.json'))
        : [];

      const lines: string[] = [];
      for (const file of files) {
        const filePath = path.join(storagePath, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (data.status === 'authenticated') {
          const balance = data.balance
            ? formatAmount(data.balance.amount, data.balance.symbol)
            : 'sin saldo';
          lines.push(`${data.bankId}: ${balance}`);
        } else {
          lines.push(`${data.bankId}: ${data.status}`);
        }

      }

      bot.sendMessage(chatId, lines.length ? lines.join('\n') : 'Sin datos.');
    } catch (err) {
      bot.sendMessage(chatId, `Error durante el login: ${String(err)}`);
    }
  });

  bot.on('message', (msg) => {
    if (msg.text && ['/start', '/status', '/balance', '/pausar', '/reanudar'].some((cmd) => msg.text!.startsWith(cmd))) return;
    const chatId = msg.chat.id;
    if (!isAllowed(chatId)) return;
    bot.sendMessage(chatId, 'Comando no reconocido. Usa /start, /status, /balance, /pausar o /reanudar.');
  });
}

export default bot;
