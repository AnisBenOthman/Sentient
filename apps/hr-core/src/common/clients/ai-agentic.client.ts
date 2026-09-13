import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, isAxiosError } from 'axios';
import * as jwt from 'jsonwebtoken';

/**
 * WHY: HR Core has never called outward before this — every existing
 * cross-service client calls INTO HR Core. There is no user JWT to forward
 * for a server-initiated push, so this mints its own short-lived SYSTEM
 * JWT per call (same mechanism as TokenService.signSystemToken, but
 * self-contained here rather than reaching into IamModule for one call
 * site — mirrors HrCoreClient in apps/ai-agentic, which does the same
 * for the reverse direction).
 *
 * Every method here is best-effort and MUST NOT throw: this client is
 * called synchronously from inside NotificationsEventsBridge.dispatch(),
 * which itself runs inside the awaited leave-approval/rejection request.
 * A Telegram or AI Agentic outage must never fail that request.
 */
@Injectable()
export class AiAgenticClient {
  private readonly logger = new Logger(AiAgenticClient.name);
  private readonly http: AxiosInstance;
  private readonly systemSecret: string;
  private readonly systemExpiry: string;

  constructor(private readonly config: ConfigService) {
    const baseURL = config.getOrThrow<string>('AI_AGENTIC_URL');
    this.http = axios.create({ baseURL, timeout: 5_000 });
    this.systemSecret = config.getOrThrow<string>('SYSTEM_JWT_SECRET');
    this.systemExpiry = config.get<string>('SYSTEM_JWT_EXPIRY') ?? '5m';
  }

  async notifyTelegram(externalId: string, text: string): Promise<void> {
    await this.notify('telegram', externalId, text);
  }

  async notifySlack(externalId: string, text: string): Promise<void> {
    await this.notify('slack', externalId, text);
  }

  /**
   * Both channel controllers in AI Agentic expose the same SYSTEM-only
   * `POST /channels/<channel>/notify` shape with the same taskType, so one
   * best-effort POST serves them all — adding WhatsApp later is one line.
   */
  private async notify(channel: 'telegram' | 'slack', externalId: string, text: string): Promise<void> {
    try {
      await this.http.post(
        `/channels/${channel}/notify`,
        { externalId, text },
        { headers: this.systemAuthHeaders('channel_notify') },
      );
    } catch (err: unknown) {
      const status = isAxiosError(err) ? (err.response?.status ?? err.code) : undefined;
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`AiAgenticClient.notify(${channel}) failed (status=${String(status)}): ${message}`);
    }
  }

  private systemAuthHeaders(taskType: string): Record<string, string> {
    const payload = { sub: 'system' as const, roles: ['SYSTEM'] as const, scope: 'GLOBAL' as const, taskType };
    const token = jwt.sign(payload, this.systemSecret, { expiresIn: this.systemExpiry } as jwt.SignOptions);
    return { Authorization: `Bearer ${token}`, Accept: 'application/json' };
  }
}
