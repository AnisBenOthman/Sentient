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
