import { Logger } from '@nestjs/common';

/**
 * Placeholder a channel webhook URL may carry instead of a real origin, e.g.
 * TELEGRAM_WEBHOOK_URL={tunnel}/api/ai/channels/telegram/webhook. It is swapped
 * for the live https:// origin of the free Cloudflare quick tunnel at runtime.
 */
export const TUNNEL_PLACEHOLDER = '{tunnel}';

export const DEFAULT_CLOUDFLARED_METRICS_URL = 'http://127.0.0.1:20241';

const POLL_INTERVAL_MS = 10_000;
const METRICS_TIMEOUT_MS = 2_000;
const HOSTNAME = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i;

type FetchFn = (url: string, init: { signal: AbortSignal }) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

export function usesTunnelPlaceholder(url: string): boolean {
  return url.includes(TUNNEL_PLACEHOLDER);
}

export function fillTunnelPlaceholder(template: string, origin: string): string {
  return template.split(TUNNEL_PLACEHOLDER).join(origin);
}

/**
 * Turns cloudflared's `/quicktunnel` body into an https origin. cloudflared
 * formats it as `{"hostname":"<value>"}` with the value exactly as the quick
 * tunnel API returned it, which may or may not carry a scheme, and is "" before
 * a tunnel exists. Anything that is not a plain hostname is rejected rather than
 * handed to Telegram as a webhook URL.
 */
export function parseQuickTunnelOrigin(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;
  const raw = (body as Record<string, unknown>).hostname;
  if (typeof raw !== 'string') return null;
  const hostname = raw.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  return HOSTNAME.test(hostname) ? `https://${hostname.toLowerCase()}` : null;
}

/**
 * WHY poll cloudflared instead of having the tunnel script call setWebhook: a
 * free quick tunnel mints a new random hostname on every start, and in dev the
 * tunnel and this service restart independently of each other. With two writers
 * (the old script registered the webhook and rewrote .env, while this service
 * re-registered whatever URL .env held when it booted) whichever finished last
 * won, and a stale URL silently dropped every update. Here this process is the
 * only writer: it asks cloudflared's local metrics server for the current
 * hostname, re-registers whenever that changes, and .env keeps a placeholder.
 *
 * Only transitions are logged (tunnel found, tunnel changed, tunnel gone), so a
 * missing tunnel costs one log line, not one every poll.
 */
export class QuickTunnelWatcher {
  private readonly logger = new Logger(QuickTunnelWatcher.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private applied: string | null = null;
  private waitingLogged = false;

  constructor(
    private readonly metricsUrl: string,
    private readonly onOrigin: (origin: string) => Promise<void>,
    private readonly fetchFn: FetchFn = fetch,
  ) {}

  start(): void {
    if (this.timer) return;
    void this.check();
    this.timer = setInterval(() => void this.check(), POLL_INTERVAL_MS);
    // A dev-only poll must never be the reason the process stays alive.
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** One poll. Public so tests can drive it without timers. */
  async check(): Promise<void> {
    // A slow setWebhook must not overlap the next tick and register twice.
    if (this.running) return;
    this.running = true;
    try {
      const origin = await this.currentOrigin();
      if (!origin) {
        if (!this.waitingLogged) {
          this.logger.warn(
            `Waiting for a Cloudflare quick tunnel (cloudflared metrics at ${this.metricsUrl}). Start one with: pnpm tunnel`,
          );
          this.waitingLogged = true;
        }
        return;
      }
      this.waitingLogged = false;
      if (origin === this.applied) return;

      await this.onOrigin(origin);
      this.applied = origin;
    } catch (err: unknown) {
      // `applied` stays unchanged, so the next tick retries the same origin.
      this.logger.error(`Quick tunnel webhook registration failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      this.running = false;
    }
  }

  private async currentOrigin(): Promise<string | null> {
    try {
      const response = await this.fetchFn(`${this.metricsUrl.replace(/\/+$/, '')}/quicktunnel`, {
        signal: AbortSignal.timeout(METRICS_TIMEOUT_MS),
      });
      if (!response.ok) return null;
      return parseQuickTunnelOrigin(await response.json());
    } catch {
      // Connection refused means cloudflared is not running, or has not got a
      // hostname yet (it only opens the metrics port once it has one).
      return null;
    }
  }
}
