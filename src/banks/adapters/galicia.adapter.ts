import { BrowserSession, extractAuthToken, getCookies } from "../../browser";
import { formatAmount } from "../../utils";
import { BankAdapter, BankCredentials, BankLoginResult } from "../types";

function parseGaliciaAmount(value: string): number | null {
  const normalized = value
    .replace(/[^\d,.-]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');

  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
}

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

      try {
        await session.page.waitForSelector('#mainBox h2 strong, #SaldoCtaPrincipalAccesibilidad', { timeout: 15000 });

        const balanceText = await session.page.$eval(
          '#mainBox h2 strong, #SaldoCtaPrincipalAccesibilidad',
          (element) => element.textContent?.trim() ?? ''
        );

        const amount = parseGaliciaAmount(balanceText);
        if (amount !== null) {
          balance = { amount, symbol: '$', formatted: formatAmount(amount, '$') };
          console.log(`[galicia] Saldo detectado desde HTML: ${balanceText}`);
        } else {
          console.warn(`[galicia] No se pudo parsear el saldo desde HTML: ${balanceText}`);
        }
      } catch (balanceErr) {
        console.warn(`[galicia] No se pudo obtener el saldo desde HTML:`, String(balanceErr));
      }

      return {
        success: true,
        message: 'Login exitoso en Galicia',
        cookies,
        token,
        balance,
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
