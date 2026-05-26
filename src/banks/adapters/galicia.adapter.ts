import { BrowserSession, extractAuthToken, getCookies } from "../../browser";
import { formatAmount } from "../../utils";
import { BankAdapter, BankCredentials, BankLoginResult } from "../types";


export class GaliciaAdapter implements BankAdapter {
  bankId = 'galicia';
  private loginUrl = 'https://onlinebanking.bancogalicia.com.ar/login';

  async login({ dni, username, password }: BankCredentials, session: BrowserSession): Promise<BankLoginResult> {
    try {
      console.log(`[galicia] Iniciando login para ${username}`);

      await session.page.goto(this.loginUrl, { waitUntil: 'networkidle2' });

      await session.page.waitForSelector('input#DocumentNumber', { timeout: 10000 });

      await session.page.type('input#DocumentNumber', dni);
      console.log(`[galicia] DNI completado`);

      await session.page.type('input#UserName', username);
      console.log(`[galicia] Usuario completado`);

      await session.page.type('input#Password', password);
      console.log(`[galicia] Clave completada`);

      await session.page.waitForSelector('button#submitButton:not([disabled])', { timeout: 5000 });
      console.log(`[galicia] Formulario enviado`);

      await Promise.all([
        session.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }),
        session.page.click('button#submitButton'),
      ]);

      const currentUrl = session.page.url();
      console.log(`[galicia] URL actual: ${currentUrl}`);

      if (currentUrl.includes('/login')) {
        const bodyText = await session.page.evaluate(() => document.body.innerText);
        const isError =
          bodyText.toLowerCase().includes('error') ||
          bodyText.toLowerCase().includes('incorrecto') ||
          bodyText.toLowerCase().includes('inválido') ||
          bodyText.toLowerCase().includes('bloqueado');
        return {
          success: false,
          message: isError ? 'Credenciales incorrectas o cuenta bloqueada' : 'Login fallido — no se navegó fuera del login',
          error: isError ? bodyText.slice(0, 200) : 'URL sigue siendo /login',
        };
      }

      console.log(`[galicia] Login exitoso`);

      const token = await extractAuthToken(session);
      const cookies = await getCookies(session);

      let balance = null;
      let rawAccounts: unknown = null;

      try {
        const today = new Date();
        const fmt = (d: Date) =>
          `${String(d.getDate()).padStart(2, '0')}%2F${String(d.getMonth() + 1).padStart(2, '0')}%2F${d.getFullYear()}`;
        const yearAgo = new Date(today);
        yearAgo.setFullYear(today.getFullYear() - 1);

        type MovResult = { ok: boolean; body: unknown };

        const movData: MovResult = await session.page.evaluate(
          async (fd: string, fh: string, cookieHeader: string): Promise<MovResult> => {
            const res = await fetch('https://cuentas.bancogalicia.com.ar/Cuentas/GetMovimientosCuenta', {
              method: 'POST',
              headers: {
                'accept': 'application/json, text/javascript, */*; q=0.01',
                'accept-language': 'en-US,en;q=0.9',
                'cache-control': 'no-cache',
                'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'cookie': cookieHeader,
                'origin': 'https://cuentas.bancogalicia.com.ar',
                'pragma': 'no-cache',
                'referer': 'https://cuentas.bancogalicia.com.ar/cuentas/mis-cuentas',
                'sec-ch-ua': '"Google Chrome";v="147", "Not.A/Brand";v="8", "Chromium";v="147"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"macOS"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-origin',
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
                'x-requested-with': 'XMLHttpRequest',
              },
              body: `fd=${fd}&fh=${fh}&motivo=Todos&pagina=0`,
              credentials: 'include',
            });
            const text = await res.text();
            try { return { ok: res.ok, body: JSON.parse(text) }; }
            catch { return { ok: res.ok, body: text }; }
          },
          fmt(yearAgo),
          fmt(today),
          cookies
        );

        console.log(`[galicia] GetMovimientosCuenta status ok=${movData.ok}`);
        rawAccounts = movData.body;

        if (movData.ok && movData.body && typeof movData.body === 'object') {
          const payload = movData.body as any;
          const saldo = payload?.Movimientos?.[0]?.SaldoParcial;
          const amount = Number(saldo);
          if (!Number.isNaN(amount)) {
            balance = { amount, symbol: '$', formatted: formatAmount(amount, '$') };
          }
        }
      } catch (balanceErr) {
        console.warn(`[galicia] No se pudo obtener el saldo:`, String(balanceErr));
      }

      return {
        success: true,
        message: 'Login exitoso en Galicia',
        cookies,
        token,
        balance,
        rawAccounts,
      };
    } catch (err) {
      const errorMsg = String(err);
      console.error(`[galicia] Error en login:`, errorMsg);
      return {
        success: false,
        message: 'Error durante el login',
        error: errorMsg,
      };
    }
  }
}
