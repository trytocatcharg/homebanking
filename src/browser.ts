import { debug } from 'console';
import puppeteer, { Browser, Page } from 'puppeteer';

export interface BrowserSession {
  browser: Browser;
  page: Page;
}

export async function createBrowser(): Promise<BrowserSession> {
  const debug = process.env.MODE_DEBUG === 'true';
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  const browser = await puppeteer.launch({
    headless: !debug,
    ...(executablePath ? { executablePath } : {}),
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--single-process',
    ],
  });

  const page = await browser.newPage();
  await page.setDefaultNavigationTimeout(30000);
  await page.setDefaultTimeout(30000);

  return { browser, page };
}

export async function closeBrowser(session: BrowserSession): Promise<void> {
  if (session.browser) {
    await session.browser.close();
  }
}

export async function getCookies(session: BrowserSession): Promise<string> {
  const cookies = await session.page.cookies();
  return JSON.stringify(cookies);
}

export async function setCookies(session: BrowserSession, cookieJson: string): Promise<void> {
  try {
    const cookies = JSON.parse(cookieJson);
    await session.page.setCookie(...cookies);
  } catch (err) {
    console.error('[browser] Error setting cookies:', err);
  }
}

export async function extractAuthToken(session: BrowserSession): Promise<string | null> {
  try {
    const token = await session.page.evaluate(() => {
      const patterns = ['token', 'auth', 'csrf', 'xsrf', 'bearer'];
      const extractFromStore = (store: Storage) => {
        for (let i = 0; i < store.length; i += 1) {
          const key = store.key(i);
          if (!key) continue;
          const value = store.getItem(key);
          if (!value) continue;
          const lowerKey = key.toLowerCase();
          if (patterns.some((pattern) => lowerKey.includes(pattern))) return value;
          const lowerValue = value.toLowerCase();
          if (patterns.some((pattern) => lowerValue.includes(pattern))) return value;
        }
        return null;
      };

      const localToken = extractFromStore(window.localStorage);
      if (localToken) return localToken;
      const sessionToken = extractFromStore(window.sessionStorage);
      if (sessionToken) return sessionToken;

      const cookies = document.cookie.split(';').map((c) => c.trim());
      for (const cookie of cookies) {
        const [name, value] = cookie.split('=');
        if (!name || !value) continue;
        const lowerName = name.toLowerCase();
        if (patterns.some((pattern) => lowerName.includes(pattern))) return value;
      }
      return null;
    });
    return typeof token === 'string' ? token : null;
  } catch (err) {
    console.error('[browser] Error extracting auth token:', err);
    return null;
  }
}
