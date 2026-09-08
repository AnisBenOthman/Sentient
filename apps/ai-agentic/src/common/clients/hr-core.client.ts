import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, isAxiosError } from 'axios';
import * as jwt from 'jsonwebtoken';
import { ChannelType } from '@sentient/shared';
import { ExchangeResult } from './channel-identity.interface';

function isExchangeResult(raw: unknown): raw is ExchangeResult {
  return (
    typeof raw === 'object' &&
    raw !== null &&
    typeof (raw as Record<string, unknown>)['accessToken'] === 'string' &&
    typeof (raw as Record<string, unknown>)['refreshToken'] === 'string' &&
    typeof (raw as Record<string, unknown>)['expiresIn'] === 'number'
  );
}

function extractErrorMessage(data: unknown): string | undefined {
  if (typeof data === 'object' && data !== null && typeof (data as Record<string, unknown>)['message'] === 'string') {
    return (data as Record<string, unknown>)['message'] as string;
  }
  return undefined;
}

/**
 * WHY: Unlike HrCoreClient in Social/AI's future agent tools, there is no
 * incoming user JWT to forward here — a raw Telegram/Slack message carries
 * no Sentient identity yet. This client mints its own short-lived SYSTEM
 * JWT per call (same mechanism as TokenService.signSystemToken in HR Core,
 * verified by the same SharedJwtGuard fallback), scoped via taskType so it
 * can only reach the two channel-identity endpoints — never a data endpoint.
 */
@Injectable()
export class HrCoreClient {
  private readonly logger = new Logger(HrCoreClient.name);
  private readonly http: AxiosInstance;
  private readonly systemSecret: string;
  private readonly systemExpiry: string;

  constructor(private readonly config: ConfigService) {
    const baseURL = config.getOrThrow<string>('HR_CORE_URL');
    this.http = axios.create({ baseURL, timeout: 5_000 });
    this.systemSecret = config.getOrThrow<string>('SYSTEM_JWT_SECRET');
    this.systemExpiry = config.get<string>('SYSTEM_JWT_EXPIRY') ?? '5m';
  }

  async redeemLinkCode(channel: ChannelType, externalId: string, code: string): Promise<void> {
    const headers = this.systemAuthHeaders('channel_link');
    try {
      await this.http.post('/channel-identities/redeem-link-code', { channel, externalId, code }, { headers });
    } catch (err: unknown) {
      this.handleError(err, 'redeemLinkCode');
    }
  }

  async exchangeChannelIdentity(channel: ChannelType, externalId: string): Promise<ExchangeResult> {
    const headers = this.systemAuthHeaders('channel_token_exchange');
    try {
      const response = await this.http.post<unknown>(
        '/channel-identities/exchange',
        { channel, externalId },
        { headers },
      );
      if (!isExchangeResult(response.data)) {
        this.logger.error('HrCoreClient: unexpected /channel-identities/exchange response shape');
        throw new InternalServerErrorException('HrCoreClient: unexpected exchange response shape');
      }
      return response.data;
    } catch (err: unknown) {
      if (err instanceof InternalServerErrorException) throw err;
      this.handleError(err, 'exchangeChannelIdentity');
    }
  }

  private systemAuthHeaders(taskType: string): Record<string, string> {
    const payload = { sub: 'system' as const, roles: ['SYSTEM'] as const, scope: 'GLOBAL' as const, taskType };
    const token = jwt.sign(payload, this.systemSecret, { expiresIn: this.systemExpiry } as jwt.SignOptions);
    return { Authorization: `Bearer ${token}`, Accept: 'application/json' };
  }

  private handleError(err: unknown, method: string): never {
    if (isAxiosError(err)) {
      const status = err.response?.status;
      const message = extractErrorMessage(err.response?.data);
      this.logger.error(`HrCoreClient.${method} failed`, { status, code: err.code, message });

      if (status === 400) throw new BadRequestException(message ?? 'HR Core rejected the request');
      if (status === 401) throw new UnauthorizedException('HR Core rejected the SYSTEM token');
      if (status === 404) throw new NotFoundException(message ?? 'Not found in HR Core');
      if (status !== undefined && status >= 500) {
        throw new ServiceUnavailableException(`HR Core unreachable (status ${status})`);
      }
      throw new ServiceUnavailableException(`HR Core unreachable (${err.code ?? 'UNKNOWN'})`);
    }
    throw err as Error;
  }
}
