import type { IncomingHttpHeaders } from 'node:http';
import type { Response } from 'express';

const allowedResponseHeaders = new Set([
  'cache-control',
  'content-disposition',
  'content-language',
  'content-length',
  'content-range',
  'content-type',
  'etag',
  'last-modified',
  'retry-after',
]);

const blockedRequestHeaders = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

export function filterRequestHeaders(headers: IncomingHttpHeaders): IncomingHttpHeaders {
  return Object.fromEntries(
    Object.entries(headers).filter(([key]) => !blockedRequestHeaders.has(key.toLowerCase())),
  ) as IncomingHttpHeaders;
}

export function applyAllowedResponseHeaders(headers: IncomingHttpHeaders, response: Response): void {
  for (const [key, value] of Object.entries(headers)) {
    if (!allowedResponseHeaders.has(key.toLowerCase()) || value === undefined) continue;
    response.setHeader(key, value);
  }
}

