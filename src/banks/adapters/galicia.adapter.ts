import { BrowserSession, extractAuthToken, getCookieHeader, getCookies } from "../../browser";
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

        type MovResult = { ok: boolean; body: unknown; status: number };

        const cookieHeader = await getCookieHeader(
          session,
          this.loginUrl,
          'https://cuentas.bancogalicia.com.ar',
          'https://cuentas.bancogalicia.com.ar/cuentas/mis-cuentas'
        );

        const movResponse = await fetch('https://cuentas.bancogalicia.com.ar/Cuentas/GetMovimientosCuenta', {
          method: 'POST',
          headers: {
            'accept': 'application/json, text/javascript, */*; q=0.01',
            'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'cookie': cookieHeader,
            'origin': 'https://cuentas.bancogalicia.com.ar',
            'referer': 'https://cuentas.bancogalicia.com.ar/cuentas/mis-cuentas',
            'x-requested-with': 'XMLHttpRequest',
          },
          body: new URLSearchParams({
            fd: fmt(yearAgo).replace(/%2F/g, '/'),
            fh: fmt(today).replace(/%2F/g, '/'),
            motivo: 'Todos',
            pagina: '0',
          }),
        });

        const movText = await movResponse.text();
        let movBody: unknown;
        try {
          movBody = JSON.parse(movText);
        } catch {
          movBody = movText;
        }

        const movData: MovResult = {
          ok: movResponse.ok,
          status: movResponse.status,
          body: movBody,
        };

        console.log(`[galicia] GetMovimientosCuenta status=${movData.status} ok=${movData.ok}`);
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
