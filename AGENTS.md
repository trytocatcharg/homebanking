# AI Agent Instructions for homebanking

## Purpose

This is a small TypeScript backend service that will eventually log in to bank homebanking portals, persist cookie/session data, and expose information through Telegram. The current scaffold starts an Express server and schedules a daily login preparation task.

## Key files

-- `src/bot.ts` — main Telegram bot entry and startup behavior
- `src/scheduler.ts` — daily cron scheduling using `node-cron`
- `src/authManager.ts` — placeholder logic for preparing bank login state and cookie storage
- `src/config/banks.ts` — bank configuration list
- `tsconfig.json` — TypeScript compiler configuration
- `package.json` — `build`, `dev`, and `start` scripts

## Commands

- `yarn install` — install dependencies
- `yarn dev` — run TypeScript source directly with `ts-node` (starts the bot)
- `yarn build` — compile TypeScript to `dist`
- `yarn start` — compile and run production bot

## Behavior

- On startup, the server calls `prepareDailyLogin()` once.
- A scheduled cron job runs daily at `00:00` using timezone `Europe/Madrid` by default.
- The current login preparation flow creates `storage/cookies` and writes placeholder files per bank.

## Security and privacy guidance

- Do not commit secrets, credentials, or real cookie/session data to source control.
- Use environment variables for sensitive values and do not log them.
- Treat bank account data and authentication cookies as highly sensitive.
- Prefer secure storage mechanisms over plain JSON files once real login data is implemented.
- Keep the project minimal and avoid exposing internal state through public endpoints.

## Notes for agents

- If adding new features, keep the work focused on the backend service and secure handling of credentials.
- Do not assume any bank login implementation exists beyond the placeholder preparation.
- When asked to modify or extend behavior, verify current file paths and exported symbols before editing.
