import http from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';

export interface UpstreamRequestRecord {
  method: string;
  url: string;
  headers: IncomingMessage['headers'];
  body: Buffer;
}

export interface UpstreamTestServer {
  url: string;
  records: UpstreamRequestRecord[];
  close: () => Promise<void>;
}

export type UpstreamHandler = (
  request: IncomingMessage,
  response: ServerResponse,
  body: Buffer,
) => void | Promise<void>;

export async function createUpstreamTestServer(handler?: UpstreamHandler): Promise<UpstreamTestServer> {
  const records: UpstreamRequestRecord[] = [];
  const server = http.createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      const body = Buffer.concat(chunks);
      records.push({
        method: request.method ?? 'GET',
        url: request.url ?? '/',
        headers: request.headers,
        body,
      });
      Promise.resolve(handler?.(request, response, body))
        .then(() => {
          if (!response.writableEnded) {
            response.writeHead(200, { 'content-type': 'application/json' });
            response.end(JSON.stringify({ ok: true, path: request.url }));
          }
        })
        .catch((error: unknown) => {
          response.writeHead(500, { 'content-type': 'application/json' });
          response.end(JSON.stringify({ message: error instanceof Error ? error.message : 'handler failed' }));
        });
    });
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('Unable to resolve upstream test server address');
  }

  return {
    url: `http://127.0.0.1:${address.port}`,
    records,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      }),
  };
}

