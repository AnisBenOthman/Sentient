import i18n from '@/i18n';

export interface GatewayErrorEnvelope {
  code: string;
  message: string;
  correlationId: string;
  details?: unknown;
}

/**
 * WHY the messages moved out: they are user-facing copy, so they belong in the
 * `errors` locale namespace keyed by the backend error code — the same code the
 * gateway already sends. This module keeps only the extraction logic.
 *
 * WHY the i18next singleton and not a hook: these helpers are called from
 * mutation callbacks and plain functions, where there is no React context. The
 * singleton reads the current language at call time, which is exactly when the
 * error text is captured into state today.
 */
function translateErrorCode(code: string): string | undefined {
  if (!code) return undefined;
  const key = `errors:${code}`;
  const translated = i18n.t(key, { defaultValue: '' });
  return translated || undefined;
}

/**
 * Resolve a backend error code to user-facing copy, falling back to the
 * caller's own translated message when the code has no entry.
 */
export function apiErrorMessage(code: string, fallback: string): string {
  return translateErrorCode(code) ?? fallback;
}

export function isGatewayErrorEnvelope(value: unknown): value is GatewayErrorEnvelope {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.code === 'string' &&
    typeof record.message === 'string' &&
    typeof record.correlationId === 'string'
  );
}

export function extractGatewayErrorCode(error: unknown): string {
  const data = extractResponseData(error);
  if (isGatewayErrorEnvelope(data)) return data.code;

  if (typeof data === 'object' && data !== null) {
    const code = (data as Record<string, unknown>).code;
    if (typeof code === 'string') return code;
  }

  return '';
}

export function extractGatewayErrorMessage(error: unknown): string {
  const data = extractResponseData(error);
  if (isGatewayErrorEnvelope(data)) return data.message;

  if (typeof data === 'object' && data !== null) {
    const message = (data as Record<string, unknown>).message;
    if (typeof message === 'string') return message;
  }

  return '';
}

export function getGatewayErrorMessage(error: unknown, fallback: string): string {
  const code = extractGatewayErrorCode(error);
  const translated = translateErrorCode(code);
  if (translated) return translated;

  const message = extractGatewayErrorMessage(error);
  if (message) return message;

  if (isRequestWithoutResponse(error)) {
    return 'Unable to reach the API Gateway. Check the gateway URL and dev proxy.';
  }

  return fallback;
}

export function extractApiError(error: unknown): string {
  return extractGatewayErrorCode(error);
}

function extractResponseData(error: unknown): unknown {
  if (typeof error !== 'object' || error === null || !('response' in error)) return undefined;
  const response = (error as { response?: { data?: unknown } }).response;
  return response?.data;
}

function isRequestWithoutResponse(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('request' in error)) return false;
  return (error as { response?: unknown }).response === undefined;
}
