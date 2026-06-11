export function parsePositiveInt(
  value: string | undefined,
  fallback: number,
  name: string,
): number {
  const raw = value ?? String(fallback);
  const parsed = Number(raw);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return parsed;
}

export function parseNonEmptyString(
  value: string | undefined,
  fallback: string,
  name: string,
): string {
  const raw = (value ?? fallback).trim();
  if (raw.length === 0) throw new Error(`${name} must not be empty`);
  return raw;
}

export function parseHttpUrl(value: string | undefined, fallback: string, name: string): string {
  const raw = parseNonEmptyString(value, fallback, name);
  const url = new URL(raw);

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`${name} must be an absolute http(s) URL`);
  }

  return url.toString().replace(/\/$/, '');
}

export function parseOptionalString(value: string | undefined): string | null {
  const raw = value?.trim();
  return raw && raw.length > 0 ? raw : null;
}

export function parseRatio(value: string | undefined, fallback: number, name: string): number {
  const raw = value ?? String(fallback);
  const parsed = Number(raw);

  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new Error(`${name} must be a number between 0 and 1`);
  }

  return parsed;
}

export function parseBoolean(value: string | undefined, fallback: boolean, name: string): boolean {
  const raw = (value ?? String(fallback)).trim().toLowerCase();
  if (raw === 'true' || raw === '1' || raw === 'yes') return true;
  if (raw === 'false' || raw === '0' || raw === 'no') return false;
  throw new Error(`${name} must be a boolean`);
}
