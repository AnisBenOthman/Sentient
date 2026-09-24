#!/usr/bin/env node
/**
 * Starts a free Cloudflare quick tunnel (no account, no domain) to the local web
 * app and prints its public URL.
 *
 *   pnpm tunnel                         tunnel -> http://localhost:3000
 *   pnpm tunnel http://localhost:3004   tunnel -> any other local origin
 *   pnpm dev:tunnel                     the whole dev stack plus this tunnel
 *   add --verbose to see cloudflared's own log
 *
 * WHY this script never touches Telegram or .env: a quick tunnel gets a new
 * random hostname on every start, so the URL cannot live in .env. ai-agentic
 * keeps TELEGRAM_WEBHOOK_URL={tunnel}/api/ai/channels/telegram/webhook and reads
 * the live hostname from cloudflared's metrics server, pinned below to
 * 127.0.0.1:20241, re-registering the webhook itself whenever it changes. The
 * tunnel therefore needs no bot token or secret, and a restart of either side
 * converges on its own.
 */
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

const METRICS_ADDR = '127.0.0.1:20241'; // must match CLOUDFLARED_METRICS_URL in ai-agentic (the default)
const WEBHOOK_PATH = '/api/ai/channels/telegram/webhook';
const URL_PATTERN = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/;

const args = process.argv.slice(2);
const target = args.find((arg) => !arg.startsWith('--')) ?? 'http://localhost:3000';
const verbose = args.includes('--verbose');

const cloudflared = spawn('cloudflared', ['tunnel', '--url', target, '--metrics', METRICS_ADDR], {
  stdio: ['ignore', 'pipe', 'pipe'],
});

cloudflared.on('error', (err) => {
  if (err.code === 'ENOENT') {
    console.error(
      'cloudflared is not installed or not on PATH.\n' +
        '  Windows: winget install --id Cloudflare.cloudflared   (then open a new terminal)\n' +
        '  macOS:   brew install cloudflared\n' +
        '  Linux:   https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/',
    );
  } else {
    console.error(`Could not start cloudflared: ${err.message}`);
  }
  process.exit(1);
});

let announced = false;

// cloudflared logs to stderr, including the banner that carries the URL. Its
// INF/DBG chatter is hidden unless --verbose. Everything else is shown, because
// fatal errors (e.g. "quick tunnel provisioning failed") carry no level tag.
for (const stream of [cloudflared.stdout, cloudflared.stderr]) {
  createInterface({ input: stream }).on('line', (line) => {
    const match = announced ? null : URL_PATTERN.exec(line);
    if (match) {
      announced = true;
      console.log(`\nTunnel live: ${match[0]}  ->  ${target}`);
      console.log(`Telegram (webhook mode): ai-agentic registers ${match[0]}${WEBHOOK_PATH} within ~10s`);
      console.log('Leave this running. Ctrl+C stops the tunnel.\n');
    }
    if (verbose || !/ (INF|DBG) /.test(line)) console.log(line);
  });
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => cloudflared.kill());
}

cloudflared.on('exit', (code, signal) => {
  if (!announced && code !== 0 && signal === null) {
    console.error('cloudflared exited before a tunnel URL appeared. Re-run with --verbose to see its full log.');
  }
  process.exit(code ?? 0);
});
