import { BankAdapter, BankCredentials, BankLoginResult } from '../types';
import { BrowserSession, getCookies, extractAuthToken } from '../../browser';
import { formatAmount } from '../../utils';

export class SupervielleAdapter implements BankAdapter {
  bankId = 'supervielle';
  private loginUrl = 'https://personas.supervielle.com.ar/obi/usuarios/login';
  private accountsUrl = 'https://personas.supervielle.com.ar/obi/homev2/api/v1.0/cuentas';

  async login({ dni, username, password }: BankCredentials, session: BrowserSession): Promise<BankLoginResult> {
    try {
      console.log(`[supervielle] Iniciando login para ${username}`);

      await session.page.goto(this.loginUrl, { waitUntil: 'networkidle2' });

      await session.page.waitForSelector('input[name="numeroDocumento"]', { timeout: 10000 });

      await session.page.type('input[name="numeroDocumento"]', dni);
      console.log(`[supervielle] DNI completado`);

      await session.page.type('input[name="usuario"]', username);
      console.log(`[supervielle] Usuario completado`);

      await session.page.type('input[name="clave"]', password);
      console.log(`[supervielle] Clave completada`);

      // El botón arranca disabled y se habilita cuando los campos están completos
      await session.page.waitForSelector('button.boton:not([disabled])', { timeout: 5000 });
      await session.page.click('button.boton');
      console.log(`[supervielle] Formulario enviado`);

      // Esperar a que la navegación se complete o a que aparezca un error
      try {
        await session.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
      } catch (err) {
        console.log(`[supervielle] Timeout en navegación (puede ser normal)`, String(err));
      }

      // Verificar si se llegó a la página de home/dashboard (indicador de login exitoso)
      const currentUrl = session.page.url();
      console.log(`[supervielle] URL actual: ${currentUrl}`);

      if (currentUrl.includes('/obi/root/home')) {
        console.log(`[supervielle] Login exitoso`);
        const token = await extractAuthToken(session);
        const accountsResponse = await session.page.evaluate(
          async (endpoint, tokenValue) => {
            const headers: Record<string, string> = {
              Accept: 'application/json',
            };
            if (tokenValue) {
              headers.Authorization = `Bearer ${tokenValue}`;
              headers['X-CSRF-Token'] = tokenValue;
              headers['x-xsrf-token'] = tokenValue;
            }
            const response = await fetch(endpoint, {
              method: 'GET',
              credentials: 'include',
              headers,
            });
            const text = await response.text();
            let body: unknown;
            try {
              body = JSON.parse(text);
            } catch {
              body = text;
            }
            return { status: response.status, ok: response.ok, body };
          },
          this.accountsUrl,
          token
        );

        const cookies = await getCookies(session);
        let balance = null;
        if (accountsResponse.ok && accountsResponse.body && typeof accountsResponse.body === 'object') {
          const payload = accountsResponse.body as any;
          const saldoItem = payload?.saldos?.[0] ?? payload?.cuentas?.[0];
          const symbol = saldoItem?.moneda?.simbolo || payload?.cuentas?.[0]?.moneda?.simbolo || '$';
          const amount = Number(saldoItem?.monto ?? saldoItem?.saldo ?? NaN);
          if (!Number.isNaN(amount)) {
            balance = {
              amount,
              symbol,
              formatted: formatAmount(amount, symbol),
            };
          }
        }

        return {
          success: true,
          message: 'Login exitoso en Supervielle',
          cookies,
          token,
          balance,
          rawAccounts: accountsResponse.body,
        };
      }

      // Si seguimos en login, puede que haya habido error
      const bodyText = await session.page.evaluate(() => document.body.innerText);
      if (bodyText.includes('error') || bodyText.includes('incorrecto')) {
        return {
          success: false,
          message: 'Error de credenciales o login fallido',
          error: 'Verifique usuario y contraseña',
        };
      }

      // Asumir que fue exitoso si cambió de URL
      const cookies = await getCookies(session);
      return {
        success: true,
        message: 'Login completado en Supervielle',
        cookies,
      };
    } catch (err) {
      const errorMsg = String(err);
      console.error(`[supervielle] Error en login:`, errorMsg);
      return {
        success: false,
        message: 'Error durante el login',
        error: errorMsg,
      };
    }
  }
}
