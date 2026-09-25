# @sentient/tunnel

A free Cloudflare quick tunnel (no account, no domain) so Telegram can reach your
local ai-agentic in webhook mode. The public URL changes on every run, and nothing
needs editing when it does.

## One-time setup

1. Install cloudflared: `winget install --id Cloudflare.cloudflared` (Windows),
   `brew install cloudflared` (macOS).
2. In `apps/ai-agentic/.env`:

   ```env
   TELEGRAM_ENABLED=true
   TELEGRAM_BOT_TOKEN=<from @BotFather>
   TELEGRAM_MODE=webhook
   TELEGRAM_WEBHOOK_URL={tunnel}/api/ai/channels/telegram/webhook
   ```

   `{tunnel}` is a placeholder that stays in the file for good. `TELEGRAM_WEBHOOK_SECRET`
   is optional: when it is unset, ai-agentic derives one from the bot token.

## Run

| Command | What it starts |
|---|---|
| `pnpm dev:tunnel` | the whole dev stack plus the tunnel |
| `pnpm tunnel` | the tunnel only, next to an already running `pnpm dev` |
| `pnpm tunnel http://localhost:3004` | a tunnel to another local origin |

Add `--verbose` to see cloudflared's own log. Plain `pnpm dev` never starts a tunnel.

## How the webhook gets registered

The script starts `cloudflared tunnel --url http://localhost:3000 --metrics 127.0.0.1:20241`.
cloudflared serves the tunnel's hostname at `http://127.0.0.1:20241/quicktunnel`.
ai-agentic polls that every 10 seconds and calls Telegram's `setWebhook` whenever the
hostname changes, with `{tunnel}` replaced by `https://<hostname>`. ai-agentic is the
only process that registers the webhook, so restarting either the tunnel or ai-agentic
fixes itself within one poll. If cloudflared runs somewhere else (e.g. in Docker), set
`CLOUDFLARED_METRICS_URL` in `apps/ai-agentic/.env`.

## Notes

- While the tunnel runs, anyone with the URL can reach your local web app. Stop it
  when you are done.
- If you only need the bot to work locally, `TELEGRAM_MODE=polling` (the default)
  needs no tunnel at all.
- Slack should stay on Socket Mode (the default). Its Events API request URL is set by
  hand in the Slack app dashboard, which doesn't suit a URL that changes every run.
