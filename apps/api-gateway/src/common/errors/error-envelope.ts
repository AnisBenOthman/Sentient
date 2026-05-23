export interface ErrorEnvelope {
  code: string;
  message: string;
  correlationId: string;
  details?: unknown;
}

export const GatewayErrorCode = {
  NoUpstreamRoute: 'NoUpstreamRoute',
  MissingAuthorization: 'MissingAuthorization',
  MalformedAuthorization: 'MalformedAuthorization',
  JwtExpired: 'JwtExpired',
  JwtInvalid: 'JwtInvalid',
  RateLimitExceeded: 'RateLimitExceeded',
  PayloadTooLarge: 'PayloadTooLarge',
  UpstreamUnavailable: 'UpstreamUnavailable',
  UpstreamTimeout: 'UpstreamTimeout',
  GatewayInternalError: 'GatewayInternalError',
} as const;

export type GatewayErrorCode = (typeof GatewayErrorCode)[keyof typeof GatewayErrorCode];

export function createErrorEnvelope(
  code: GatewayErrorCode | string,
  message: string,
  correlationId: string,
  details?: unknown,
): ErrorEnvelope {
  return details === undefined
    ? { code, message, correlationId }
    : { code, message, correlationId, details };
}

export function isErrorEnvelope(value: unknown): value is ErrorEnvelope {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.code === 'string' &&
    typeof candidate.message === 'string' &&
    typeof candidate.correlationId === 'string'
  );
}

