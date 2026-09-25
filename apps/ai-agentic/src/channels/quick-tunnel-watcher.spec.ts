import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import {
  fillTunnelPlaceholder,
  parseQuickTunnelOrigin,
  QuickTunnelWatcher,
  usesTunnelPlaceholder,
} from './quick-tunnel-watcher';

function metricsReply(hostname: unknown): jest.Mock {
  return jest.fn().mockResolvedValue({ ok: true, json: async () => ({ hostname }) });
}

describe('tunnel placeholder helpers', () => {
  it('detects and fills the {tunnel} placeholder', () => {
    const template = '{tunnel}/api/ai/channels/telegram/webhook';

    expect(usesTunnelPlaceholder(template)).toBe(true);
    expect(usesTunnelPlaceholder('https://hr.example.com/api/ai/channels/telegram/webhook')).toBe(false);
    expect(fillTunnelPlaceholder(template, 'https://a-b-c.trycloudflare.com')).toBe(
      'https://a-b-c.trycloudflare.com/api/ai/channels/telegram/webhook',
    );
  });
});

describe('parseQuickTunnelOrigin', () => {
  it('builds an https origin from a bare hostname', () => {
    expect(parseQuickTunnelOrigin({ hostname: 'Random-Words.trycloudflare.com' })).toBe(
      'https://random-words.trycloudflare.com',
    );
  });

  it('accepts a hostname that already carries a scheme', () => {
    expect(parseQuickTunnelOrigin({ hostname: 'https://random-words.trycloudflare.com/' })).toBe(
      'https://random-words.trycloudflare.com',
    );
  });

  it.each([
    ['no tunnel yet (empty hostname)', { hostname: '' }],
    ['a path smuggled into the hostname', { hostname: 'evil.example.com/steal' }],
    ['a non-string hostname', { hostname: 42 }],
    ['a non-object body', 'random-words.trycloudflare.com'],
  ])('rejects %s', (_label, body) => {
    expect(parseQuickTunnelOrigin(body)).toBeNull();
  });
});

describe('QuickTunnelWatcher', () => {
  it('registers once per hostname, and again when the tunnel restarts with a new one', async () => {
    const onOrigin = jest.fn().mockResolvedValue(undefined);
    const fetchFn = metricsReply('first.trycloudflare.com');
    const watcher = new QuickTunnelWatcher('http://127.0.0.1:20241', onOrigin, fetchFn);

    await watcher.check();
    await watcher.check();
    fetchFn.mockResolvedValue({ ok: true, json: async () => ({ hostname: 'second.trycloudflare.com' }) });
    await watcher.check();

    expect(fetchFn).toHaveBeenCalledWith('http://127.0.0.1:20241/quicktunnel', expect.anything());
    expect(onOrigin.mock.calls).toEqual([['https://first.trycloudflare.com'], ['https://second.trycloudflare.com']]);
  });

  it('reads the hostname over real HTTP, the way cloudflared serves it', async () => {
    const server: Server = createServer((req, res) => {
      res.end(req.url === '/quicktunnel' ? '{"hostname":"calm-river.trycloudflare.com"}' : 'not found');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    const onOrigin = jest.fn().mockResolvedValue(undefined);

    try {
      await new QuickTunnelWatcher(`http://127.0.0.1:${port}/`, onOrigin).check();
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }

    expect(onOrigin).toHaveBeenCalledWith('https://calm-river.trycloudflare.com');
  });

  it('keeps waiting without registering while cloudflared is not running', async () => {
    const onOrigin = jest.fn();
    const fetchFn = jest.fn().mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:20241'));
    const watcher = new QuickTunnelWatcher('http://127.0.0.1:20241', onOrigin, fetchFn);

    await watcher.check();
    await watcher.check();

    expect(onOrigin).not.toHaveBeenCalled();
  });

  it('retries the same hostname on the next poll when registration fails', async () => {
    const onOrigin = jest.fn().mockRejectedValueOnce(new Error('Telegram 502')).mockResolvedValue(undefined);
    const watcher = new QuickTunnelWatcher('http://127.0.0.1:20241', onOrigin, metricsReply('host.trycloudflare.com'));

    await watcher.check();
    await watcher.check();
    await watcher.check();

    expect(onOrigin).toHaveBeenCalledTimes(2);
  });

  it('never overlaps two registrations when a poll fires mid-registration', async () => {
    let release: () => void = () => undefined;
    const onOrigin = jest.fn(() => new Promise<void>((resolve) => (release = resolve)));
    const watcher = new QuickTunnelWatcher('http://127.0.0.1:20241', onOrigin, metricsReply('host.trycloudflare.com'));

    const first = watcher.check();
    await new Promise((resolve) => setImmediate(resolve));
    expect(onOrigin).toHaveBeenCalledTimes(1); // first poll is now mid-registration

    await watcher.check();
    release();
    await first;
    await watcher.check();

    expect(onOrigin).toHaveBeenCalledTimes(1);
  });
});
