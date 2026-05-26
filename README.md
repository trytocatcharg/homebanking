# homebanking

Servicio en TypeScript que automatiza el login diario en homebanking y expone control vía Telegram.

## Uso

1. Instalar dependencias:

```bash
yarn install
```

2. Configurar variables de entorno en `.env`:

```env
TELEGRAM_BOT_TOKEN=...
ALLOWED_CHAT_IDS=...        # IDs separados por coma

# Supervielle
SUP_DNI=...
SUP_USER=...
SUP_PASS=...

# Banco Galicia
GGAL_DNI=...
GGAL_USER=...
GGAL_PASS=...
```

3. Ejecutar en desarrollo:

```bash
yarn dev
```

4. Build y producción:

```bash
yarn start
```

## Comandos del bot

| Comando | Descripción |
|---|---|
| `/start` | Mensaje de bienvenida |
| `/status` | Muestra si hay un login en curso |
| `/balance` | Dispara el login manualmente y retorna el saldo de cada banco |
| `/pausar` | Pausa el scheduler — el login automático no se ejecutará |
| `/reanudar` | Reanuda el scheduler |

## Bancos soportados

| Banco | Prefijo de credenciales |
|---|---|
| Supervielle | `SUP` |
| Banco Galicia | `GGAL` |

## Arquitectura

- **`src/bot.ts`** — bot de Telegram, manejo de comandos
- **`src/scheduler.ts`** — cron diario a las 00:00 (timezone configurable con `TIMEZONE`)
- **`src/authManager.ts`** — orquesta el login para cada adapter registrado
- **`src/banks/`** — registro de adapters (`index.ts`) y adapters por banco (`adapters/`)
- **`src/browser.ts`** — gestión de sesiones Puppeteer

El scheduler respeta el estado de pausa. Cuando está pausado, saltea la ejecución y loguea el motivo.
